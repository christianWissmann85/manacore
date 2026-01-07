import { describe, test, expect } from 'bun:test';
import {
  createGameState,
  applyAction,
  CardLoader,
  createCardInstance,
  getLegalActions,
  type GameState,
  type Action,
} from '../src/index';

// Simple Random Bot logic purely for this test to avoid circular dependency on @manacore/ai
function getRandomAction(state: GameState, playerId: 'player' | 'opponent'): Action {
  const actions = getLegalActions(state, playerId);
  if (actions.length === 0) throw new Error(`No legal actions for ${playerId} in phase ${state.phase}`);
  const randomIndex = Math.floor(Math.random() * actions.length);
  return actions[randomIndex]!;
}

describe('Engine Stress Tests', () => {
  const createDeck = (playerId: 'player' | 'opponent') => {
    // Mix of Lands and Spells to ensure gameplay happens
    const deck = [];
    const island = CardLoader.getByName('Island')!;
    const mountain = CardLoader.getByName('Mountain')!;
    const bear = CardLoader.getByName('Grizzly Bears')!;
    const bolt = CardLoader.getByName('Lightning Blast')!; // Expensive spell
    const shock = CardLoader.getByName('Shock')!; // Cheap spell

    for (let i = 0; i < 20; i++) deck.push(createCardInstance(i % 2 === 0 ? island.id : mountain.id, playerId, 'library'));
    for (let i = 0; i < 10; i++) deck.push(createCardInstance(bear.id, playerId, 'library'));
    for (let i = 0; i < 5; i++) deck.push(createCardInstance(bolt.id, playerId, 'library'));
    for (let i = 0; i < 5; i++) deck.push(createCardInstance(shock.id, playerId, 'library'));
    
    return deck;
  };

  test('Chaos Mode: Run 5 full games with Random choices', () => {
    const GAMES_TO_PLAY = 5;
    const MAX_TURNS = 100; // Prevent infinite loops

    for (let i = 0; i < GAMES_TO_PLAY; i++) {
      let state = createGameState(createDeck('player'), createDeck('opponent'));
      
      // Initial Draw (Simulate initializeGame)
      for(let j=0; j<7; j++) {
          const p = state.players.player.library.pop();
          if(p) state.players.player.hand.push(p);
          const o = state.players.opponent.library.pop();
          if(o) state.players.opponent.hand.push(o);
      }

      // Run Game
      while (!state.gameOver && state.turnCount < MAX_TURNS) {
        const active = state.priorityPlayer;
        const action = getRandomAction(state, active);
        
        try {
            state = applyAction(state, action);
        } catch (e) {
            console.error(`Game ${i} crashed on Turn ${state.turnCount} Phase ${state.phase}`);
            console.error(`Action: ${JSON.stringify(action)}`);
            throw e;
        }
      }

      // Assertions
      if (state.turnCount >= MAX_TURNS) {
          console.warn(`Game ${i} hit turn limit. This might indicate a stall bug.`);
      } else {
          // Game ended naturally
          expect(state.gameOver).toBe(true);
          expect(state.winner).toBeDefined();
      }
    }
  });
});
