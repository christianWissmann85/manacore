/**
 * Training Data Collection Command
 *
 * Collects (state, action, outcome) tuples for ML training using
 * a curriculum-based approach:
 *
 * Phase 1: MCTSBot vs RandomBot (easy - clear winning signals)
 * Phase 2: MCTSBot vs GreedyBot (medium - competitive games)
 * Phase 3: MCTSBot vs MCTSBot (hard - high-quality play)
 *
 * Records only the winner's decisions for highest quality data.
 */

import {
  TrainingDataCollector,
  saveTrainingData,
  mergeTrainingData,
  toTensorFormat,
  FEATURE_VECTOR_SIZE,
  type GameTrainingData,
  type TensorData,
  type Bot,
} from '@manacore/ai';
import { createBot, type BotType } from '../botFactory';
import {
  initializeGame,
  getLegalActions,
  applyAction,
  ALL_TEST_DECKS,
  type PlayerId,
  type CardTemplate,
} from '@manacore/engine';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { getTrainingDataDir } from '../output/paths';

/**
 * Curriculum phase configuration
 */
export interface CurriculumPhase {
  name: string;
  description: string;
  p1Bot: BotType;
  p2Bot: BotType;
  gamesRatio: number; // Fraction of total games for this phase
}

/**
 * Default curriculum: progressive difficulty
 */
export const DEFAULT_CURRICULUM: CurriculumPhase[] = [
  {
    name: 'easy',
    description: 'MCTS-Eval-Fast vs RandomBot - Clear winning signals',
    p1Bot: 'mcts-eval-fast', // 50 iterations, no rollout
    p2Bot: 'random',
    gamesRatio: 0.2, // 20% of games
  },
  {
    name: 'medium',
    description: 'MCTS-Eval-Fast vs GreedyBot - Competitive games',
    p1Bot: 'mcts-eval-fast', // 50 iterations, no rollout
    p2Bot: 'greedy',
    gamesRatio: 0.3, // 30% of games
  },
  {
    name: 'hard',
    description: 'MCTS-Eval vs MCTS-Eval-Fast - High-quality play',
    p1Bot: 'mcts-eval', // 200 iterations, no rollout
    p2Bot: 'mcts-eval-fast', // 50 iterations, no rollout
    gamesRatio: 0.5, // 50% of games
  },
];

/**
 * Fast curriculum: uses GreedyBot instead of MCTS for speed
 */
export const FAST_CURRICULUM: CurriculumPhase[] = [
  {
    name: 'fast-easy',
    description: 'GreedyBot vs RandomBot - Fast baseline data',
    p1Bot: 'greedy',
    p2Bot: 'random',
    gamesRatio: 0.3, // 30% of games
  },
  {
    name: 'fast-medium',
    description: 'GreedyBot vs GreedyBot - Balanced play',
    p1Bot: 'greedy',
    p2Bot: 'greedy',
    gamesRatio: 0.7, // 70% of games
  },
];

/**
 * Collection options
 */
export interface CollectTrainingOptions {
  /** Total games to collect */
  games: number;

  /** Experiment name for output directory */
  name?: string;

  /** Output directory (legacy - use name instead) */
  output: string;

  /** Base seed for reproducibility */
  seed: number;

  /** MCTS iterations for bots */
  mctsIterations: number;

  /** Max turns per game */
  maxTurns: number;

  /** Custom curriculum (or use default) */
  curriculum?: CurriculumPhase[];

  /** Skip JSON export (only binary) */
  noBinaryExport: boolean;

  /** Skip binary export (only JSON) */
  noJsonExport: boolean;

  /** Verbose output */
  verbose: boolean;

  /** Single phase only (easy, medium, hard, fast-easy, fast-medium) */
  phase?: 'easy' | 'medium' | 'hard' | 'fast-easy' | 'fast-medium';

  /** Use fast curriculum (GreedyBot instead of MCTS) */
  fast: boolean;
}

/**
 * Default options
 */
