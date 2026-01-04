/**
 * Game simulation - run bot vs bot games
 */

import type { Bot } from '@manacore/ai';
import type { PlayerId, DeckColor } from '@manacore/engine';
import {
  initializeGame,
  getTestDeck,
  applyAction,
  getLegalActions,
} from '@manacore/engine';

const DECK_COLORS: DeckColor[] = ['white', 'blue', 'black', 'red', 'green'];

function getRandomDeckColor(): DeckColor {
  return DECK_COLORS[Math.floor(Math.random() * DECK_COLORS.length)]!;
}

export interface SimulationOptions {
  gameCount: number;
  maxTurns?: number;
  verbose?: boolean;
  seed?: number;
}

export interface DeckStats {
  wins: number;
  losses: number;
  draws: number;
  games: number;
}

export interface MatchupStats {
  wins: number;
  losses: number;
  draws: number;
}

export interface SimulationResults {
  totalGames: number;
  playerWins: number;
  opponentWins: number;
  draws: number;
  averageTurns: number;
  minTurns: number;
  maxTurns: number;
  errors: number;
  gamesCompleted: number;
  deckStats: Record<DeckColor, DeckStats>;
  matchups: Record<string, MatchupStats>;
}

function createEmptyDeckStats(): DeckStats {
  return { wins: 0, losses: 0, draws: 0, games: 0 };
}

function createEmptyMatchupStats(): MatchupStats {
  return { wins: 0, losses: 0, draws: 0 };
}

function getMatchupKey(color1: DeckColor, color2: DeckColor): string {
  return `${color1} vs ${color2}`;
}

/**
 * Run multiple games between two bots
 */
