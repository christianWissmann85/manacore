/**
 * Red vs Green matchup test
 * Tests the best-performing decks to see if stalemates are deck-dependent
 */

import { initializeGame, getTestDeck, applyAction, getLegalActions } from '@manacore/engine';
import { GreedyBot } from '../../packages/ai/src/bots/GreedyBot';
import { RandomBot } from '../../packages/ai/src/bots/RandomBot';

const GAME_COUNT = 50;
const MAX_TURNS = 100;

interface GameResult {
  winner: 'player' | 'opponent' | null;
  turns: number;
  playerLife: number;
  opponentLife: number;
  playerLibrary: number;
  opponentLibrary: number;
  reason: string;
}

const results: GameResult[] = [];

console.log('🎮 Red vs Green Matchup Test');
console.log(`Running ${GAME_COUNT} games: GreedyBot (Green) vs RandomBot (Red)\n`);

for (let gameNum = 0; gameNum < GAME_COUNT; gameNum++) {
  const greenDeck = getTestDeck('green');
  const redDeck = getTestDeck('red');

  let state = initializeGame(greenDeck, redDeck, 12345 + gameNum);

  const greedyBot = new GreedyBot(42 + gameNum);
  const randomBot = new RandomBot(43 + gameNum);

  let turnCount = 0;

  while (!state.gameOver && turnCount < MAX_TURNS) {
    if (state.turnCount > turnCount) {
      turnCount = state.turnCount;
    }

    const legalActions = getLegalActions(state, state.priorityPlayer);
    if (legalActions.length === 0) break;

    const bot = state.priorityPlayer === 'player' ? greedyBot : randomBot;
    const action = bot.chooseAction(state, state.priorityPlayer);

    state = applyAction(state, action);
  }

  // Determine why game ended
  let reason = 'unknown';
  if (state.gameOver) {
    const player = state.players.player;
    const opponent = state.players.opponent;
    
    if (player.life <= 0) reason = 'life-loss-player';
    else if (opponent.life <= 0) reason = 'life-loss-opponent';
    else if (player.attemptedDrawFromEmptyLibrary) reason = 'decked-player';
    else if (opponent.attemptedDrawFromEmptyLibrary) reason = 'decked-opponent';
    else reason = 'other-win-condition';
  } else {
    reason = 'turn-limit';
  }

  results.push({
    winner: state.winner,
    turns: state.turnCount,
    playerLife: state.players.player.life,
    opponentLife: state.players.opponent.life,
    playerLibrary: state.players.player.library.length,
    opponentLibrary: state.players.opponent.library.length,
    reason,
  });

  if ((gameNum + 1) % 10 === 0) {
    console.log(`  Progress: ${gameNum + 1}/${GAME_COUNT} games`);
  }
}

// Analyze results
const wins = results.filter(r => r.winner === 'player').length;
const losses = results.filter(r => r.winner === 'opponent').length;
const draws = results.filter(r => r.winner === null).length;

const avgTurns = results.reduce((sum, r) => sum + r.turns, 0) / results.length;
const minTurns = Math.min(...results.map(r => r.turns));
const maxTurns = Math.max(...results.map(r => r.turns));

// Win reasons breakdown
const reasonCounts = results.reduce((acc, r) => {
  acc[r.reason] = (acc[r.reason] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

console.log('\n' + '='.repeat(60));
console.log('RESULTS: GreedyBot (Green) vs RandomBot (Red)');
console.log('='.repeat(60));
console.log(`Games: ${GAME_COUNT}`);
console.log(`Turns: ${minTurns}-${maxTurns} (avg ${avgTurns.toFixed(1)})`);
console.log('');
console.log('Win/Loss/Draw:');
console.log(`  GreedyBot wins: ${wins} (${((wins / GAME_COUNT) * 100).toFixed(1)}%)`);
console.log(`  RandomBot wins: ${losses} (${((losses / GAME_COUNT) * 100).toFixed(1)}%)`);
console.log(`  Draws:          ${draws} (${((draws / GAME_COUNT) * 100).toFixed(1)}%)`);
console.log('');
console.log('Game End Reasons:');
for (const [reason, count] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${reason.padEnd(25)} ${count} (${((count / GAME_COUNT) * 100).toFixed(1)}%)`);
}

// Detailed stats for draws
const drawGames = results.filter(r => r.winner === null);
if (drawGames.length > 0) {
  const avgDrawTurns = drawGames.reduce((sum, r) => sum + r.turns, 0) / drawGames.length;
  const avgDrawPlayerLife = drawGames.reduce((sum, r) => sum + r.playerLife, 0) / drawGames.length;
  const avgDrawOpponentLife = drawGames.reduce((sum, r) => sum + r.opponentLife, 0) / drawGames.length;
  const avgDrawPlayerLibrary = drawGames.reduce((sum, r) => sum + r.playerLibrary, 0) / drawGames.length;
  const avgDrawOpponentLibrary = drawGames.reduce((sum, r) => sum + r.opponentLibrary, 0) / drawGames.length;

  console.log('');
  console.log('Draw Game Stats:');
  console.log(`  Average turns:        ${avgDrawTurns.toFixed(1)}`);
  console.log(`  Average life (P/O):   ${avgDrawPlayerLife.toFixed(1)} / ${avgDrawOpponentLife.toFixed(1)}`);
  console.log(`  Average library (P/O): ${avgDrawPlayerLibrary.toFixed(1)} / ${avgDrawOpponentLibrary.toFixed(1)}`);
}

// Detailed stats for wins
const winGames = results.filter(r => r.winner !== null);
if (winGames.length > 0) {
  const avgWinTurns = winGames.reduce((sum, r) => sum + r.turns, 0) / winGames.length;
  
  console.log('');
  console.log('Decisive Game Stats:');
  console.log(`  Average turns: ${avgWinTurns.toFixed(1)}`);
}

console.log('\n' + '='.repeat(60));
