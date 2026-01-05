/**
 * Focused test on new competitive decks with action counting
 */

import { initializeGame, getTestDeck, applyAction, getLegalActions } from '@manacore/engine';
import { GreedyBot } from '../../packages/ai/src/bots/GreedyBot';
import { RandomBot } from '../../packages/ai/src/bots/RandomBot';

const competitiveDecks = [
  'white_weenie',
  'blue_control',
  'black_aggro',
  'red_burn',
  'green_midrange',
];
const MAX_ACTIONS_PER_TURN = 200;

console.log('🎮 Testing Each Competitive Deck\n');

for (const deckName of competitiveDecks) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${deckName}`);
  console.log('='.repeat(60));

  for (let gameNum = 0; gameNum < 5; gameNum++) {
    const deck = getTestDeck(deckName as any);
    const opponentDeck = getTestDeck('red'); // Simple opponent

    let state = initializeGame(deck, opponentDeck, 1000 + gameNum);
    const greedyBot = new GreedyBot(42);
    const randomBot = new RandomBot(43);

    let turnCount = 0;
    let actionCount = 0;
    let actionsThisTurn = 0;

    while (!state.gameOver && turnCount < 50) {
      if (state.turnCount > turnCount) {
        if (actionsThisTurn > 50) {
          console.log(`  Game ${gameNum + 1}: Turn ${turnCount} took ${actionsThisTurn} actions`);
        }
        turnCount = state.turnCount;
        actionsThisTurn = 0;
      }

      const legalActions = getLegalActions(state, state.priorityPlayer);
      if (legalActions.length === 0) break;

      const bot = state.priorityPlayer === 'player' ? greedyBot : randomBot;
      const action = bot.chooseAction(state, state.priorityPlayer);

      state = applyAction(state, action);
      actionCount++;
      actionsThisTurn++;

      if (actionsThisTurn > MAX_ACTIONS_PER_TURN) {
        console.log(
          `  🚨 HANG: Game ${gameNum + 1} Turn ${turnCount} - ${actionsThisTurn} actions!`,
        );
        console.log(
          `     Phase: ${state.phase}, Step: ${state.step}, Priority: ${state.priorityPlayer}`,
        );
        console.log(`     Last action: ${action.type}`);
        process.exit(1);
      }
    }

    if (state.gameOver) {
      console.log(
        `  ✅ Game ${gameNum + 1}: Completed in ${turnCount} turns (${actionCount} actions)`,
      );
    } else {
      console.log(`  ⏱️  Game ${gameNum + 1}: Turn limit reached`);
    }
  }
}

console.log('\n✅ All competitive decks tested successfully');
