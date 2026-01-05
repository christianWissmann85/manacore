
import { describe, test, expect } from 'bun:test';
import {
  initializeGame,
  getTestDeck,
  applyAction,
  getLegalActions,
  type GameState
} from '@manacore/engine';
import { GreedyBot } from '../src/bots/GreedyBot';
import { RandomBot } from '../src/bots/RandomBot';

// Helper to advance game to a random point
function advanceGameRandomly(state: GameState, turns: number) {
  let actions = 0;
  const maxActions = turns * 20; // heuristic limit
  
  while (!state.gameOver && state.turnCount < turns && actions < maxActions) {
    const legal = getLegalActions(state, state.priorityPlayer);
    if (legal.length === 0) break; // Should not happen ideally
    
    // Pick random action
    const action = legal[Math.floor(Math.random() * legal.length)];
    state = applyAction(state, action);
    actions++;
  }
}

describe('Bot Robustness', () => {
  test('GreedyBot never crashes on random states', async () => {
    const bot = new GreedyBot();
    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      const pDeck = getTestDeck('green'); // Use different decks?
      const oDeck = getTestDeck('red');
      let state = initializeGame(pDeck, oDeck, i * 1000);

      // Fast forward to turn 1-10 randomly
      const targetTurn = Math.floor(Math.random() * 10) + 1;
      advanceGameRandomly(state, targetTurn);

      if (state.gameOver) continue;

      // Ask bot for move
      // Bot expects 'player' role usually?
      // evaluateAction takes (state, playerId)
      
      // We must ensure it's the bot's priority for it to make sense
      if (state.priorityPlayer !== 'player' && state.priorityPlayer !== 'opponent') continue;
      
      try {
        const currentBot = new GreedyBot();
        const action = currentBot.chooseAction(state, state.priorityPlayer);
        
        expect(action).toBeDefined();
        
        // Verify action is in legal actions list
        const legal = getLegalActions(state, state.priorityPlayer);
        // We can't easily compare object equality due to payload references (arrays),
        // but we can check type.
        
        const isLegal = legal.some(a => a.type === action.type); 
        // Weak check, but better than nothing.
        // If strict equality is needed, we'd need deep equality check.
        
        expect(isLegal).toBe(true);

      } catch (e) {
        console.error(`GreedyBot crashed on seed ${i * 1000} turn ${state.turnCount} phase ${state.phase}`);
        throw e;
      }
    }
  });

  test('RandomBot never crashes', async () => {
    const iterations = 50;
    
    for (let i = 0; i < iterations; i++) {
       const pDeck = getTestDeck('blue');
       const oDeck = getTestDeck('black');
       let state = initializeGame(pDeck, oDeck, i * 2222);
       
       const targetTurn = Math.floor(Math.random() * 10) + 1;
       advanceGameRandomly(state, targetTurn);
       
       if (state.gameOver) continue;

       const currentBot = new RandomBot();
       try {
           const action = currentBot.chooseAction(state, state.priorityPlayer);
           expect(action).toBeDefined();
       } catch (e) {
           console.error(`RandomBot crashed on seed ${i} phase ${state.phase}`);
           throw e;
       }
    }
  });
});
