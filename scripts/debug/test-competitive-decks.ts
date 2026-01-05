/**
 * Test competitive decks to find hangs
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
  getEffectivePowerWithLords,
  getEffectiveToughnessWithLords,
  getAllKeywords,
} from '@manacore/engine';
import { GreedyBot } from '../../packages/ai/src/bots/GreedyBot';
import { RandomBot } from '../../packages/ai/src/bots/RandomBot';

const MAX_TURNS = 100;
const MAX_ACTIONS = 5000;

console.log('🎮 Testing Competitive Decks for Hangs\n');

for (let gameNum = 0; gameNum < 100; gameNum++) {
  const deck1Type = getRandomTestDeck();
  const deck2Type = getRandomTestDeck();
  const deck1Name = getDeckDisplayName(deck1Type);
  const deck2Name = getDeckDisplayName(deck2Type);

  // Skip if not testing competitive decks
  const competitiveDecks = [
    'white_weenie',
    'blue_control',
    'black_aggro',
    'red_burn',
    'green_midrange',
  ];
  const hasCompetitive =
    competitiveDecks.includes(deck1Name) || competitiveDecks.includes(deck2Name);

  if (!hasCompetitive && gameNum < 50) {
    continue; // Focus on competitive decks for first 50 games
  }

  console.log(`Game ${gameNum + 1}: ${deck1Name} vs ${deck2Name}`);

  let state = initializeGame(deck1Type, deck2Type, 12345 + gameNum);

  const greedyBot = new GreedyBot(42 + gameNum);
  const randomBot = new RandomBot(43 + gameNum);

  let turnCount = 0;
  let actionCount = 0;

  while (!state.gameOver && turnCount < MAX_TURNS && actionCount < MAX_ACTIONS) {
    if (state.turnCount > turnCount) {
      turnCount = state.turnCount;
    }

    const legalActions = getLegalActions(state, state.priorityPlayer);
    if (legalActions.length === 0) {
      console.log(`  ❌ No legal actions at turn ${turnCount}`);
      break;
    }

    const bot = state.priorityPlayer === 'player' ? greedyBot : randomBot;
    const action = bot.chooseAction(state, state.priorityPlayer);

    state = applyAction(state, action);
    actionCount++;

    // Detect potential infinite loops
    if (actionCount % 1000 === 0) {
      console.log(`  ⚠️  ${actionCount} actions (turn ${turnCount})`);
    }
  }

  if (actionCount >= MAX_ACTIONS) {
    console.log(`  🚨 HANG DETECTED: ${actionCount} actions!`);
    console.log(`  Turn: ${turnCount}, Phase: ${state.phase}, Step: ${state.step}`);

    const player = getPlayer(state, 'player');
    const opponent = getPlayer(state, 'opponent');

    console.log(`\n  Battlefield:`);
    console.log(`  Player: ${player.battlefield.length} permanents`);
    for (const card of player.battlefield) {
      const template = CardLoader.getById(card.scryfallId);
      if (template && isCreature(template)) {
        const basePower = parseInt(template.power || '0', 10);
        const baseToughness = parseInt(template.toughness || '0', 10);
        const power = getEffectivePowerWithLords(state, card, basePower);
        const toughness = getEffectiveToughnessWithLords(state, card, baseToughness);
        const keywords = getAllKeywords(state, card);
        const keywordStr = keywords.length ? ` [${keywords.join(', ')}]` : '';
        console.log(
          `    - ${template.name} (${power}/${toughness}) ${card.tapped ? 'T' : 'U'}${keywordStr}`,
        );
      } else {
        console.log(`    - ${template?.name} ${card.tapped ? 'T' : 'U'}`);
      }
    }
    console.log(`  Opponent: ${opponent.battlefield.length} permanents`);
    for (const card of opponent.battlefield) {
      const template = CardLoader.getById(card.scryfallId);
      if (template && isCreature(template)) {
        const basePower = parseInt(template.power || '0', 10);
        const baseToughness = parseInt(template.toughness || '0', 10);
        const power = getEffectivePowerWithLords(state, card, basePower);
        const toughness = getEffectiveToughnessWithLords(state, card, baseToughness);
        const keywords = getAllKeywords(state, card);
        const keywordStr = keywords.length ? ` [${keywords.join(', ')}]` : '';
        console.log(
          `    - ${template.name} (${power}/${toughness}) ${card.tapped ? 'T' : 'U'}${keywordStr}`,
        );
      } else {
        console.log(`    - ${template?.name} ${card.tapped ? 'T' : 'U'}`);
      }
    }

    process.exit(1);
  }

  if (state.gameOver) {
    const player = getPlayer(state, 'player');
    const opponent = getPlayer(state, 'opponent');
    const winner = player.life > 0 ? 'P1' : opponent.life > 0 ? 'P2' : 'Draw';
    console.log(`  ✅ Turn ${turnCount} - ${winner}`);
  } else if (turnCount >= MAX_TURNS) {
    console.log(`  ⏱️  Turn limit`);
  }
}

console.log('\n✅ All 100 games completed');
