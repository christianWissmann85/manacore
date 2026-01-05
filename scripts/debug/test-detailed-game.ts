/**
 * Single Red vs Green game with detailed logging
 */

import {
  initializeGame,
  getTestDeck,
  applyAction,
  getLegalActions,
  getPlayer,
  CardLoader,
  isCreature,
} from '@manacore/engine';
import { GreedyBot } from '../../packages/ai/src/bots/GreedyBot';
import { RandomBot } from '../../packages/ai/src/bots/RandomBot';
import { quickEvaluate } from '../../packages/ai/src/evaluation/evaluate';

const greenDeck = getTestDeck('green');
const redDeck = getTestDeck('red');

let state = initializeGame(greenDeck, redDeck, 12345);

const greedyBot = new GreedyBot(42);
const randomBot = new RandomBot(43);

let turnCount = 0;
let actionCount = 0;

console.log('🎮 Detailed Red vs Green Game\n');

while (!state.gameOver && turnCount < 20) {
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
      `  GreedyBot: ${player.life} life, ${playerCreatures.length} creatures, ${player.hand.length} cards`,
    );
    if (playerCreatures.length > 0) {
      console.log(`    Creatures:`);
      for (const c of playerCreatures) {
        const t = CardLoader.getById(c.scryfallId);
        console.log(
          `      ${t?.name} (${t?.power}/${t?.toughness}) ${c.tapped ? '[tapped]' : '[untapped]'} ${c.summoningSick ? '[summoning sick]' : ''}`,
        );
      }
    }
    console.log(
      `  RandomBot: ${opponent.life} life, ${opponentCreatures.length} creatures, ${opponent.hand.length} cards`,
    );
  }

  const legalActions = getLegalActions(state, state.priorityPlayer);
  if (legalActions.length === 0) break;

  const bot = state.priorityPlayer === 'player' ? greedyBot : randomBot;

  // Log declare_blockers legal actions
  if (
    state.phase === 'combat' &&
    state.step === 'declare_blockers' &&
    state.priorityPlayer === 'opponent'
  ) {
    console.log(`  [Declare Blockers Step] Legal actions for RandomBot: ${legalActions.length}`);
    const actionTypes = legalActions.map((a) => {
      if (a.type === 'DECLARE_BLOCKERS') {
        return `DECLARE_BLOCKERS(${a.payload.blocks.length} blocks)`;
      }
      return a.type;
    });
    console.log(`    ${actionTypes.join(', ')}`);
  }

  // Log attack decisions by GreedyBot
  if (state.priorityPlayer === 'player' && state.phase === 'combat') {
    const attackOptions = legalActions.filter((a) => a.type === 'DECLARE_ATTACKERS');
    if (attackOptions.length > 1) {
      const me = getPlayer(state, 'player');
      const opp = getPlayer(state, 'opponent');

      const myCreatures = me.battlefield.filter((c) => {
        const t = CardLoader.getById(c.scryfallId);
        return t && isCreature(t) && !c.tapped && !c.summoningSick;
      });

      const oppCreatures = opp.battlefield.filter((c) => {
        const t = CardLoader.getById(c.scryfallId);
        return t && isCreature(t);
      });

      console.log(`\n  Combat phase - ${myCreatures.length} untapped creatures can attack`);
      console.log(`  Opponent has ${oppCreatures.length} creatures that can block`);

      // Evaluate top 3 attack options
      const scoredOptions = attackOptions
        .slice(0, 5)
        .map((action) => {
          const newState = applyAction(state, action);
          const score = quickEvaluate(newState, 'player');
          return { attackers: action.payload.attackers.length, score };
        })
        .sort((a, b) => b.score - a.score);

      console.log(`  Attack evaluations:`);
      for (const opt of scoredOptions.slice(0, 3)) {
        console.log(`    ${opt.attackers} attackers → score: ${opt.score.toFixed(1)}`);
      }
    }
  }

  const action = bot.chooseAction(state, state.priorityPlayer);

  // Log phase transitions and important actions
  if (action.type === 'CAST_SPELL' && state.priorityPlayer === 'player') {
    console.log(`  → GreedyBot casts spell`);
  } else if (action.type === 'DECLARE_ATTACKERS' && state.priorityPlayer === 'player') {
    console.log(`  → GreedyBot attacks with ${action.payload.attackers.length} creatures`);
  }

  const prevOpponentLife = state.players.opponent.life;
  const actionType = action.type;
  const prevPhase = state.phase;
  const prevStep = state.step;

  state = applyAction(state, action);
  const newOpponentLife = state.players.opponent.life;

  if (
    actionType === 'PASS_PRIORITY' &&
    prevStep === 'declare_blockers' &&
    newOpponentLife !== prevOpponentLife
  ) {
    console.log(`    💥 COMBAT DAMAGE! Life: ${prevOpponentLife} → ${newOpponentLife}`);
  }

  if (state.phase !== prevPhase || state.step !== prevStep) {
    if (state.phase === 'combat' && state.step === 'combat_damage') {
      console.log(`    [Combat Damage Step!]`);
    }
  }

  if (newOpponentLife < prevOpponentLife) {
    console.log(
      `  💥 Opponent took ${prevOpponentLife - newOpponentLife} damage! (${prevOpponentLife} → ${newOpponentLife}) [Priority: ${state.priorityPlayer}]`,
    );
  }

  actionCount++;
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Game ended after ${state.turnCount} turns (${actionCount} actions)`);
console.log(`Winner: ${state.winner || 'Draw'}`);
console.log(`Final life: ${state.players.player.life} vs ${state.players.opponent.life}`);
console.log(
  `Final library: ${state.players.player.library.length} vs ${state.players.opponent.library.length}`,
);
