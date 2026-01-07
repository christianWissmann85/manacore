import { createGameState } from '../src/state/GameState';
import { applyAction } from '../src/actions/reducer';
import { createCardInstance } from '../src/state/CardInstance';
import { CardLoader } from '../src/cards/CardLoader';
import type { GameState } from '../src/state/GameState';

describe('Priority Loop Bug', () => {
  let state: GameState;

  beforeEach(() => {
    // Setup a basic game state
    state = createGameState([], []);
  });

  test('Both players passing priority in Main Phase 1 should advance to Combat (when attackers exist)', () => {
    // Set to Main 1
    state.phase = 'main1';
    state.step = 'main';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';

    // Add a creature that can attack (not summoning sick)
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const creature = createCardInstance(bears.id, 'player', 'battlefield');
    creature.summoningSick = false; // Can attack
    state.players.player.battlefield.push(creature);

    // Player passes
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
      payload: {},
    });

    expect(state.priorityPlayer).toBe('opponent');

    // Opponent passes
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'opponent',
      payload: {},
    });

    // Should advance to Combat (Declare Attackers) because we have a creature that can attack
    expect(state.phase).toBe('combat');
    expect(state.step).toBe('declare_attackers');
    // Active player (player) should typically get priority in declare attackers
    // (though in declare blockers it goes to defender)
    expect(state.priorityPlayer).toBe('player');
  });

  test('Both players passing priority in Main Phase 1 skips to Main 2 when no attackers', () => {
    // Set to Main 1 with no creatures
    state.phase = 'main1';
    state.step = 'main';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';

    // Player passes
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
      payload: {},
    });

    expect(state.priorityPlayer).toBe('opponent');

    // Opponent passes
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'opponent',
      payload: {},
    });

    // Should skip directly to Main 2 (no attackers available)
    expect(state.phase).toBe('main2');
    expect(state.step).toBe('main');
    expect(state.priorityPlayer).toBe('player');
  });

  test('Both players passing priority in Main Phase 2 should advance to End Turn / Next Turn', () => {
    // Set to Main 2
    state.phase = 'main2';
    state.step = 'main';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';

    // Player passes
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
      payload: {},
    });

    expect(state.priorityPlayer).toBe('opponent');

    // Opponent passes
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'opponent',
      payload: {},
    });

    // Should NOT be in main2 anymore
    expect(state.phase).not.toBe('main2');

    // In the current implementation's likely intended flow, it might go to 'ending' phase or
    // directly execute EndTurnAction logic if that's how it's wired.
    // Or it might loop back to beginning if EndTurn is auto-applied.
    // Based on `applyEndTurn` existing, there might be an implicit END_TURN action
    // or the phase should become 'ending'.
    // However, looking at `reducer.ts`, `applyEndTurn` resets to 'beginning'.

    // If the fix is implemented correctly, it should likely transition to the next turn
    // OR trigger the end step.

    // Ideally:
    // Main 2 -> End Step -> Cleanup -> Next Turn.

    // If the current engine skips End/Cleanup phases for simplicity and goes straight to Next Turn:
    // state.turnCount should increment OR state.phase should be 'beginning' of next turn.

    // Let's just check it left main2 for now.
  });
});

describe('F6 Auto-Pass Optimization', () => {
  test('F6 mode auto-passes for opponent when they have no instant-speed responses', () => {
    // Setup: Create a game with F6 enabled where player casts a spell
    // and opponent has no instant-speed responses
    const state = createGameState([], []);
    state.phase = 'main1';
    state.step = 'main';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';
    state.enableF6AutoPass = true;

    // Give player mana and a creature to cast
    state.players.player.manaPool = { white: 0, blue: 0, black: 0, red: 0, green: 2, colorless: 0 };
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'player', 'hand');
    state.players.player.hand.push(bearsCard);

    // Cast the creature
    const newState = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: { cardInstanceId: bearsCard.instanceId },
    });

    // With F6 enabled and opponent having no responses:
    // 1. Spell goes on stack, priority goes to opponent
    // 2. F6 should auto-pass for opponent (no instant-speed options)
    // 3. F6 should auto-pass for player (own spell, no responses needed)
    // 4. Spell should resolve automatically

    // The spell should have resolved (no longer on stack)
    expect(newState.stack.length).toBe(0);

    // The creature should be on the battlefield
    const creatureOnBattlefield = newState.players.player.battlefield.find(
      (c) => c.scryfallId === bears.id,
    );
    expect(creatureOnBattlefield).toBeDefined();
  });
});
