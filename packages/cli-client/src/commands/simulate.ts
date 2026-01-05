/**
 * Game simulation - run bot vs bot games
 *
 * Features:
 * - Runs multiple bot vs bot games
 * - Tracks deck/matchup statistics
 * - Verbose mode with state snapshots on errors
 */

import type { Bot } from '@manacore/ai';
import type { PlayerId, DeckColor, GameState, Action } from '@manacore/engine';
import {
  initializeGame,
  getTestDeck,
  applyAction,
  getLegalActions,
  describeAction,
  CardLoader,
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
  options: SimulationOptions,
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

  console.log(
    `\n🎮 Running ${options.gameCount} games: ${playerBot.getName()} vs ${opponentBot.getName()}\n`,
  );

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

      // Enhanced error reporting with state snapshots
      if (error instanceof GameError) {
        console.error(`\n  Error in game ${i + 1}:`);
        console.error(`    ${error.message}`);

        if (options.verbose) {
          // Print full state snapshot to console
          const snapshot = generateStateSnapshot(error.state, error.recentActions, error);
          console.error(snapshot);

          // Write to file for later analysis
          const filename = await writeErrorSnapshot(
            i + 1,
            error.state,
            error.recentActions,
            error,
            error.seed,
          );
          if (filename) {
            console.error(`    State snapshot saved to: ${filename}`);
          }
        } else {
          // Even in non-verbose mode, provide useful debugging hints
          console.error(
            `    State: turn=${error.state.turnCount}, phase=${error.state.phase}, step=${error.state.step}`,
          );
          console.error(`    Seed: ${error.seed ?? 'random'} (use --verbose for full snapshot)`);
        }
      } else if (options.verbose) {
        console.error(`  Error in game ${i + 1}:`, error);
      }
    }
  }

  results.averageTurns = results.gamesCompleted > 0 ? totalTurns / results.gamesCompleted : 0;

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
 * Error with additional game context
 */
