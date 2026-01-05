/**
 * Debug script to see GreedyBot combat decisions
 */

import {
  initializeGame,
  getTestDeck,
  getLegalActions,
  applyAction,
  getPlayer,
  CardLoader,
  isCreature,
  type Action,
} from '@manacore/engine';
import { GreedyBot } from '../../packages/ai/src/bots/GreedyBot';
import { RandomBot } from '../../packages/ai/src/bots/RandomBot';
import { quickEvaluate } from '../../packages/ai/src/evaluation/evaluate';

const playerDeck = getTestDeck('green');
const opponentDeck = getTestDeck('red');

let state = initializeGame(playerDeck, opponentDeck, 12345);

const greedyBot = new GreedyBot(42, false);
const randomBot = new RandomBot(43);

// Play until we get to an interesting combat situation
let turnCount = 0;
while (!state.gameOver && turnCount < 200) {
  const legalActions = getLegalActions(state, state.priorityPlayer);
  if (legalActions.length === 0) break;

  const bot = state.priorityPlayer === 'player' ? greedyBot : randomBot;
  const action = bot.chooseAction(state, state.priorityPlayer);

  // Log spell casts
  if (action.type === 'CAST_SPELL' && state.priorityPlayer === 'player') {
    console.log(`Turn ${state.turnCount}: GreedyBot casts spell`);
  }

  // Log interesting moments
  const isAttackDecision = legalActions.some(
    (a) => a.type === 'DECLARE_ATTACKERS' && a.payload.attackers.length > 0,
  );
  const isBlockDecision = legalActions.some(
    (a) => a.type === 'DECLARE_BLOCKERS' && a.payload.blocks.length > 0,
  );

  if ((isAttackDecision || isBlockDecision) && state.priorityPlayer === 'player') {
    const me = getPlayer(state, 'player');
    const opp = getPlayer(state, 'opponent');

    console.log(`\n${'='.repeat(60)}`);
    console.log(
      `Turn ${state.turnCount} | ${state.phase} | GreedyBot's ${isAttackDecision ? 'ATTACK' : 'BLOCK'} decision`,
    );
    console.log('='.repeat(60));
    console.log(`Life: ${me.life} vs ${opp.life}`);

    const myCreatures = me.battlefield.filter((c) => {
      const template = CardLoader.getById(c.scryfallId);
      return template && isCreature(template);
    });
    const oppCreatures = opp.battlefield.filter((c) => {
      const template = CardLoader.getById(c.scryfallId);
      return template && isCreature(template);
    });
    console.log(`My creatures: ${myCreatures.length}`);
    console.log(`Opp creatures: ${oppCreatures.length}`);

    // Evaluate attack options
    const attackOptions = legalActions.filter((a) => a.type === 'DECLARE_ATTACKERS');
    const blockOptions = legalActions.filter((a) => a.type === 'DECLARE_BLOCKERS');
    const options = isAttackDecision ? attackOptions : blockOptions;

    if (options.length > 0) {
      const scoredOptions: Array<{ action: Action; score: number; desc: string }> = [];

      for (const option of options.slice(0, 10)) {
        try {
          const newState = applyAction(state, option);
          const score = quickEvaluate(newState, 'player');
          let desc = '';
          if (option.type === 'DECLARE_ATTACKERS') {
            desc = `Attack with ${option.payload.attackers.length} creatures`;
          } else if (option.type === 'DECLARE_BLOCKERS') {
            desc = `Block with ${option.payload.blocks.length} creatures`;
          }
          scoredOptions.push({ action: option, score, desc });
        } catch (e) {
          // Ignore
        }
      }

      scoredOptions.sort((a, b) => b.score - a.score);

      console.log(`\nTop ${Math.min(5, scoredOptions.length)} options:`);
      for (let i = 0; i < Math.min(5, scoredOptions.length); i++) {
        const marker = scoredOptions[i].action === action ? '→' : ' ';
        console.log(
          `${marker} ${i + 1}. ${scoredOptions[i].desc.padEnd(30)} → score: ${scoredOptions[i].score.toFixed(2)}`,
        );
      }
    }
  }

  state = applyAction(state, action);

  if (state.turnCount > turnCount) {
    turnCount = state.turnCount;
    if (turnCount >= 15) break; // Stop after seeing enough
  }
}

console.log(`\n\nFinal result: Winner = ${state.winner || 'Draw'} after ${state.turnCount} turns`);