export async function runSimulation(
  playerBot: Bot,
  opponentBot: Bot,
  options: SimulationOptions
): Promise<SimulationResults> {
  const deckStats: Record<DeckColor, DeckStats> = {
    white: createEmptyDeckStats(),
    blue: createEmptyDeckStats(),
    black: createEmptyDeckStats(),
    red: createEmptyDeckStats(),
    green: createEmptyDeckStats(),
  };

  const matchups: Record<string, MatchupStats> = {};

  const results: SimulationResults = {
    totalGames: options.gameCount,
    playerWins: 0,
    opponentWins: 0,
    draws: 0,
    averageTurns: 0,
    minTurns: Infinity,
    maxTurns: 0,
    errors: 0,
    gamesCompleted: 0,
    deckStats,
    matchups,
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
      results.minTurns = Math.min(results.minTurns, gameResult.turns);
      results.maxTurns = Math.max(results.maxTurns, gameResult.turns);

      const { playerDeck, opponentDeck } = gameResult;
      const matchupKey = getMatchupKey(playerDeck, opponentDeck);

      // Initialize matchup if not exists
      if (!matchups[matchupKey]) {
        matchups[matchupKey] = createEmptyMatchupStats();
      }

      // Track deck games played
      deckStats[playerDeck].games++;
      deckStats[opponentDeck].games++;

      if (gameResult.winner === 'player') {
        results.playerWins++;
        deckStats[playerDeck].wins++;
        deckStats[opponentDeck].losses++;
        matchups[matchupKey].wins++;
      } else if (gameResult.winner === 'opponent') {
        results.opponentWins++;
        deckStats[playerDeck].losses++;
        deckStats[opponentDeck].wins++;
        matchups[matchupKey].losses++;
      } else {
        results.draws++;
        deckStats[playerDeck].draws++;
        deckStats[opponentDeck].draws++;
        matchups[matchupKey].draws++;
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

  if (results.minTurns === Infinity) results.minTurns = 0;

  return results;
}

interface GameResult {
  winner: PlayerId | null;
  turns: number;
  playerDeck: DeckColor;
  opponentDeck: DeckColor;
}

/**
 * Run a single game to completion
 */
async function runSingleGame(
  playerBot: Bot,
  opponentBot: Bot,
  options: { maxTurns: number; verbose: boolean; seed?: number }
): Promise<GameResult> {
  // Create decks - each bot gets a random test deck
  const playerDeckColor = getRandomDeckColor();
  const opponentDeckColor = getRandomDeckColor();
  const playerDeck = getTestDeck(playerDeckColor);
  const opponentDeck = getTestDeck(opponentDeckColor);

  // Initialize game
  let state = initializeGame(playerDeck, opponentDeck, options.seed);

  let turnCount = 0;
  const maxTurns = options.maxTurns;

  while (!state.gameOver && turnCount < maxTurns) {
    // Get the bot with priority (Phase 1+: priority determines who can act)
    const priorityBot = state.priorityPlayer === 'player' ? playerBot : opponentBot;

    // Get legal actions for the player with priority
    const legalActions = getLegalActions(state, state.priorityPlayer);

    if (legalActions.length === 0) {
      // No legal actions - game is stuck
      if (options.verbose) {
        console.log(`No legal actions for ${state.priorityPlayer} - ending game`);
      }
      break;
    }

    // Bot chooses action
    const action = priorityBot.chooseAction(state, state.priorityPlayer);

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

  return {
    winner,
    turns: turnCount,
    playerDeck: playerDeckColor,
    opponentDeck: opponentDeckColor,
  };
}

/**
 * Print simulation results
 */
export function printResults(results: SimulationResults, playerName: string, opponentName: string): void {
  console.log('\n' + '═'.repeat(60));
  console.log('  SIMULATION RESULTS');
  console.log('═'.repeat(60));
  console.log(`Games: ${results.gamesCompleted}/${results.totalGames} | Errors: ${results.errors}`);
  console.log(`Turns: ${results.minTurns}-${results.maxTurns} (avg ${results.averageTurns.toFixed(1)})`);
  console.log('');

  // Overall wins
  console.log('─'.repeat(60));
  console.log('  OVERALL');
  console.log('─'.repeat(60));
  console.log(`P1 wins: ${results.playerWins} (${pct(results.playerWins, results.gamesCompleted)}) | P2 wins: ${results.opponentWins} (${pct(results.opponentWins, results.gamesCompleted)}) | Draws: ${results.draws} (${pct(results.draws, results.gamesCompleted)})`);

  // Deck performance
  console.log('');
  console.log('─'.repeat(60));
  console.log('  DECK PERFORMANCE');
  console.log('─'.repeat(60));

  const deckOrder: DeckColor[] = ['white', 'blue', 'black', 'red', 'green'];
  const colorEmoji: Record<DeckColor, string> = {
    white: '⬜', blue: '🟦', black: '⬛', red: '🟥', green: '🟩'
  };

  // Sort by win rate
  const sortedDecks = deckOrder
    .filter(color => results.deckStats[color].games > 0)
    .sort((a, b) => {
      const aRate = results.deckStats[a].wins / results.deckStats[a].games;
      const bRate = results.deckStats[b].wins / results.deckStats[b].games;
      return bRate - aRate;
    });

  for (const color of sortedDecks) {
    const stats = results.deckStats[color];
    const winRate = pct(stats.wins, stats.games);
    const name = color.charAt(0).toUpperCase() + color.slice(1);
    console.log(`${colorEmoji[color]} ${name.padEnd(6)} ${stats.wins}W-${stats.losses}L-${stats.draws}D (${winRate}) [${stats.games} games]`);
  }

  // Top matchups (if enough data)
  const matchupEntries = Object.entries(results.matchups)
    .filter(([_, stats]) => stats.wins + stats.losses + stats.draws >= 2)
    .sort((a, b) => {
      const aTotal = a[1].wins + a[1].losses + a[1].draws;
      const bTotal = b[1].wins + b[1].losses + b[1].draws;
      return bTotal - aTotal;
    })
    .slice(0, 5);

  if (matchupEntries.length > 0) {
    console.log('');
    console.log('─'.repeat(60));
    console.log('  TOP MATCHUPS (P1 perspective)');
    console.log('─'.repeat(60));
    for (const [matchup, stats] of matchupEntries) {
      const total = stats.wins + stats.losses + stats.draws;
      console.log(`${matchup}: ${stats.wins}W-${stats.losses}L-${stats.draws}D (${pct(stats.wins, total)}) [${total}x]`);
    }
  }

  console.log('═'.repeat(60));

  if (results.errors > 0) {
    console.log(`⚠️  ${results.errors} games encountered errors`);
  }

  if (results.gamesCompleted === results.totalGames && results.errors === 0) {
    console.log('✅ All games completed successfully!');
  }
}

/**
 * Calculate percentage with % suffix
 */
function pct(part: number, total: number): string {
  if (total === 0) return '0%';
  return ((part / total) * 100).toFixed(0) + '%';
}