export const DEFAULT_COLLECT_OPTIONS: CollectTrainingOptions = {
  games: 500,
  name: 'training',
  output: 'training-data', // Legacy, ignored when using centralized paths
  seed: Date.now(),
  mctsIterations: 100,
  maxTurns: 100,
  noBinaryExport: false,
  noJsonExport: false,
  verbose: false,
  fast: false,
};

/**
 * Collection statistics
 */
interface CollectionStats {
  phase: string;
  gamesPlayed: number;
  gamesCompleted: number;
  errors: number;
  p1Wins: number;
  p2Wins: number;
  draws: number;
  totalSamples: number;
  avgSamplesPerGame: number;
  avgTurns: number;
  durationMs: number;
}

/**
 * Get a deck based on seed (deterministic selection)
 */
function getSeededDeck(seed: number): CardTemplate[] {
  const deckNames = Object.keys(ALL_TEST_DECKS) as (keyof typeof ALL_TEST_DECKS)[];
  const index = Math.abs(seed) % deckNames.length;
  const deckName = deckNames[index];
  if (!deckName) {
    // Fallback to first deck if somehow undefined
    return ALL_TEST_DECKS[deckNames[0]!]();
  }
  return ALL_TEST_DECKS[deckName]();
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Format bytes
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Print progress bar
 */
function printProgress(
  current: number,
  total: number,
  phase: string,
  stats: Partial<CollectionStats>,
): void {
  const pct = Math.floor((current / total) * 100);
  const barWidth = 30;
  const filled = Math.floor((pct / 100) * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

  const winRate =
    stats.p1Wins && stats.gamesCompleted
      ? ((stats.p1Wins / stats.gamesCompleted) * 100).toFixed(0)
      : '0';

  process.stdout.write(
    `\r  [${bar}] ${pct}% | ${current}/${total} games | Phase: ${phase} | P1 Win: ${winRate}% | Samples: ${stats.totalSamples || 0}`,
  );
}

/**
 * Run a single game and collect training data
 */
function runGameWithCollection(
  p1Bot: Bot,
  p2Bot: Bot,
  seed: number,
  maxTurns: number,
): { data: GameTrainingData | null; winner: PlayerId | null; turns: number; error?: string } {
  try {
    const p1Deck = getSeededDeck(seed);
    const p2Deck = getSeededDeck(seed + 1000000);
    let state = initializeGame(p1Deck, p2Deck, seed);

    // Create collector - we'll filter to winner's decisions at the end
    const collector = new TrainingDataCollector(seed, p1Bot.getName(), p2Bot.getName(), {
      recordPlayer: 'both',
      skipPassPriority: true,
    });

    let actionCount = 0;
    const maxActions = maxTurns * 100; // Safety limit

    while (!state.gameOver && actionCount < maxActions) {
      const bot = state.priorityPlayer === 'player' ? p1Bot : p2Bot;
      const legalActions = getLegalActions(state, state.priorityPlayer);

      if (legalActions.length === 0) {
        // No legal actions - this shouldn't happen but handle gracefully
        console.error(
          `Warning: No legal actions for ${state.priorityPlayer} (phase=${state.phase})`,
        );
        break;
      }

      const action = bot.chooseAction(state, state.priorityPlayer);
      collector.recordDecision(state, action, legalActions);
      state = applyAction(state, action);
      actionCount++;
    }

    // Finalize and filter to winner only
    const fullData = collector.finalize(state);

    // If there's a winner, filter samples to only include winner's decisions
    if (state.winner) {
      const winnerSamples = fullData.samples.filter((s) => s.playerId === state.winner);
      fullData.samples = winnerSamples;
      fullData.totalActions = winnerSamples.length;
    } else {
      // Draw - include no samples (or could include both, but winner-only means skip draws)
      fullData.samples = [];
      fullData.totalActions = 0;
    }

    return {
      data: fullData.samples.length > 0 ? fullData : null,
      winner: state.winner,
      turns: state.turnCount,
    };
  } catch (error) {
    return {
      data: null,
      winner: null,
      turns: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run collection for a single curriculum phase
 */
function runPhase(
  phase: CurriculumPhase,
  numGames: number,
  baseSeed: number,
  options: CollectTrainingOptions,
  outputDir: string,
): { stats: CollectionStats; games: GameTrainingData[] } {
  const startTime = performance.now();
  const games: GameTrainingData[] = [];
  const stats: CollectionStats = {
    phase: phase.name,
    gamesPlayed: 0,
    gamesCompleted: 0,
    errors: 0,
    p1Wins: 0,
    p2Wins: 0,
    draws: 0,
    totalSamples: 0,
    avgSamplesPerGame: 0,
    avgTurns: 0,
    durationMs: 0,
  };

  let totalTurns = 0;

  for (let i = 0; i < numGames; i++) {
    const seed = baseSeed + i;
    const p1Bot = createBot(phase.p1Bot, seed);
    const p2Bot = createBot(phase.p2Bot, seed + 500000);

    const result = runGameWithCollection(p1Bot, p2Bot, seed, options.maxTurns);
    stats.gamesPlayed++;

    if (result.error) {
      stats.errors++;
      if (options.verbose) {
        console.log(`\n  ⚠️  Game ${seed} error: ${result.error}`);
      }
      continue;
    }

    stats.gamesCompleted++;
    totalTurns += result.turns;

    if (result.winner === 'player') {
      stats.p1Wins++;
    } else if (result.winner === 'opponent') {
      stats.p2Wins++;
    } else {
      stats.draws++;
    }

    if (result.data) {
      games.push(result.data);
      stats.totalSamples += result.data.samples.length;

      // Save individual game file (JSON only for games/)
      if (!options.noJsonExport) {
        const gameFile = join(outputDir, 'games', `${phase.name}-${seed}.json`);
        saveTrainingData(result.data, gameFile);
      }
    }

    // Update progress
    if (!options.verbose) {
      printProgress(i + 1, numGames, phase.name, stats);
    }
  }

  stats.avgSamplesPerGame =
    stats.gamesCompleted > 0 ? stats.totalSamples / stats.gamesCompleted : 0;
  stats.avgTurns = stats.gamesCompleted > 0 ? totalTurns / stats.gamesCompleted : 0;
  stats.durationMs = performance.now() - startTime;

  if (!options.verbose) {
    console.log(''); // New line after progress bar
  }

  return { stats, games };
}

/**
 * Export to binary format (TypedArrays stored as base64)
 */
export function exportBinaryFormat(tensors: TensorData, filepath: string): void {
  const numSamples = tensors.features.length;
  const featureSize = FEATURE_VECTOR_SIZE;

  // Flatten features into Float32Array
  const featuresFlat = new Float32Array(numSamples * featureSize);
  for (let i = 0; i < numSamples; i++) {
    const row = tensors.features[i];
    if (row) {
      for (let j = 0; j < featureSize; j++) {
        featuresFlat[i * featureSize + j] = row[j] ?? 0;
      }
    }
  }

  // Actions and outcomes as Int32Array
  const actions = new Int32Array(tensors.actions);
  const actionCounts = new Int32Array(tensors.actionCounts);
  const outcomes = new Int32Array(tensors.outcomes);

  // Convert to base64 for JSON storage (portable binary)
  const binaryData = {
    format: 'manacore-training-v1',
    numSamples,
    featureSize,
    features: Buffer.from(featuresFlat.buffer).toString('base64'),
    actions: Buffer.from(actions.buffer).toString('base64'),
    actionCounts: Buffer.from(actionCounts.buffer).toString('base64'),
    outcomes: Buffer.from(outcomes.buffer).toString('base64'),
  };

  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filepath, JSON.stringify(binaryData), 'utf-8');
}

/**
 * Load binary format back to TensorData
 */
export function loadBinaryFormat(filepath: string): TensorData {
  const raw = JSON.parse(readFileSync(filepath, 'utf-8')) as {
    numSamples: number;
    featureSize: number;
    features: string;
    actions: string;
    actionCounts: string;
    outcomes: string;
  };

  const numSamples = raw.numSamples;
  const featureSize = raw.featureSize;

  const featuresFlat = new Float32Array(Buffer.from(raw.features, 'base64').buffer);
  const actionsFlat = new Int32Array(Buffer.from(raw.actions, 'base64').buffer);
  const actionCountsFlat = new Int32Array(Buffer.from(raw.actionCounts, 'base64').buffer);
  const outcomesFlat = new Int32Array(Buffer.from(raw.outcomes, 'base64').buffer);

  // Unflatten features
  const features: number[][] = [];
  for (let i = 0; i < numSamples; i++) {
    const row: number[] = [];
    for (let j = 0; j < featureSize; j++) {
      row.push(featuresFlat[i * featureSize + j] ?? 0);
    }
    features.push(row);
  }

  return {
    features,
    actions: Array.from(actionsFlat),
    actionCounts: Array.from(actionCountsFlat),
    outcomes: Array.from(outcomesFlat),
  };
}

/**
 * Run the complete training data collection
 */
export async function runCollectTraining(
  options: Partial<CollectTrainingOptions> = {},
): Promise<void> {
  const opts = { ...DEFAULT_COLLECT_OPTIONS, ...options };
  const startTime = performance.now();

  // Determine curriculum
  const baseCurriculum = opts.fast ? FAST_CURRICULUM : opts.curriculum || DEFAULT_CURRICULUM;
  let curriculum = baseCurriculum;
  if (opts.phase) {
    // Filter from both curriculums if phase specified
    const allPhases = [...DEFAULT_CURRICULUM, ...FAST_CURRICULUM];
    curriculum = allPhases.filter((p) => p.name === opts.phase);
    if (curriculum.length === 0) {
      console.error(`❌ Unknown phase: ${opts.phase}`);
      console.error(`   Available: easy, medium, hard, fast-easy, fast-medium`);
      return;
    }
    // Adjust ratio for single phase
    const firstPhase = curriculum[0];
    if (firstPhase) {
      curriculum[0] = {
        name: firstPhase.name,
        description: firstPhase.description,
        p1Bot: firstPhase.p1Bot,
        p2Bot: firstPhase.p2Bot,
        gamesRatio: 1.0,
      };
    }
  }

  // Setup output directory using centralized paths
  const experimentName = opts.name || 'training';
  const outputDir = getTrainingDataDir(experimentName);

  // Header
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('              TRAINING DATA COLLECTION');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Output: ${outputDir}`);
  console.log(`  Games: ${opts.games}`);
  console.log(`  Seed: ${opts.seed}`);
  console.log(`  MCTS Iterations: ${opts.mctsIterations}`);
  console.log(`  Recording: Winner's decisions only`);
  console.log('');
  console.log('  Curriculum:');
  for (const phase of curriculum) {
    const numGames = Math.round(opts.games * phase.gamesRatio);
    console.log(`    ${phase.name}: ${phase.description} (${numGames} games)`);
  }
  console.log('');
  console.log('──────────────────────────────────────────────────────────────────');

  // Run each phase
  const allGames: GameTrainingData[] = [];
  const allStats: CollectionStats[] = [];
  let seedOffset = 0;

  for (const phase of curriculum) {
    const numGames = Math.round(opts.games * phase.gamesRatio);
    if (numGames === 0) continue;

    console.log(`\n📊 Phase: ${phase.name} (${numGames} games)`);
    console.log(`   ${phase.description}`);

    const { stats, games } = runPhase(phase, numGames, opts.seed + seedOffset, opts, outputDir);

    allStats.push(stats);
    allGames.push(...games);
    seedOffset += numGames;

    // Phase summary
    console.log(`   ✓ Completed: ${stats.gamesCompleted}/${stats.gamesPlayed} games`);
    console.log(`   ✓ Samples: ${stats.totalSamples} (${stats.avgSamplesPerGame.toFixed(1)}/game)`);
    console.log(`   ✓ P1 Win Rate: ${((stats.p1Wins / stats.gamesCompleted) * 100).toFixed(1)}%`);
    console.log(`   ✓ Duration: ${formatDuration(stats.durationMs)}`);
  }

  // Merge all games
  console.log('\n──────────────────────────────────────────────────────────────────');
  console.log('\n📦 Merging and exporting...');

  const merged = mergeTrainingData(allGames);

  // Build tensors from all games (toTensorFormat expects single game)
  const mergedTensors: TensorData = {
    features: [],
    actions: [],
    actionCounts: [],
    outcomes: [],
  };

  for (const game of allGames) {
    const gameTensors = toTensorFormat(game);
    mergedTensors.features.push(...gameTensors.features);
    mergedTensors.actions.push(...gameTensors.actions);
    mergedTensors.actionCounts.push(...gameTensors.actionCounts);
    mergedTensors.outcomes.push(...gameTensors.outcomes);
  }

  // Export JSON
  if (!opts.noJsonExport) {
    const jsonPath = join(outputDir, 'tensors.json');
    writeFileSync(jsonPath, JSON.stringify(mergedTensors, null, 2), 'utf-8');
    const jsonSize = Buffer.byteLength(JSON.stringify(mergedTensors));
    console.log(`   ✓ JSON: ${jsonPath} (${formatBytes(jsonSize)})`);
  }

  // Export binary
  if (!opts.noBinaryExport) {
    const binPath = join(outputDir, 'tensors.bin.json');
    exportBinaryFormat(mergedTensors, binPath);
    const binSize = Buffer.byteLength(readFileSync(binPath));
    console.log(`   ✓ Binary: ${binPath} (${formatBytes(binSize)})`);
  }

  // Save stats
  const statsPath = join(outputDir, 'stats.json');
  const finalStats = {
    timestamp: new Date().toISOString(),
    config: opts,
    phases: allStats,
    totals: {
      games: allGames.length,
      samples: merged.metadata.totalSamples,
      wins: merged.metadata.wins,
      losses: merged.metadata.losses,
      draws: merged.metadata.draws,
      avgSamplesPerGame: merged.metadata.totalSamples / Math.max(1, allGames.length),
    },
    durationMs: performance.now() - startTime,
  };
  writeFileSync(statsPath, JSON.stringify(finalStats, null, 2), 'utf-8');
  console.log(`   ✓ Stats: ${statsPath}`);

  // Final summary
  const totalDuration = performance.now() - startTime;
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('                    COLLECTION COMPLETE');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`  Total Games: ${allGames.length}`);
  console.log(`  Total Samples: ${merged.metadata.totalSamples}`);
  console.log(
    `  Avg Samples/Game: ${(merged.metadata.totalSamples / Math.max(1, allGames.length)).toFixed(1)}`,
  );
  console.log(
    `  Win/Loss/Draw: ${merged.metadata.wins}/${merged.metadata.losses}/${merged.metadata.draws}`,
  );
  console.log(`  Total Duration: ${formatDuration(totalDuration)}`);
  console.log(`  Games/Second: ${(allGames.length / (totalDuration / 1000)).toFixed(1)}`);
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('');
}

/**
 * Parse command line arguments
 */
export function parseCollectTrainingArgs(args: string[]): Partial<CollectTrainingOptions> {
  const options: Partial<CollectTrainingOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--games':
      case '-g':
        options.games = parseInt(args[++i] || '500', 10);
        break;
      case '--output':
      case '-o':
        options.output = args[++i] || 'training-data';
        break;
      case '--seed':
      case '-s':
        options.seed = parseInt(args[++i] || String(Date.now()), 10);
        break;
      case '--iterations':
        options.mctsIterations = parseInt(args[++i] || '100', 10);
        break;
      case '--max-turns':
        options.maxTurns = parseInt(args[++i] || '100', 10);
        break;
      case '--phase': {
        const phase = args[++i];
        if (phase === 'easy' || phase === 'medium' || phase === 'hard') {
          options.phase = phase;
        }
        break;
      }
      case '--no-json':
        options.noJsonExport = true;
        break;
      case '--no-binary':
        options.noBinaryExport = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--fast':
      case '-f':
        options.fast = true;
        break;
    }
  }

  return options;
}
