import { describe, test, expect } from 'bun:test';
import {
  createGameState,
  applyAction,
  CardLoader,
  createCardInstance,
  getPlayer,
  getLegalActions,
  type GameState,
} from '../src/index';

describe('Game Invariants & Long Simulation', () => {
  // Helper to create a basic deck
  const createBasicDeck = (playerId: 'player' | 'opponent', size: number = 60) => {
    const island = CardLoader.getByName('Island');
    if (!island) throw new Error('Island not found');

    return Array(size)
      .fill(null)
      .map(() => createCardInstance(island.id, playerId, 'library'));
  };

  test('Simulation: Cards are drawn every turn (except T1 Player)', () => {
    const pDeck = createBasicDeck('player', 60);
    const oDeck = createBasicDeck('opponent', 60);
    let state = createGameState(pDeck, oDeck);

    // Initial State
    // Hand: 0 (createGameState) -> 7 (initializeGame logic would usually draw, but we are using createGameState raw)
    // We need to simulate the initial draw if we want to match real games,
    // or we can just test the "draw per turn" mechanic from a clean state.

    // Let's manually draw 7 for each to start "realistically"
    for (let i = 0; i < 7; i++) {
      const pCard = getPlayer(state, 'player').library.pop();
      if (pCard) getPlayer(state, 'player').hand.push(pCard);

      const oCard = getPlayer(state, 'opponent').library.pop();
      if (oCard) getPlayer(state, 'opponent').hand.push(oCard);
    }

    const initialPLib = getPlayer(state, 'player').library.length; // 53
    const initialOLib = getPlayer(state, 'opponent').library.length; // 53

    expect(initialPLib).toBe(53);
    expect(initialOLib).toBe(53);

    // Helper to pass turn
    const passTurn = () => {
      let attempts = 0;
      const startActive = state.activePlayer;

      while (state.activePlayer === startActive && attempts < 100) {
        const actions = getLegalActions(state, state.priorityPlayer);
        if (actions.length === 0) break;

        // Prefer PASS_PRIORITY, then END_TURN, then anything
        const pass = actions.find((a) => a.type === 'PASS_PRIORITY');
        const end = actions.find((a) => a.type === 'END_TURN');

        if (pass) state = applyAction(state, pass);
        else if (end) state = applyAction(state, end);
        else state = applyAction(state, actions[0]); // Fallback (shouldn't happen with just lands)

        attempts++;
      }
    };

    // --- TURN 1 (Player) ---
    // Start at main1 (simulating initializeGame) or beginning?
    // createGameState starts at beginning/untap.

    // Pass priority through Beginning (Turn 1)
    // Player should NOT draw (Turn 1)
    const actions = getLegalActions(state, 'player');
    const pass = actions.find((a) => a.type === 'PASS_PRIORITY');
    expect(pass).toBeDefined();
    state = applyAction(state, pass!); // To Main1

    expect(getPlayer(state, 'player').library.length).toBe(53); // No draw T1

    passTurn(); // Finish Player Turn 1

    // --- TURN 2 (Opponent) ---
    // Opponent should draw at start of turn
    // We are at Opponent Beginning
    expect(state.activePlayer).toBe('opponent');
    expect(state.phase).toBe('beginning');

    const oPass = getLegalActions(state, 'opponent').find((a) => a.type === 'PASS_PRIORITY');
    state = applyAction(state, oPass!); // To Main1

    expect(getPlayer(state, 'opponent').library.length).toBe(52); // Drew 1

    passTurn(); // Finish Opponent Turn 2

    // --- TURN 3 (Player) ---
    // Player should draw
    expect(state.activePlayer).toBe('player');
    expect(state.phase).toBe('beginning');

    const pPassT3 = getLegalActions(state, 'player').find((a) => a.type === 'PASS_PRIORITY');
    state = applyAction(state, pPassT3!);

    expect(getPlayer(state, 'player').library.length).toBe(52); // Drew 1

    passTurn(); // Finish Player Turn 3

    // Run loop for 10 more turns
    for (let i = 4; i <= 14; i++) {
      const active = state.activePlayer;
      const libraryBefore = getPlayer(state, active).library.length;

      console.log(`Turn ${state.turnCount} (${active}) - Lib Before: ${libraryBefore}`);

      // Pass Beginning
      const passBeg = getLegalActions(state, active).find((a) => a.type === 'PASS_PRIORITY');
      if (!passBeg) {
        console.log('No PASS_PRIORITY action found in beginning phase!');
        break;
      }
      state = applyAction(state, passBeg!);

      // Check Draw
      const libraryAfter = getPlayer(state, active).library.length;
      console.log(`Turn ${state.turnCount} (${active}) - Lib After: ${libraryAfter}`);

      expect(libraryAfter).toBe(libraryBefore - 1);

      passTurn();
    }
  });
});
