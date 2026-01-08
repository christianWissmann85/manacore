/**
 * @manacore/ai - AI bots and search algorithms
 *
 * This package contains:
 * - RandomBot (random legal moves)
 * - GreedyBot (1-ply lookahead)
 * - MCTSBot (Monte Carlo Tree Search)
 * - Evaluation functions
 * - MCTS search algorithm
 */

export const AI_VERSION = '0.3.0';

// Bot exports
export type { Bot } from './bots/Bot';
export { RandomBot } from './bots/RandomBot';
export { GreedyBot } from './bots/GreedyBot';
export { MCTSBot, createMCTSBot, MCTSBotPresets } from './bots/MCTSBot';

// Evaluation exports
export type { EvaluationWeights, EvaluationCoefficients } from './evaluation/evaluate';
export {
  evaluate,
  quickEvaluate,
  quickEvaluateWithCoefficients,
  DEFAULT_WEIGHTS,
  TUNED_WEIGHTS,
  DEFAULT_COEFFICIENTS,
  TUNED_COEFFICIENTS,
  // Dynamic loading functions
  getCurrentWeights,
  getCurrentCoefficients,
  evaluateWithCurrentWeights,
  quickEvaluateWithCurrentCoefficients,
} from './evaluation/evaluate';

// Weight storage exports
export type {
  WeightsFile,
  MCTSParams,
  PerformanceMetrics,
  WeightSource,
  ManifestEntry,
} from './weights';
export {
  loadWeights,
  saveWeights,
  archiveWeights,
  getEvaluationWeights,
  getEvaluationCoefficients,
  getMCTSParams,
  getPerformanceMetrics,
  getWeightsVersion,
  getWeightHistory,
  loadHistoricalWeights,
  bumpVersion,
  clearCache,
} from './weights';

// Search exports
export type { MCTSNode } from './search/MCTSNode';
export type { MCTSConfig, MCTSResult, RolloutPolicy } from './search/MCTS';
export {
  runMCTS,
  randomRolloutPolicy,
  greedyRolloutPolicy,
  epsilonGreedyRolloutPolicy,
  DEFAULT_MCTS_CONFIG,
  // Phase 3.4: Move ordering
  ACTION_PRIORITY,
  orderActionsByPriority,
  selectWeightedAction,
  filterRepeatedAbilities,
  // Determinization for hidden information handling
  determinize,
} from './search/MCTS';

// Transposition table exports
export type {
  TranspositionEntry,
  TranspositionStats,
  TranspositionConfig,
} from './search/TranspositionTable';
export { TranspositionTable, DEFAULT_TRANSPOSITION_CONFIG } from './search/TranspositionTable';
export {
  createMCTSNode,
  isFullyExpanded,
  isTerminal,
  calculateUCB1,
  selectBestChild,
  selectMostVisitedChild,
  backpropagate,
} from './search/MCTSNode';

// Tuning exports
export type {
  FitnessScores,
  WeightCandidate,
  FitnessConfig,
  OptimizerConfig,
  OptimizationProgress,
  OptimizationResult,
  ProgressCallback,
} from './tuning/types';
export { FitnessEvaluator } from './tuning/FitnessEvaluator';
export { LocalSearchOptimizer } from './tuning/LocalSearchOptimizer';
export { EvolutionaryOptimizer } from './tuning/EvolutionaryOptimizer';
export { TunableBot, normalizeWeights, weightsToCoefficients } from './tuning/TunableBot';

// Acceptance criteria exports
export type {
  ConfidenceInterval,
  AcceptanceThresholds,
  AcceptanceCriteriaConfig,
  ValidationResult,
} from './tuning/AcceptanceCriteria';
export {
  wilsonConfidenceInterval,
  areSignificantlyDifferent,
  isSignificantlyBetter,
  validateImprovement,
  formatValidationResult,
  isLikelyBetter,
  calculateRequiredSampleSize,
  DEFAULT_ACCEPTANCE_CONFIG,
  RELAXED_ACCEPTANCE_CONFIG,
  STRICT_ACCEPTANCE_CONFIG,
} from './tuning/AcceptanceCriteria';

// MCTS tuner exports
export type {
  MCTSHyperparams,
  MCTSParamRanges,
  MCTSConfigResult,
  MCTSTuningProgress,
  MCTSTuningResult,
  MCTSTunerConfig,
} from './tuning/MCTSTuner';
export {
  MCTSTuner,
  formatMCTSTuningResult,
  tuningResultToMCTSParams,
  DEFAULT_TUNER_CONFIG,
  DEFAULT_PARAM_RANGES,
  COARSE_PARAM_RANGES,
} from './tuning/MCTSTuner';

// Training data collection exports
export type {
  StateFeatures,
  TrainingSample,
  GameTrainingData,
  CollectorConfig,
  TensorData,
  JSONLSample,
  TensorExport,
} from './training';
export {
  TrainingDataCollector,
  extractFeatures,
  featuresToArray,
  FEATURE_VECTOR_SIZE,
  saveTrainingData,
  saveTrainingDataCompact,
  toTensorFormat,
  mergeTrainingData,
  DEFAULT_COLLECTOR_CONFIG,
  // Phase 2: JSONL and NumPy exports
  saveAsJSONL,
  saveMultipleAsJSONL,
  exportForNumPy,
} from './training';

// Neural network bot exports (Phase 2B)
export { NeuralBot, createNeuralBot, type NeuralBotConfig } from './neural';

if (!process.env.MANACORE_SILENT_INIT) {
  console.log(`✅ @manacore/ai v${AI_VERSION} loaded`);
}
