/**
 * Benchmarking Suite Types
 *
 * Type definitions for bot comparison benchmarks.
 */

import type { BotType } from '../botFactory';
import type { OutputLevel } from '../types';

/**
 * Configuration for a benchmark run
 */
export interface BenchmarkConfig {
  /** Bot types to include in the benchmark */
  bots: BotType[];
  /** Number of games per matchup */
  gamesPerMatchup: number;
  /** Maximum turns per game */
  maxTurns: number;
  /** Base seed for reproducibility */
  seed: number;
  /** Run games in parallel */
  parallel: boolean;
  /** Output verbosity */
  outputLevel: OutputLevel;
}

/**
 * Results for a single matchup (Bot A vs Bot B)
 */
export interface MatchupResult {
  /** First bot type (plays as player) */
  bot1: BotType;
  /** Second bot type (plays as opponent) */
  bot2: BotType;
  /** Games won by bot1 */
  bot1Wins: number;
  /** Games won by bot2 */
  bot2Wins: number;
  /** Draw games */
  draws: number;
  /** Total games played */
  totalGames: number;
  /** Bot1 win rate (0-1) */
  winRate: number;
  /** Average turns per game */
  avgTurns: number;
  /** Total time for this matchup in ms */
  totalMs: number;
}

/**
 * Bot ranking entry
 */
export interface BotRanking {
  /** Bot type */
  bot: BotType;
  /** Average win rate across all matchups (0-1) */
  avgWinRate: number;
  /** Total games played */
  gamesPlayed: number;
  /** Total wins */
  wins: number;
  /** Total losses */
  losses: number;
  /** Total draws */
  draws: number;
}

/**
 * Summary statistics for the benchmark
 */
export interface BenchmarkSummary {
  /** Total number of games played */
  totalGames: number;
  /** Number of unique matchups */
  totalMatchups: number;
  /** Total benchmark duration in ms */
  totalDurationMs: number;
  /** Games per second throughput */
  gamesPerSecond: number;
  /** Number of bots compared */
  botsCompared: number;
}

/**
 * Metadata for reproducibility
 */
export interface BenchmarkMetadata {
  /** Start timestamp */
  startTime: string;
  /** End timestamp */
  endTime: string;
  /** Base seed used */
  seed: number;
  /** Preset name if used */
  preset?: string;
  /** CLI version */
  version: string;
}

/**
 * Complete benchmark results
 */
export interface BenchmarkResults {
  /** Benchmark configuration */
  config: BenchmarkConfig;
  /** All matchup results */
  matchups: MatchupResult[];
  /** Win rate matrix: matrix[bot1][bot2] = bot1's win rate vs bot2 */
  matrix: Record<string, Record<string, number>>;
  /** Bot rankings by average win rate */
  rankings: BotRanking[];
  /** Summary statistics */
  summary: BenchmarkSummary;
  /** Metadata for reproducibility */
  metadata: BenchmarkMetadata;
}

/**
 * Progress update during benchmark execution
 */
export interface BenchmarkProgress {
  /** Current matchup index (1-based) */
  currentMatchup: number;
  /** Total number of matchups */
  totalMatchups: number;
  /** Current game within matchup (1-based) */
  currentGame: number;
  /** Total games in current matchup */
  totalGamesInMatchup: number;
  /** Total games completed overall */
  totalGamesCompleted: number;
  /** Total games to run */
  totalGames: number;
  /** Bot1 in current matchup */
  bot1: BotType;
  /** Bot2 in current matchup */
  bot2: BotType;
  /** Current matchup win rate for bot1 */
  currentWinRate: number;
  /** Elapsed time in ms */
  elapsedMs: number;
  /** Estimated remaining time in ms */
  estimatedRemainingMs: number;
  /** Games per second */
  gamesPerSecond: number;
}

/**
 * Preset names
 */
export type BenchmarkPreset = 'quick' | 'standard' | 'comprehensive' | 'custom';

/**
 * Progress callback function type
 */
export type BenchmarkProgressCallback = (progress: BenchmarkProgress) => void;
