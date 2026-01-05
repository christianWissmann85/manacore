/**
 * Weight Tuning Command - CLI interface for self-play optimization
 *
 * Provides a dashboard view of the tuning process with minimal output.
 */

import {
  LocalSearchOptimizer,
  EvolutionaryOptimizer,
  DEFAULT_WEIGHTS,
  type OptimizationProgress,
  type OptimizationResult,
  type EvaluationWeights,
} from '@manacore/ai';

export interface TuneOptions {
  /** Optimization method: 'local' or 'evolve' */
  method: 'local' | 'evolve';
  /** Games per evaluation vs RandomBot */
  gamesVsRandom: number;
  /** Games per evaluation vs GreedyBot */
  gamesVsGreedy: number;
  /** Number of generations */
  generations: number;
  /** Population size (for evolutionary) */
  populationSize: number;
  /** Base seed for reproducibility */
  seed: number;
  /** Show verbose output */
  verbose: boolean;
}

const DEFAULT_TUNE_OPTIONS: TuneOptions = {
  method: 'local',
  gamesVsRandom: 30,
  gamesVsGreedy: 20,
  generations: 15,
  populationSize: 10,
  seed: Date.now(),
  verbose: false,
};

/**
 * Format weights as a compact string
 */
function formatWeights(w: EvaluationWeights): string {
  return `L=${w.life.toFixed(2)} B=${w.board.toFixed(2)} C=${w.cards.toFixed(2)} M=${w.mana.toFixed(2)} T=${w.tempo.toFixed(2)}`;
}

/**
 * Format time in human-readable form
 */
function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

/**
 * Print the dashboard
 */
