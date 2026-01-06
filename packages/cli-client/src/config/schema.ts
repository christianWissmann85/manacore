/**
 * ManaCore Unified Configuration Schema
 *
 * All CLI commands can be configured via JSON files instead of flags.
 * This makes experiments reproducible and documented.
 *
 * Usage: bun cli run experiments/my-experiment.json
 */

import type { BotType } from '../botFactory';

/**
 * Output verbosity levels
 */
export type OutputLevel = 'quiet' | 'minimal' | 'normal' | 'verbose';

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'csv' | 'markdown';

/**
 * Common output configuration (shared by all commands)
 */
export interface OutputConfig {
  /** Base directory for all outputs (default: "results") */
  directory?: string;

  /** Verbosity level */
  level?: OutputLevel;

  /** Export formats to generate */
  formats?: ExportFormat[];

  /** Include timestamp in filenames */
  timestamp?: boolean;
}

/**
 * Bot configuration (can reference preset or define custom)
 */
export interface BotConfig {
  /** Bot type (preset from botFactory) */
  type: BotType;

  /** Optional custom name suffix */
  name?: string;
}

/**
 * Simulation experiment configuration
 */
export interface SimulateConfig {
  command: 'simulate';

  /** Experiment name (used in output filenames) */
  name: string;

  /** Number of games to run */
  games: number;

  /** Player 1 bot configuration */
  p1: BotConfig;

  /** Player 2 bot configuration */
  p2: BotConfig;

  /** Random seed for reproducibility */
  seed?: number | 'timestamp';

  /** Maximum turns per game */
  maxTurns?: number;

  /** Run games in parallel */
  parallel?: boolean;

  /** Output configuration */
  output?: OutputConfig;
}

/**
 * Benchmark suite configuration
 */
export interface BenchmarkConfig {
  command: 'benchmark';

  /** Experiment name */
  name: string;

  /** Bots to include in benchmark */
  bots: BotType[];

  /** Games per matchup */
  gamesPerMatchup: number;

  /** Random seed */
  seed?: number | 'timestamp';

  /** Calculate Elo ratings */
  calculateElo?: boolean;

  /** Output configuration */
  output?: OutputConfig;
}

/**
 * Weight tuning configuration
 */
export interface TuneWeightsConfig {
  command: 'tune-weights';

  /** Experiment name */
  name: string;

  /** Tuning method */
  method: 'local' | 'evolve';

  /** Number of generations (evolve only) */
  generations?: number;

  /** Population size (evolve only) */
  population?: number;

  /** Games vs RandomBot */
  gamesRandom: number;

  /** Games vs GreedyBot */
  gamesGreedy: number;

  /** Random seed */
  seed?: number | 'timestamp';

  /** Output configuration */
  output?: OutputConfig;
}

/**
 * MCTS hyperparameter tuning configuration
 */
export interface TuneMCTSConfig {
  command: 'tune-mcts';

  /** Experiment name */
  name: string;

  /** Search method */
  method: 'grid' | 'coarse-to-fine';

  /** Games per configuration */
  gamesPerConfig: number;

  /** Validation games for final config */
  validationGames?: number;

  /** Iteration range to search */
  iterations?: { min: number; max: number; step?: number };

  /** Random seed */
  seed?: number | 'timestamp';

  /** Skip validation phase */
  skipValidation?: boolean;

  /** Output configuration */
  output?: OutputConfig;
}

/**
 * Full pipeline configuration
 */
export interface PipelineConfig {
  command: 'pipeline';

  /** Experiment name */
  name: string;

  /** Seed for reproducibility */
  seed?: number | 'timestamp';

  /** Weight tuning options */
  weights?: {
    method: 'local' | 'evolve';
    generations?: number;
    skip?: boolean;
  };

  /** MCTS tuning options */
  mcts?: {
    method: 'grid' | 'coarse-to-fine';
    games?: number;
    validation?: number;
    skip?: boolean;
  };

  /** Acceptance criteria */
  acceptance?: 'relaxed' | 'default' | 'strict';

  /** Output configuration */
  output?: OutputConfig;
}

/**
 * Training data collection configuration
 */
export interface CollectTrainingConfig {
  command: 'collect';

  /** Experiment name */
  name: string;

  /** Total games to collect */
  games: number;

  /** Curriculum type */
  curriculum: 'default' | 'fast';

  /** Specific phase only (optional) */
  phase?: 'easy' | 'medium' | 'hard' | 'fast-easy' | 'fast-medium';

  /** Random seed */
  seed?: number | 'timestamp';

  /** Maximum turns per game */
  maxTurns?: number;

  /** Export formats */
  export?: {
    json?: boolean;
    binary?: boolean;
  };

  /** Output configuration */
  output?: OutputConfig;
}

/**
 * Replay configuration
 */
export interface ReplayConfig {
  command: 'replay';

  /** Experiment name */
  name: string;

  /** Replay file path or seed to replay */
  source: string | number;

  /** Start from specific turn */
  fromTurn?: number;

  /** Watch mode with delay */
  watch?: {
    enabled: boolean;
    delayMs?: number;
  };

  /** Verify replay matches original */
  verify?: boolean;

  /** Output configuration */
  output?: OutputConfig;
}

/**
 * Union of all experiment configurations
 */
export type ExperimentConfig =
  | SimulateConfig
  | BenchmarkConfig
  | TuneWeightsConfig
  | TuneMCTSConfig
  | PipelineConfig
  | CollectTrainingConfig
  | ReplayConfig;

/**
 * Root configuration file structure
 */
export interface ManaCoreConfig {
  /** Schema version for compatibility */
  version: '1.0';

  /** Default output configuration (inherited by experiments) */
  defaults?: {
    output?: OutputConfig;
    seed?: number | 'timestamp';
  };

  /** Named profiles for quick access */
  profiles?: Record<string, Partial<ExperimentConfig>>;
}

/**
 * Default configuration values
 */
export const CONFIG_DEFAULTS = {
  output: {
    directory: 'output',
    level: 'minimal' as OutputLevel,
    formats: ['json'] as ExportFormat[],
    timestamp: true,
  },
  seed: 'timestamp' as const,
  maxTurns: 100,
  parallel: true,
};
