/**
 * Configuration Runner
 *
 * Executes experiments based on loaded configuration files.
 */

import type {
  ExperimentConfig,
  SimulateConfig,
  BenchmarkConfig,
  TuneWeightsConfig,
  TuneMCTSConfig,
  PipelineConfig as PipelineExperimentConfig,
  CollectTrainingConfig,
  ReplayConfig,
} from './schema';
import { printConfigSummary } from './loader';
import { createBot } from '../botFactory';
import { runSimulation } from '../commands/simulate';
import { runBenchmarkSuite } from '../commands/benchmarkSuite';
import { runTune } from '../commands/tune';
import { runTuneMCTS } from '../commands/tune-mcts';
import { runPipeline } from '../commands/pipeline';
import { runCollectTraining } from '../commands/collect-training';
import { runReplayCommand } from '../commands/replay';
import { OutputLevel } from '../types';

/**
 * Map output level string to enum
 */
function mapOutputLevel(level?: string): OutputLevel {
  switch (level) {
    case 'quiet':
      return OutputLevel.QUIET;
    case 'minimal':
      return OutputLevel.MINIMAL;
    case 'normal':
      return OutputLevel.NORMAL;
    case 'verbose':
      return OutputLevel.VERBOSE;
    default:
      return OutputLevel.MINIMAL;
  }
}

/**
 * Run an experiment from configuration
 */
export async function runExperiment(config: ExperimentConfig): Promise<void> {
  // Print configuration summary
  printConfigSummary(config);

  // Route to appropriate command
  switch (config.command) {
    case 'simulate':
      await runSimulateExperiment(config);
      break;

    case 'benchmark':
      await runBenchmarkExperiment(config);
      break;

    case 'tune-weights':
      await runTuneWeightsExperiment(config);
      break;

    case 'tune-mcts':
      await runTuneMCTSExperiment(config);
      break;

    case 'pipeline':
      await runPipelineExperiment(config);
      break;

    case 'collect':
      await runCollectExperiment(config);
      break;

    case 'replay':
      await runReplayExperiment(config);
      break;

    default:
      throw new Error(`Unknown command: ${(config as any).command}`);
  }
}

/**
 * Run simulation experiment
 */
async function runSimulateExperiment(config: SimulateConfig): Promise<void> {
  const p1Bot = createBot(config.p1.type, config.seed as number);
  const p2Bot = createBot(config.p2.type, config.seed as number);

  // runSimulation handles all output internally
  await runSimulation(p1Bot, p2Bot, {
    gameCount: config.games,
    seed: config.seed as number,
    maxTurns: config.maxTurns,
    outputLevel: mapOutputLevel(config.output?.level),
    parallel: config.parallel,
  });
}

/**
 * Run benchmark experiment
 */
async function runBenchmarkExperiment(config: BenchmarkConfig): Promise<void> {
  await runBenchmarkSuite({
    preset: 'quick', // Will be overridden by bots
    bots: config.bots,
    gamesPerMatchup: config.gamesPerMatchup,
    seed: config.seed as number,
    outputLevel: mapOutputLevel(config.output?.level),
    includeElo: config.calculateElo,
    exportMarkdown: config.output?.formats?.includes('markdown'),
    exportJson: config.output?.formats?.includes('json') !== false,
  });
}

/**
 * Run weight tuning experiment
 */
async function runTuneWeightsExperiment(config: TuneWeightsConfig): Promise<void> {
  await runTune({
    method: config.method,
    generations: config.generations ?? 15,
    populationSize: config.population ?? 10,
    gamesVsRandom: config.gamesRandom,
    gamesVsGreedy: config.gamesGreedy,
    seed: config.seed as number,
    verbose: config.output?.level === 'verbose',
  });
}

/**
 * Run MCTS tuning experiment
 */
async function runTuneMCTSExperiment(config: TuneMCTSConfig): Promise<void> {
  await runTuneMCTS({
    method: config.method,
    gamesPerConfig: config.gamesPerConfig,
    validationGames: config.validationGames,
    seed: config.seed as number,
    skipValidation: config.skipValidation,
    verbose: config.output?.level === 'verbose',
    save: true,
  });
}

/**
 * Run full pipeline experiment
 */
async function runPipelineExperiment(config: PipelineExperimentConfig): Promise<void> {
  await runPipeline({
    seed: config.seed as number,
    weightMethod: config.weights?.method || 'evolve',
    mctsMethod: config.mcts?.method || 'coarse-to-fine',
    skipWeights: config.weights?.skip || false,
    skipMCTS: config.mcts?.skip || false,
    skipValidation: false,
    acceptanceLevel: config.acceptance || 'default',
    verbose: config.output?.level === 'verbose',
    dryRun: false,
    force: false,
  });
}

/**
 * Run training data collection experiment
 */
async function runCollectExperiment(config: CollectTrainingConfig): Promise<void> {
  await runCollectTraining({
    games: config.games,
    output: config.output?.directory || 'training-data',
    seed: config.seed as number,
    maxTurns: config.maxTurns,
    fast: config.curriculum === 'fast',
    phase: config.phase,
    noJsonExport: config.export?.json === false,
    noBinaryExport: config.export?.binary === false,
    verbose: config.output?.level === 'verbose',
  });
}

/**
 * Run replay experiment
 */
async function runReplayExperiment(config: ReplayConfig): Promise<void> {
  await runReplayCommand({
    filepath: typeof config.source === 'string' ? config.source : `seed:${config.source}`,
    turn: config.fromTurn,
    watch: config.watch?.enabled,
    delay: config.watch?.delayMs,
    verify: config.verify,
    verbose: config.output?.level === 'verbose',
  });
}
