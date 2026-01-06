/**
 * MCTS Hyperparameter Tuning Command
 *
 * Tunes MCTS-specific parameters:
 * - explorationConstant (UCB1's C value)
 * - rolloutDepth
 * - rolloutPolicy
 * - epsilon (for epsilon-greedy)
 */

import {
  MCTSTuner,
  formatMCTSTuningResult,
  tuningResultToMCTSParams,
  type MCTSTuningProgress,
  type MCTSTuningResult,
  type MCTSTunerConfig,
  DEFAULT_TUNER_CONFIG,
  loadWeights,
  saveWeights,
  bumpVersion,
  type WeightsFile,
} from '@manacore/ai';

export interface TuneMCTSOptions {
  /** Optimization method: 'grid' or 'coarse-to-fine' */
  method: 'grid' | 'coarse-to-fine';
  /** Games per configuration */
  gamesPerConfig: number;
  /** Games for validation */
  validationGames: number;
  /** Maximum turns per game */
  maxTurns: number;
  /** MCTS iterations during tuning (lower = faster) */
  tuningIterations: number;
  /** Base seed for reproducibility */
  seed: number;
  /** Save results to weights.json */
  save: boolean;
  /** Skip validation (just tune) */
  skipValidation: boolean;
  /** Show verbose output */
  verbose: boolean;
}

const DEFAULT_OPTIONS: TuneMCTSOptions = {
  method: 'coarse-to-fine',
  gamesPerConfig: 50,
  validationGames: 200,
  maxTurns: 100,
  tuningIterations: 50,
  seed: Date.now(),
  save: false,
  skipValidation: false,
  verbose: false,
};

/**
 * Format time in human-readable form
 */