class GameError extends Error {
  constructor(
    message: string,
    public readonly state: GameState,
    public readonly recentActions: Action[],
    public readonly seed: number | undefined,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

/**
 * Run a single game to completion
 */
async function runSingleGame(
  playerBot: Bot,
  opponentBot: Bot,
  options: { maxTurns: number; verbose: boolean; seed?: number },
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

  // Track recent actions for debugging
  const recentActions: Action[] = [];
  const MAX_RECENT_ACTIONS = 50;

  while (!state.gameOver && turnCount < maxTurns) {
    // Get the bot with priority (Phase 1+: priority determines who can act)
    const priorityBot = state.priorityPlayer === 'player' ? playerBot : opponentBot;

    // Get legal actions for the player with priority
    const legalActions = getLegalActions(state, state.priorityPlayer);

    if (legalActions.length === 0) {
      // No legal actions - this is a bug! Throw with context
      const error = new GameError(
        `No legal actions for ${state.priorityPlayer} (phase=${state.phase}, step=${state.step})`,
        state,
        recentActions,
        options.seed,
      );
      throw error;
    }

    // Bot chooses action
    const action = priorityBot.chooseAction(state, state.priorityPlayer);

    // Track action for debugging
    recentActions.push(action);
    if (recentActions.length > MAX_RECENT_ACTIONS) {
      recentActions.shift();
    }

    // Apply action
    try {
      state = applyAction(state, action);
    } catch (error) {
      // Wrap error with game context
      const gameError = new GameError(
        error instanceof Error ? error.message : String(error),
        state,
        recentActions,
        options.seed,
      );
      throw gameError;
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
export function printResults(
  results: SimulationResults,
  _playerName: string,
  _opponentName: string,
): void {
  console.log('\n' + '═'.repeat(60));
  console.log('  SIMULATION RESULTS');
  console.log('═'.repeat(60));
  console.log(`Games: ${results.gamesCompleted}/${results.totalGames} | Errors: ${results.errors}`);
  console.log(
    `Turns: ${results.minTurns}-${results.maxTurns} (avg ${results.averageTurns.toFixed(1)})`,
  );
  console.log('');

  // Overall wins
  console.log('─'.repeat(60));
  console.log('  OVERALL');
  console.log('─'.repeat(60));
  console.log(
    `P1 wins: ${results.playerWins} (${pct(results.playerWins, results.gamesCompleted)}) | P2 wins: ${results.opponentWins} (${pct(results.opponentWins, results.gamesCompleted)}) | Draws: ${results.draws} (${pct(results.draws, results.gamesCompleted)})`,
  );

  // Deck performance
  console.log('');
  console.log('─'.repeat(60));
  console.log('  DECK PERFORMANCE');
  console.log('─'.repeat(60));

  const deckOrder: DeckColor[] = ['white', 'blue', 'black', 'red', 'green'];
  const colorEmoji: Record<DeckColor, string> = {
    white: '⬜',
    blue: '🟦',
    black: '⬛',
    red: '🟥',
    green: '🟩',
  };

  // Sort by win rate
  const sortedDecks = deckOrder
    .filter((color) => results.deckStats[color].games > 0)
    .sort((a, b) => {
      const aRate = results.deckStats[a].wins / results.deckStats[a].games;
      const bRate = results.deckStats[b].wins / results.deckStats[b].games;
      return bRate - aRate;
    });

  for (const color of sortedDecks) {
    const stats = results.deckStats[color];
    const winRate = pct(stats.wins, stats.games);
    const name = color.charAt(0).toUpperCase() + color.slice(1);
    console.log(
      `${colorEmoji[color]} ${name.padEnd(6)} ${stats.wins}W-${stats.losses}L-${stats.draws}D (${winRate}) [${stats.games} games]`,
    );
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
      console.log(
        `${matchup}: ${stats.wins}W-${stats.losses}L-${stats.draws}D (${pct(stats.wins, total)}) [${total}x]`,
      );
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

/**
 * Generate a detailed state snapshot for debugging
 */
function generateStateSnapshot(state: GameState, recentActions: Action[], error: Error): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═'.repeat(80));
  lines.push('  ERROR STATE SNAPSHOT');
  lines.push('═'.repeat(80));
  lines.push('');

  // Error details
  lines.push('ERROR:');
  lines.push(`  ${error.message}`);
  lines.push('');

  // Game state summary
  lines.push('GAME STATE:');
  lines.push(`  Turn: ${state.turnCount}`);
  lines.push(`  Phase: ${state.phase}`);
  lines.push(`  Step: ${state.step || 'N/A'}`);
  lines.push(`  Active Player: ${state.activePlayer}`);
  lines.push(`  Priority Player: ${state.priorityPlayer}`);
  lines.push(`  Game Over: ${state.gameOver}`);
  lines.push(`  Winner: ${state.winner || 'none'}`);
  lines.push('');

  // Player states
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    lines.push(`${playerId.toUpperCase()}:`);
    lines.push(`  Life: ${player.life}`);
    lines.push(`  Hand: ${player.hand.length} cards`);
    lines.push(`  Library: ${player.library.length} cards`);
    lines.push(`  Graveyard: ${player.graveyard.length} cards`);
    lines.push(`  Battlefield: ${player.battlefield.length} permanents`);

    // List battlefield permanents
    if (player.battlefield.length > 0) {
      lines.push('    Permanents:');
      for (const card of player.battlefield) {
        const template = CardLoader.getById(card.scryfallId);
        const name = template?.name || 'Unknown';
        const status: string[] = [];
        if (card.tapped) status.push('tapped');
        if (card.attacking) status.push('attacking');
        if (card.blocking) status.push('blocking');
        if (card.summoningSick) status.push('sick');
        const statusStr = status.length > 0 ? ` (${status.join(', ')})` : '';
        lines.push(`      - ${name}${statusStr}`);
      }
    }

    // Mana pool
    const mana = player.manaPool;
    const manaStr = [
      mana.white > 0 ? `${mana.white}W` : '',
      mana.blue > 0 ? `${mana.blue}U` : '',
      mana.black > 0 ? `${mana.black}B` : '',
      mana.red > 0 ? `${mana.red}R` : '',
      mana.green > 0 ? `${mana.green}G` : '',
      mana.colorless > 0 ? `${mana.colorless}C` : '',
    ]
      .filter(Boolean)
      .join(' ');
    lines.push(`  Mana Pool: ${manaStr || 'empty'}`);
    lines.push('');
  }

  // Stack
  if (state.stack.length > 0) {
    lines.push('STACK:');
    for (const item of state.stack) {
      const template = CardLoader.getById(item.card.scryfallId);
      lines.push(`  - ${template?.name || 'Unknown'} (controller: ${item.controller})`);
    }
    lines.push('');
  }

  // Recent actions
  if (recentActions.length > 0) {
    lines.push('RECENT ACTIONS (last 10):');
    const actionsToShow = recentActions.slice(-10);
    for (let i = 0; i < actionsToShow.length; i++) {
      const action = actionsToShow[i]!;
      const desc = describeAction(action, state);
      lines.push(`  ${i + 1}. [${action.playerId}] ${desc}`);
    }
    lines.push('');
  }

  // Legal actions at time of error
  lines.push('LEGAL ACTIONS FOR PRIORITY PLAYER:');
  const legalActions = getLegalActions(state, state.priorityPlayer);
  if (legalActions.length === 0) {
    lines.push('  (NONE - this is the problem!)');
  } else {
    for (const action of legalActions.slice(0, 10)) {
      lines.push(`  - ${describeAction(action, state)}`);
    }
    if (legalActions.length > 10) {
      lines.push(`  ... and ${legalActions.length - 10} more`);
    }
  }
  lines.push('');

  lines.push('═'.repeat(80));

  return lines.join('\n');
}

/**
 * Write state snapshot to a file for later analysis
 */
async function writeErrorSnapshot(
  gameIndex: number,
  state: GameState,
  recentActions: Action[],
  error: Error,
  seed: number | undefined,
): Promise<string> {
  const snapshot = generateStateSnapshot(state, recentActions, error);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `error-snapshot-game${gameIndex}-${timestamp}.txt`;

  // Add seed info for reproducibility
  const header = [
    `Seed: ${seed ?? 'random'}`,
    `Game Index: ${gameIndex}`,
    `Timestamp: ${new Date().toISOString()}`,
    '',
  ].join('\n');

  try {
    await Bun.write(filename, header + snapshot);
    return filename;
  } catch {
    // If we can't write to file, just return empty string
    return '';
  }
}
