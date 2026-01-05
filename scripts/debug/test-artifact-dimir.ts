/**
 * Reproduce the Artifact vs Dimir hang
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
} from '@manacore/engine';
import { GreedyBot } from '../../packages/ai/src/bots/GreedyBot';
import { RandomBot } from '../../packages/ai/src/bots/RandomBot';

const artifactDeck = getTestDeck('artifact');
const dimirDeck = getTestDeck('dimir');

let state = initializeGame(artifactDeck, dimirDeck, 12345 + 14); // Game 15 seed

const greedyBot = new GreedyBot(42 + 14);
const randomBot = new RandomBot(43 + 14);

let turnCount = 0;
let actionCount = 0;

console.log('🎮 Artifact vs Dimir Debug\n');

while (!state.gameOver && turnCount < 20 && actionCount < 500) {
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
      `  Artifact: ${player.life} life, ${playerCreatures.length} creatures, ${player.hand.length} cards`,
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
          console.log(`      ${template.name} (${power}/${toughness}) ${tapped}`);
        } else {
          console.log(`      ${template?.name} ${tapped}`);
        }
      }
    }
    console.log(
      `  Dimir: ${opponent.life} life, ${opponentCreatures.length} creatures, ${opponent.hand.length} cards`,
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
          console.log(`      ${template.name} (${power}/${toughness}) ${tapped}`);
        } else {
          console.log(`      ${template?.name} ${tapped}`);
        }
      }
    }
  }

  const legalActions = getLegalActions(state, state.priorityPlayer);

  // Show detailed state when we hit turn 11
  if (turnCount === 11 && actionCount % 10 === 0) {
    console.log(
      `\n  [Action ${actionCount}] Phase: ${state.phase}, Step: ${state.step}, Priority: ${state.priorityPlayer}`,
    );
    console.log(`  Legal actions: ${legalActions.length}`);
    for (let i = 0; i < Math.min(3, legalActions.length); i++) {
      console.log(`    ${i + 1}. ${legalActions[i].type}`);
    }
  }

  if (legalActions.length === 0) {
    console.log(`  ❌ No legal actions at turn ${turnCount}, action ${actionCount}`);
    break;
  }

  const bot = state.priorityPlayer === 'player' ? greedyBot : randomBot;
  const action = bot.chooseAction(state, state.priorityPlayer);

  if (turnCount === 11 && actionCount % 10 === 0) {
    console.log(`  Bot chose: ${action.type}`);
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
    console.log(`    - ${template?.name} (${card.tapped ? 'tapped' : 'untapped'})`);
  }
  console.log(`  Opponent: ${opponent.battlefield.length} permanents`);
  for (const card of opponent.battlefield) {
    const template = CardLoader.getById(card.scryfallId);
    console.log(`    - ${template?.name} (${card.tapped ? 'tapped' : 'untapped'})`);
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
