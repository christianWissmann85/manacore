/**
 * Benchmarking Module - Bot comparison suite
 *
 * Exports for running bot-vs-bot benchmarks with win rate matrices.
 */

// Types
export type {
  BenchmarkConfig,
  MatchupResult,
  BotRanking,
  BenchmarkSummary,
  BenchmarkMetadata,
  BenchmarkResults,
  BenchmarkProgress,
  BenchmarkPreset,
  BenchmarkProgressCallback,
} from './types';

// Core classes
export { BenchmarkRunner, runBenchmark } from './BenchmarkRunner';
export { MatchupRecorder } from './MatchupRecorder';

// Presets
export {
  BENCHMARK_PRESETS,
  getPreset,
  getAllBotTypes,
  getPresetNames,
  isValidBotType,
  parseBotList,
  type PresetConfig,
} from './presets';

// Statistics
export {
  wilsonInterval,
  calculateEloRatings,
  proportionZTest,
  recommendedGames,
  formatCI,
  type EloRating,
  type MatchResult,
} from './StatisticsCalculator';