function formatTime(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

/**
 * Print the progress dashboard
 */
function printDashboard(progress: MCTSTuningProgress): void {
  const { phase, currentConfig, totalConfigs, currentGames, totalGames } = progress;
  const { bestSoFar, elapsedMs, estimatedRemainingMs } = progress;

  // Calculate progress percentage
  const pct = totalGames > 0 ? Math.round((currentGames / totalGames) * 100) : 0;
  const barWidth = 30;
  const filled = Math.round((pct / 100) * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

  // Phase label
  const phaseLabel =
    phase === 'grid'
      ? 'Grid Search'
      : phase === 'fine'
        ? 'Fine Tuning'
        : 'Validation';

  // Build dashboard
  const lines: string[] = [];
  lines.push('┌' + '─'.repeat(68) + '┐');
  lines.push(`│  🎯 MCTS Tuning - ${phaseLabel}`.padEnd(69) + '│');
  lines.push('├' + '─'.repeat(68) + '┤');

  if (bestSoFar) {
    const p = bestSoFar.params;
    lines.push(`│  Best Config: C=${p.explorationConstant} D=${p.rolloutDepth} P=${p.rolloutPolicy}`.padEnd(69) + '│');
    lines.push(`│  Win Rate vs GreedyBot: ${(bestSoFar.winRate * 100).toFixed(1)}%`.padEnd(69) + '│');
    lines.push(`│  Avg Time/Game: ${bestSoFar.avgTimeMs.toFixed(0)}ms`.padEnd(69) + '│');
  } else {
    lines.push('│  Evaluating configurations...'.padEnd(69) + '│');
    lines.push('│'.padEnd(69) + '│');
    lines.push('│'.padEnd(69) + '│');
  }

  lines.push('│'.padEnd(69) + '│');
  lines.push(`│  Config: ${currentConfig}/${totalConfigs}`.padEnd(69) + '│');
  lines.push(`│  Progress: [${bar}] ${pct}%`.padEnd(69) + '│');
  lines.push(`│  Elapsed: ${formatTime(elapsedMs)} | Games: ${currentGames}`.padEnd(69) + '│');
  if (estimatedRemainingMs > 0) {
    lines.push(`│  ETA: ${formatTime(estimatedRemainingMs)}`.padEnd(69) + '│');
  } else {
    lines.push('│'.padEnd(69) + '│');
  }
  lines.push('└' + '─'.repeat(68) + '┘');

  // Print (clearing previous dashboard)
  const output = lines.join('\n');
  process.stdout.write('\x1b[' + lines.length + 'A'); // Move up
  process.stdout.write('\x1b[0J'); // Clear below cursor
  console.log(output);
}

/**
 * Print initial dashboard placeholder
 */
function printInitialDashboard(method: string): void {
  const lines: string[] = [];
  lines.push('┌' + '─'.repeat(68) + '┐');
  lines.push(`│  🎯 MCTS Tuning - ${method === 'grid' ? 'Grid Search' : 'Coarse-to-Fine'}`.padEnd(69) + '│');
  lines.push('├' + '─'.repeat(68) + '┤');
  lines.push('│  Initializing...'.padEnd(69) + '│');
  lines.push('│'.padEnd(69) + '│');
  lines.push('│'.padEnd(69) + '│');
  lines.push('│'.padEnd(69) + '│');
  lines.push('│  Config: 0/0'.padEnd(69) + '│');
  lines.push(`│  Progress: [${'░'.repeat(30)}] 0%`.padEnd(69) + '│');
  lines.push('│  Elapsed: 0s | Games: 0'.padEnd(69) + '│');
  lines.push('│'.padEnd(69) + '│');
  lines.push('└' + '─'.repeat(68) + '┘');
  console.log(lines.join('\n'));
}

/**
 * Print final results
 */
function printResults(result: MCTSTuningResult): void {
  console.log('\n');
  console.log(formatMCTSTuningResult(result));
}

/**
 * Save results to weights.json
 */
function saveResults(result: MCTSTuningResult): void {
  const currentWeights = loadWeights();
  const newMCTSParams = tuningResultToMCTSParams(result);

  const newWeights: WeightsFile = {
    ...currentWeights,
    version: bumpVersion(currentWeights.version),
    created: new Date().toISOString(),
    description: `MCTS hyperparameters tuned (${result.totalGamesPlayed} games)`,
    source: {
      method: 'mcts-tuned',
      games: result.totalGamesPlayed,
      seed: Date.now(),
    },
    mcts: newMCTSParams,
    performance: {
      ...currentWeights.performance,
      vsGreedy: result.bestResult.winRate,
      gamesPlayed: currentWeights.performance.gamesPlayed + result.totalGamesPlayed,
    },
  };

  saveWeights(newWeights);
  console.log(`\n✅ Saved to weights.json (v${newWeights.version})`);
}

/**
 * Run the MCTS tuning command
 */
export async function runTuneMCTS(
  options: Partial<TuneMCTSOptions> = {},
): Promise<MCTSTuningResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  console.log();
  console.log('🎯 ManaCore - MCTS Hyperparameter Tuning');
  console.log('═'.repeat(70));
  console.log(`  Method: ${opts.method === 'grid' ? 'Grid Search' : 'Coarse-to-Fine'}`);
  console.log(`  Games per config: ${opts.gamesPerConfig}`);
  console.log(`  Validation games: ${opts.validationGames}`);
  console.log(`  MCTS iterations: ${opts.tuningIterations}`);
  console.log(`  Seed: ${opts.seed}`);
  console.log('═'.repeat(70));
  console.log();

  // Print initial dashboard
  printInitialDashboard(opts.method);

  // Create tuner
  const tunerConfig: Partial<MCTSTunerConfig> = {
    gamesPerConfig: opts.gamesPerConfig,
    validationGames: opts.validationGames,
    maxTurns: opts.maxTurns,
    seed: opts.seed,
    method: opts.method,
    tuningIterations: opts.tuningIterations,
  };

  const tuner = new MCTSTuner(tunerConfig);

  // Run tuning
  const result = tuner.tune((progress) => {
    printDashboard(progress);
  });

  // Print results
  printResults(result);

  // Save if requested
  if (opts.save && result.bestResult.winRate > 0.5) {
    saveResults(result);
  } else if (opts.save) {
    console.log('\n⚠️  Not saving - win rate too low (< 50%)');
  }

  return result;
}

/**
 * Parse command line arguments
 */
export function parseTuneMCTSArgs(args: string[]): Partial<TuneMCTSOptions> {
  const options: Partial<TuneMCTSOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--method':
        const method = args[++i];
        if (method === 'grid' || method === 'coarse-to-fine') {
          options.method = method;
        }
        break;
      case '--games':
      case '--games-per-config':
        options.gamesPerConfig = parseInt(args[++i] || '50', 10);
        break;
      case '--validation':
      case '--validation-games':
        options.validationGames = parseInt(args[++i] || '200', 10);
        break;
      case '--turns':
      case '--max-turns':
        options.maxTurns = parseInt(args[++i] || '100', 10);
        break;
      case '--iterations':
        options.tuningIterations = parseInt(args[++i] || '50', 10);
        break;
      case '--seed':
        options.seed = parseInt(args[++i] || String(Date.now()), 10);
        break;
      case '--save':
        options.save = true;
        break;
      case '--skip-validation':
        options.skipValidation = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
    }
  }

  return options;
}
