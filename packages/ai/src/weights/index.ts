/**
 * Weight Storage Module
 *
 * Provides dynamic loading and management of evaluation weights
 * and MCTS hyperparameters from JSON configuration files.
 */

export {
  // Types
  type EvaluationWeights,
  type EvaluationCoefficients,
  type MCTSParams,
  type PerformanceMetrics,
  type WeightSource,
  type WeightsFile,
  type ManifestEntry,
  type ManifestFile,
  // Loading functions
  loadWeights,
  getEvaluationWeights,
  getEvaluationCoefficients,
  getMCTSParams,
  getPerformanceMetrics,
  getWeightsVersion,
  // Saving functions
  saveWeights,
  archiveWeights,
  // History functions
  getWeightHistory,
  loadHistoricalWeights,
  // Utility functions
  weightsToCoefficients,
  normalizeWeights,
  bumpVersion,
  clearCache,
} from './WeightLoader';
