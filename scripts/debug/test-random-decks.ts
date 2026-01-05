/**
 * Test random deck matchups to reproduce simulation hangs
 */

import {
  initializeGame,
  getRandomTestDeck,
  getDeckDisplayName,
  applyAction,
  getLegalActions,
  getPlayer,
  CardLoader,
  isCreature,
} from '@manacore/engine';
import { GreedyBot } from '../../packages/ai/src/bots/GreedyBot';
import { RandomBot } from '../../packages/ai/src/bots/RandomBot';

const MAX_TURNS = 100;
const MAX_ACTIONS = 10000;

console.log('🎮 Random Deck Matchup Test (Detailed)\n');

for (let gameNum = 0; gameNum < 50; gameNum++) {
  const deck1Type = getRandomTestDeck();
  const deck2Type = getRandomTestDeck();
  const deck1Name = getDeckDisplayName(deck1Type);
  const deck2Name = getDeckDisplayName(deck2Type);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Game ${gameNum + 1}: ${deck1Name} vs ${deck2Name}`);
  console.log(`${'='.repeat(60)}`);

  let state = initializeGame(deck1Type, deck2Type, 12345 + gameNum);

  const greedyBot = new GreedyBot(42 + gameNum);
  const randomBot = new RandomBot(43 + gameNum);

  let turnCount = 0;
  let actionCount = 0;
  let lastTurnReport = 0;

  while (!state.gameOver && turnCount < MAX_TURNS && actionCount < MAX_ACTIONS) {
    // Report every 10 turns
    if (state.turnCount > turnCount) {
      turnCount = state.turnCount;

      if (turnCount - lastTurnReport >= 10) {
        const player = getPlayer(state, 'player');
        const opponent = getPlayer(state, 'opponent');

        const playerCreatures = player.battlefield.filter((c) => {
          const t = CardLoader.getById(c.scryfallId);
          return t && isCreature(t);
        });
        const opponentCreatures = opponent.battlefield.filter((c) => {
          const t = CardLoader.getById(c.scryfallId);
          return t && isCreature(t);
        });

        console.log(
          `  Turn ${turnCount}: P1=${player.life}❤️ (${playerCreatures.length}🦅 ${player.hand.length}🃏) | P2=${opponent.life}❤️ (${opponentCreatures.length}🦅 ${opponent.hand.length}🃏)`,
        );
        lastTurnReport = turnCount;
      }
    }

    const legalActions = getLegalActions(state, state.priorityPlayer);
    if (legalActions.length === 0) {
      console.log(`  ❌ No legal actions at turn ${turnCount}, action ${actionCount}`);
      break;
    }

    const bot = state.priorityPlayer === 'player' ? greedyBot : randomBot;
    const action = bot.chooseAction(state, state.priorityPlayer);

    state = applyAction(state, action);
    actionCount++;

    // Detect potential infinite loops
    if (actionCount % 1000 === 0) {
      console.log(`  ⚠️  Warning: ${actionCount} actions taken (turn ${turnCount})`);
    }
  }

  if (actionCount >= MAX_ACTIONS) {
    console.log(`  🚨 HANG DETECTED: ${actionCount} actions without game end!`);
    console.log(`  Turn: ${turnCount}, Game Over: ${state.gameOver}`);
    console.log(`  Phase: ${state.phase}, Step: ${state.step}`);
    console.log(`  Priority: ${state.priorityPlayer}`);

    const player = getPlayer(state, 'player');
    const opponent = getPlayer(state, 'opponent');
    console.log(`  P1: ${player.life} life, ${player.battlefield.length} permanents`);
    console.log(`  P2: ${opponent.life} life, ${opponent.battlefield.length} permanents`);

    // Exit to avoid wasting time
    process.exit(1);
  }

  if (state.gameOver) {
    const player = getPlayer(state, 'player');
    const opponent = getPlayer(state, 'opponent');
    const winner = player.life > 0 ? 'P1' : opponent.life > 0 ? 'P2' : 'Draw';
    console.log(`  ✅ Game ended on turn ${turnCount} - Winner: ${winner}`);
  } else if (turnCount >= MAX_TURNS) {
    console.log(`  ⏱️  Turn limit reached`);
  }
}

console.log('\n✅ All 50 games completed without hangs');