function printDashboard(progress: OptimizationProgress): void {
  const { generation, totalGenerations, gamesCompleted, totalGames } = progress;
  const { bestCandidate, improvement, gamesPerSecond, etaSeconds, phase } = progress;

  // Calculate progress percentage
  const pct = Math.round((gamesCompleted / totalGames) * 100);
  const barWidth = 30;
  const filled = Math.round((pct / 100) * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

  // Build dashboard
  const lines: string[] = [];
  lines.push('┌' + '─'.repeat(68) + '┐');
  lines.push(`│  🧬 Weight Tuning - Generation ${generation}/${totalGenerations}`.padEnd(69) + '│');
  lines.push('├' + '─'.repeat(68) + '┤');

  if (bestCandidate?.fitness) {
    const w = bestCandidate.weights;
    lines.push(`│  Current Best: ${formatWeights(w)}`.padEnd(69) + '│');
    lines.push('│'.padEnd(69) + '│');

    const vsR = (bestCandidate.fitness.vsRandom * 100).toFixed(1);
    const vsG = (bestCandidate.fitness.vsGreedy * 100).toFixed(1);
    const impR =
      improvement.vsRandom >= 0
        ? `+${improvement.vsRandom.toFixed(1)}`
        : improvement.vsRandom.toFixed(1);
    const impG =
      improvement.vsGreedy >= 0
        ? `+${improvement.vsGreedy.toFixed(1)}`
        : improvement.vsGreedy.toFixed(1);

    lines.push('│  Fitness Scores:'.padEnd(69) + '│');
    lines.push(
      `│    vs Random: ${vsR}% (${impR}%)    vs Greedy: ${vsG}% (${impG}%)`.padEnd(69) + '│',
    );
    lines.push(
      `│    Elo: ${bestCandidate.fitness.elo}         Combined: ${(bestCandidate.fitness.combined * 100).toFixed(1)}%`.padEnd(
        69,
      ) + '│',
    );
  } else {
    lines.push('│  Evaluating baseline...'.padEnd(69) + '│');
  }

  lines.push('│'.padEnd(69) + '│');
  lines.push(
    `│  Progress: [${bar}] ${pct}% (${gamesCompleted}/${totalGames} games)`.padEnd(69) + '│',
  );
  lines.push(
    `│  Speed: ${gamesPerSecond.toFixed(1)} games/sec | ETA: ${formatTime(etaSeconds)}`.padEnd(69) +
      '│',
  );
  lines.push(`│  ${phase}`.padEnd(69) + '│');
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
  lines.push(
    `│  🧬 Weight Tuning - ${method === 'local' ? 'Local Search' : 'Evolutionary'}`.padEnd(69) +
      '│',
  );
  lines.push('├' + '─'.repeat(68) + '┤');
  lines.push('│  Initializing...'.padEnd(69) + '│');
  lines.push('│'.padEnd(69) + '│');
  lines.push('│  Fitness Scores:'.padEnd(69) + '│');
  lines.push('│    vs Random: ---%    vs Greedy: ---%'.padEnd(69) + '│');
  lines.push('│    Elo: ---         Combined: ---%'.padEnd(69) + '│');
  lines.push('│'.padEnd(69) + '│');
  lines.push(`│  Progress: [${'░'.repeat(30)}] 0%`.padEnd(69) + '│');
  lines.push('│  Speed: --- games/sec | ETA: ---'.padEnd(69) + '│');
  lines.push('│  Starting optimization...'.padEnd(69) + '│');
  lines.push('└' + '─'.repeat(68) + '┘');
  console.log(lines.join('\n'));
}

/**
 * Print final results
 */
function printResults(result: OptimizationResult): void {
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('  🏆 OPTIMIZATION COMPLETE');
  console.log('═'.repeat(70));
  console.log();
  console.log('  📊 Results Summary');
  console.log('  ' + '─'.repeat(40));
  console.log();

  // Baseline
  console.log('  Baseline Weights:');
  console.log(`    ${formatWeights(result.baselineWeights)}`);
  console.log(`    vs Random: ${(result.baselineFitness.vsRandom * 100).toFixed(1)}%`);
  console.log(`    vs Greedy: ${(result.baselineFitness.vsGreedy * 100).toFixed(1)}%`);
  console.log();

  // Best found
  console.log('  🏆 Best Weights Found:');
  console.log(`    ${formatWeights(result.bestWeights)}`);
  console.log(`    vs Random: ${(result.bestFitness.vsRandom * 100).toFixed(1)}%`);
  console.log(`    vs Greedy: ${(result.bestFitness.vsGreedy * 100).toFixed(1)}%`);
  console.log(`    Elo: ${result.bestFitness.elo}`);
  console.log();

  // Improvement
  const impR = result.bestFitness.vsRandom - result.baselineFitness.vsRandom;
  const impG = result.bestFitness.vsGreedy - result.baselineFitness.vsGreedy;
  console.log('  📈 Improvement:');
  console.log(`    vs Random: ${impR >= 0 ? '+' : ''}${(impR * 100).toFixed(1)}%`);
  console.log(`    vs Greedy: ${impG >= 0 ? '+' : ''}${(impG * 100).toFixed(1)}%`);
  console.log();

  // Stats
  console.log('  ⚡ Statistics:');
  console.log(`    Total games: ${result.totalGames}`);
  console.log(`    Total time: ${formatTime(result.totalTimeMs / 1000)}`);
  console.log(`    Candidates evaluated: ${result.allCandidates.length}`);
  console.log();

  // Code snippet
  console.log('  📋 Copy this to use the optimized weights:');
  console.log('  ' + '─'.repeat(50));
  console.log();
  console.log('  const OPTIMIZED_WEIGHTS: EvaluationWeights = {');
  console.log(`    life: ${result.bestWeights.life.toFixed(4)},`);
  console.log(`    board: ${result.bestWeights.board.toFixed(4)},`);
  console.log(`    cards: ${result.bestWeights.cards.toFixed(4)},`);
  console.log(`    mana: ${result.bestWeights.mana.toFixed(4)},`);
  console.log(`    tempo: ${result.bestWeights.tempo.toFixed(4)},`);
  console.log('  };');
  console.log();
  console.log('═'.repeat(70));
}

/**
 * Run the tune command
 */
export async function runTune(options: Partial<TuneOptions> = {}): Promise<OptimizationResult> {
  const opts = { ...DEFAULT_TUNE_OPTIONS, ...options };

  console.log();
  console.log('🧬 ManaCore - Weight Tuning');
  console.log('═'.repeat(70));
  console.log(
    `  Method: ${opts.method === 'local' ? 'Local Search (Hill Climbing)' : 'Evolutionary (Genetic Algorithm)'}`,
  );
  console.log(`  Games per eval: ${opts.gamesVsRandom} vs Random, ${opts.gamesVsGreedy} vs Greedy`);
  console.log(`  Generations: ${opts.generations}`);
  if (opts.method === 'evolve') {
    console.log(`  Population: ${opts.populationSize}`);
  }
  console.log(`  Seed: ${opts.seed}`);
  console.log('═'.repeat(70));
  console.log();

  // Print initial dashboard
  printInitialDashboard(opts.method);

  // Create optimizer
  const optimizerConfig = {
    fitness: {
      gamesVsRandom: opts.gamesVsRandom,
      gamesVsGreedy: opts.gamesVsGreedy,
      tournamentGames: 10,
      maxTurns: 100,
      seed: opts.seed,
    },
    generations: opts.generations,
    populationSize: opts.populationSize,
    mutationRate: 0.3,
    mutationStrength: 0.15,
    verbose: opts.verbose,
  };

  let result: OptimizationResult;

  if (opts.method === 'local') {
    const optimizer = new LocalSearchOptimizer(optimizerConfig);
    result = optimizer.optimize(DEFAULT_WEIGHTS, (progress) => {
      printDashboard(progress);
    });
  } else {
    const optimizer = new EvolutionaryOptimizer(optimizerConfig);
    result = optimizer.optimize(DEFAULT_WEIGHTS, (progress) => {
      printDashboard(progress);
    });
  }

  // Print final results
  printResults(result);

  return result;
}
