/**
 * Debug script to see what GreedyBot is evaluating
 */

import {
  initializeGame,
  getTestDeck,
  getLegalActions,
  applyAction,
  getPlayer,
  CardLoader,
  type Action,
} from '@manacore/engine';
import { GreedyBot } from '../../packages/ai/src/bots/GreedyBot';
import { quickEvaluate } from '../../packages/ai/src/evaluation/evaluate';

const playerDeck = getTestDeck('green');
const opponentDeck = getTestDeck('red');

let state = initializeGame(playerDeck, opponentDeck, 12345);

const bot = new GreedyBot(42, true);

// Play a few turns and see what GreedyBot is choosing
for (let turn = 0; turn < 30; turn++) {
  console.log(`
${'='.repeat(60)}`);
  console.log(`Turn ${state.turnCount} | ${state.phase} | Priority: ${state.priorityPlayer}`);
  console.log('='.repeat(60));

  const legalActions = getLegalActions(state, state.priorityPlayer);
  console.log(`Legal actions: ${legalActions.length}`);
  
  // Show hand and mana on Turn 5
  if (state.turnCount === 5 && state.priorityPlayer === 'player' && state.phase === 'main1') {
    const me = getPlayer(state, 'player');
    const lands = me.battlefield.filter(c => {
      const template = CardLoader.getById(c.scryfallId);
      return template && template.type_line?.toLowerCase().includes('land');
    });
    console.log(`
🎴 Hand: ${me.hand.length} cards`);
    console.log(`🌳 Mana pool: G=${me.manaPool.green || 0}, W=${me.manaPool.white || 0}`);
    console.log(`🏞️  Lands on battlefield: ${lands.length}`);
    console.log(`
CAST_SPELL actions available: ${legalActions.filter(a => a.type === 'CAST_SPELL').length}`);
  }

  if (legalActions.length === 0) break;

  // Show top 5 actions by evaluation
  const scoredActions: Array<{ action: Action; score: number; desc: string }> = [];

  // Make sure to evaluate ALL CAST_SPELL actions
  const castSpells = legalActions.filter(a => a.type === 'CAST_SPELL');
  const otherActions = legalActions.filter(a => a.type !== 'CAST_SPELL').slice(0, 15);
  const actionsToScore = [...castSpells, ...otherActions];

  for (const action of actionsToScore) {
    try {
      const newState = applyAction(state, action);
      const score = quickEvaluate(newState, state.priorityPlayer);
      let desc = action.type;
      if (action.type === 'DECLARE_ATTACKERS') {
        desc += ` (${action.payload.attackers.length} attackers)`;
      } else if (action.type === 'CAST_SPELL') {
        desc += ' (spell)';
      }
      scoredActions.push({ action, score, desc });
    } catch (e) {
      // Log errors for CAST_SPELL actions
      if (action.type === 'CAST_SPELL') {
        console.log(`     ERROR evaluating CAST_SPELL: ${e}`);
      }
    }
  }

  scoredActions.sort((a, b) => b.score - a.score);

  console.log('Top 5 evaluated actions:');
  for (let i = 0; i < Math.min(5, scoredActions.length); i++) {
    console.log(`  ${i + 1}. ${scoredActions[i].desc.padEnd(40)} → score: ${scoredActions[i].score.toFixed(2)}`);
  }
  
  // Show CAST_SPELL actions separately if they exist
  const castSpellActions = scoredActions.filter(sa => sa.action.type === 'CAST_SPELL');
  if (castSpellActions.length > 0) {
    console.log(`
📜 CAST_SPELL actions (${castSpellActions.length}):`);
    for (const sa of castSpellActions.slice(0, 5)) {
      console.log(`     ${sa.desc.padEnd(40)} → score: ${sa.score.toFixed(2)}`);
    }
  }

  // Get bot's actual choice
  const chosenAction = bot.chooseAction(state, state.priorityPlayer);
  let chosenDesc = chosenAction.type;
  if (chosenAction.type === 'DECLARE_ATTACKERS') {
    chosenDesc += ` (${chosenAction.payload.attackers.length} attackers)`;
  } else if (chosenAction.type === 'CAST_SPELL') {
    chosenDesc += ' (spell)';
  }
  console.log(`
✓ Bot chose: ${chosenDesc}`);

  state = applyAction(state, chosenAction);

  if (state.gameOver) {
    console.log(`
Game over! Winner: ${state.winner}`);
    break;
  }

  // Skip to interesting phases
  let safetyCounter = 0;
  while (
    !state.gameOver &&
    state.priorityPlayer !== 'player' &&
    state.phase !== 'combat' &&
    safetyCounter++ < 100
  ) {
    const legalActions = getLegalActions(state, state.priorityPlayer);
    if (legalActions.length === 0) break;

    // Random bot makes a move
    const randomAction = legalActions[Math.floor(Math.random() * legalActions.length)];
    state = applyAction(state, randomAction);
  }
}
