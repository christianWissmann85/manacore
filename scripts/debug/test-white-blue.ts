/**
 * Reproduce the White vs Blue hang
 */

import {
  initializeGame,
  getTestDeck,
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

const whiteDeck = getTestDeck('white');
const blueDeck = getTestDeck('blue');

let state = initializeGame(whiteDeck, blueDeck, 12345 + 37); // Game 38 seed

const greedyBot = new GreedyBot(42 + 37);
const randomBot = new RandomBot(43 + 37);

let turnCount = 0;
let actionCount = 0;

console.log('🎮 White vs Blue Debug\n');

while (!state.gameOver && turnCount < 15 && actionCount < 500) {
  if (state.turnCount > turnCount) {
    turnCount = state.turnCount;
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

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Turn ${turnCount}`);
    console.log(
      `  White: ${player.life} life, ${playerCreatures.length} creatures, ${player.hand.length} cards`,
    );
    if (playerCreatures.length > 0) {
      console.log(`    Creatures:`);
      for (const creature of playerCreatures) {
        const template = CardLoader.getById(creature.scryfallId);
        const tapped = creature.tapped ? '[tapped]' : '[untapped]';
        if (template && isCreature(template)) {
          const basePower = parseInt(template.power || '0', 10);
          const baseToughness = parseInt(template.toughness || '0', 10);
          const power = getEffectivePowerWithLords(state, creature, basePower);
          const toughness = getEffectiveToughnessWithLords(state, creature, baseToughness);
          const keywords = getAllKeywords(state, creature);
          const keywordStr = keywords.length ? ` [${keywords.join(', ')}]` : '';
          console.log(`      ${template.name} (${power}/${toughness}) ${tapped}${keywordStr}`);
        } else {
          console.log(`      ${template?.name} ${tapped}`);
        }
      }
    }
    console.log(
      `  Blue: ${opponent.life} life, ${opponentCreatures.length} creatures, ${opponent.hand.length} cards`,
    );
    if (opponentCreatures.length > 0) {
      console.log(`    Creatures:`);
      for (const creature of opponentCreatures) {
        const template = CardLoader.getById(creature.scryfallId);
        const tapped = creature.tapped ? '[tapped]' : '[untapped]';
        if (template && isCreature(template)) {
          const basePower = parseInt(template.power || '0', 10);
          const baseToughness = parseInt(template.toughness || '0', 10);
          const power = getEffectivePowerWithLords(state, creature, basePower);
          const toughness = getEffectiveToughnessWithLords(state, creature, baseToughness);
          const keywords = getAllKeywords(state, creature);
          const keywordStr = keywords.length ? ` [${keywords.join(', ')}]` : '';
          console.log(`      ${template.name} (${power}/${toughness}) ${tapped}${keywordStr}`);
        } else {
          console.log(`      ${template?.name} ${tapped}`);
        }
      }
    }
  }

  const legalActions = getLegalActions(state, state.priorityPlayer);

  // Show detailed state when we hit turn 7
  if (turnCount === 7 && actionCount % 10 === 0) {
    console.log(
      `\n  [Action ${actionCount}] Phase: ${state.phase}, Step: ${state.step}, Priority: ${state.priorityPlayer}`,
    );
    const activePlayer = getPlayer(state, state.activePlayer);
    const attackers = activePlayer.battlefield.filter((c) => c.attacking);
    const allBlockers = state.players.player.battlefield
      .concat(state.players.opponent.battlefield)
      .filter((c) => c.blocking);
    console.log(`  Combat state: ${attackers.length} attackers, ${allBlockers.length} blockers`);
    console.log(`  Legal actions: ${legalActions.length}`);
    for (let i = 0; i < Math.min(5, legalActions.length); i++) {
      const action = legalActions[i];
      if (action.type === 'ACTIVATE_ABILITY') {
        console.log(`    ${i + 1}. ${action.type} (${action.payload.abilityId})`);
      } else {
        console.log(`    ${i + 1}. ${action.type}`);
      }
    }
  }

  if (legalActions.length === 0) {
    console.log(`  ❌ No legal actions at turn ${turnCount}, action ${actionCount}`);
    break;
  }

  const bot = state.priorityPlayer === 'player' ? greedyBot : randomBot;
  const action = bot.chooseAction(state, state.priorityPlayer);

  if (turnCount === 7 && actionCount % 10 === 0) {
    console.log(
      `  Bot chose: ${action.type}${action.type === 'ACTIVATE_ABILITY' ? ` (${action.payload.abilityId})` : ''}`,
    );
  }

  state = applyAction(state, action);
  actionCount++;
}

if (actionCount >= 500) {
  console.log(`\n🚨 HANG DETECTED at turn ${turnCount} after ${actionCount} actions`);
  console.log(`Phase: ${state.phase}, Step: ${state.step}, Priority: ${state.priorityPlayer}`);

  const player = getPlayer(state, 'player');
  const opponent = getPlayer(state, 'opponent');

  console.log(`\nBattlefield:`);
  console.log(`  Player: ${player.battlefield.length} permanents`);
  for (const card of player.battlefield) {
    const template = CardLoader.getById(card.scryfallId);
    const keywords = getAllKeywords(state, card);
    const keywordStr = keywords.length ? ` [${keywords.join(', ')}]` : '';
    console.log(`    - ${template?.name} (${card.tapped ? 'tapped' : 'untapped'})${keywordStr}`);
  }
  console.log(`  Opponent: ${opponent.battlefield.length} permanents`);
  for (const card of opponent.battlefield) {
    const template = CardLoader.getById(card.scryfallId);
    const keywords = getAllKeywords(state, card);
    const keywordStr = keywords.length ? ` [${keywords.join(', ')}]` : '';
    console.log(`    - ${template?.name} (${card.tapped ? 'tapped' : 'untapped'})${keywordStr}`);
  }

  console.log(`\nStack: ${state.stack.length} items`);
  const attackingCreatures = player.battlefield
    .concat(opponent.battlefield)
    .filter((c) => c.attacking);
  const blockingCreatures = player.battlefield
    .concat(opponent.battlefield)
    .filter((c) => c.blocking);
  console.log(
    `Combat: ${attackingCreatures.length > 0 || blockingCreatures.length > 0 ? 'active' : 'none'}`,
  );
  if (attackingCreatures.length > 0 || blockingCreatures.length > 0) {
    console.log(`  Attackers: ${attackingCreatures.length}`);
    console.log(`  Blockers: ${blockingCreatures.length}`);
  }
}
