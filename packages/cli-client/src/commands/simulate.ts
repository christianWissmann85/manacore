/**
 * Game simulation - run bot vs bot games
 */

import type { Bot } from '@manacore/ai';
import type { GameState, PlayerId } from '@manacore/engine';
import {
  initializeGame,
  createVanillaDeck,
  applyAction,
  getLegalActions,
} from '@manacore/engine';

export interface SimulationOptions {
  gameCount: number;
  maxTurns?: number;
  verbose?: boolean;
  seed?: number;
}

export interface SimulationResults {
  totalGames: number;
  playerWins: number;
  opponentWins: number;
  draws: number;
  averageTurns: number;
  errors: number;
  gamesCompleted: number;
}

/**
 * Run multiple games between two bots
 */
export async function runSimulation(
  playerBot: Bot,
  opponentBot: Bot,
  options: SimulationOptions
): Promise<SimulationResults> {
  const results: SimulationResults = {
    totalGames: options.gameCount,
    playerWins: 0,
    opponentWins: 0,
    draws: 0,
    averageTurns: 0,
    errors: 0,
    gamesCompleted: 0,
  };

  let totalTurns = 0;

  console.log(`\n🎮 Running ${options.gameCount} games: ${playerBot.getName()} vs ${opponentBot.getName()}\n`);

  for (let i = 0; i < options.gameCount; i++) {
    if (i % 10 === 0) {
      console.log(`  Progress: ${i}/${options.gameCount} games`);
    }

    try {
      const seed = options.seed !== undefined ? options.seed + i : undefined;
      const gameResult = await runSingleGame(playerBot, opponentBot, {
        maxTurns: options.maxTurns || 100,
        verbose: options.verbose || false,
        seed,
      });

      results.gamesCompleted++;
      totalTurns += gameResult.turns;

      if (gameResult.winner === 'player') {
        results.playerWins++;
      } else if (gameResult.winner === 'opponent') {
        results.opponentWins++;
      } else {
        results.draws++;
      }
    } catch (error) {
      results.errors++;
      if (options.verbose) {
        console.error(`  Error in game ${i + 1}:`, error);
      }
    }
  }

  results.averageTurns = results.gamesCompleted > 0
    ? totalTurns / results.gamesCompleted
    : 0;

  return results;
}

/**
 * Run a single game to completion
 */
async function runSingleGame(
  playerBot: Bot,
  opponentBot: Bot,
  options: { maxTurns: number; verbose: boolean; seed?: number }
): Promise<{ winner: PlayerId | null; turns: number }> {
  // Create decks
  const playerDeck = createVanillaDeck();
  const opponentDeck = createVanillaDeck();

  // Initialize game
  let state = initializeGame(playerDeck, opponentDeck, options.seed);

  let turnCount = 0;
  const maxTurns = options.maxTurns;

  while (!state.gameOver && turnCount < maxTurns) {
    // Get the active bot
    const activeBot = state.activePlayer === 'player' ? playerBot : opponentBot;

    // Get legal actions
    const legalActions = getLegalActions(state, state.activePlayer);

    if (legalActions.length === 0) {
      // No legal actions - game is stuck
      if (options.verbose) {
        console.log(`No legal actions for ${state.activePlayer} - ending game`);
      }
      break;
    }

    // Bot chooses action
    const action = activeBot.chooseAction(state, state.activePlayer);

    // Apply action
    try {
      state = applyAction(state, action);
    } catch (error) {
      if (options.verbose) {
        console.error(`Error applying action:`, error);
      }
      throw error;
    }

    // Track turns
    if (state.turnCount > turnCount) {
      turnCount = state.turnCount;
    }

    // Safety check for infinite loops
    if (state.turnCount > maxTurns) {
      if (options.verbose) {
        console.log(`Game exceeded ${maxTurns} turns - declaring draw`);
      }
      break;
    }
  }

  // Determine winner
  let winner: PlayerId | null = null;
  if (state.gameOver && state.winner) {
    winner = state.winner;
  } else {
    // Game didn't complete normally - check life totals
    const playerLife = state.players.player.life;
    const opponentLife = state.players.opponent.life;

    if (playerLife > opponentLife) {
      winner = 'player';
    } else if (opponentLife > playerLife) {
      winner = 'opponent';
    }
    // else it's a draw
  }

  return { winner, turns: turnCount };
}

/**
 * Print simulation results
 */
export function printResults(results: SimulationResults, playerName: string, opponentName: string): void {
  console.log('\n' + '═'.repeat(80));
  console.log('  SIMULATION RESULTS');
  console.log('═'.repeat(80));
  console.log(`Total Games:      ${results.totalGames}`);
  console.log(`Completed:        ${results.gamesCompleted}`);
  console.log(`Errors:           ${results.errors}`);
  console.log('');
  console.log(`${playerName} wins:    ${results.playerWins} (${percentage(results.playerWins, results.gamesCompleted)}%)`);
  console.log(`${opponentName} wins: ${results.opponentWins} (${percentage(results.opponentWins, results.gamesCompleted)}%)`);
  console.log(`Draws:            ${results.draws} (${percentage(results.draws, results.gamesCompleted)}%)`);
  console.log('');
  console.log(`Average Turns:    ${results.averageTurns.toFixed(1)}`);
  console.log('═'.repeat(80));
  console.log('');

  if (results.errors > 0) {
    console.log(`⚠️  ${results.errors} games encountered errors`);
  }

  if (results.gamesCompleted === results.totalGames && results.errors === 0) {
    console.log('✅ All games completed successfully!');
  }
}

/**
 * Calculate percentage
 */
function percentage(part: number, total: number): string {
  if (total === 0) return '0.0';
  return ((part / total) * 100).toFixed(1);
}
