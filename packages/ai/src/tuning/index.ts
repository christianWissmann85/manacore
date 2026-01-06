/**
 * Weight Tuning Module
 *
 * Self-play optimization for evaluation function weights.
 */

export * from './types';
export { FitnessEvaluator } from './FitnessEvaluator';
export { LocalSearchOptimizer } from './LocalSearchOptimizer';
export { EvolutionaryOptimizer } from './EvolutionaryOptimizer';
export { TunableBot, normalizeWeights } from './TunableBot';

// Acceptance criteria exports
export type {
  ConfidenceInterval,
  AcceptanceThresholds,
  AcceptanceCriteriaConfig,
  ValidationResult,
} from './AcceptanceCriteria';
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
} from './AcceptanceCriteria';

// MCTS tuner exports
export type {
  MCTSHyperparams,
  MCTSParamRanges,
  MCTSConfigResult,
  MCTSTuningProgress,
  MCTSTuningResult,
  MCTSTunerConfig,
} from './MCTSTuner';
export {
  MCTSTuner,
  formatMCTSTuningResult,
  tuningResultToMCTSParams,
  DEFAULT_TUNER_CONFIG,
  DEFAULT_PARAM_RANGES,
  COARSE_PARAM_RANGES,
} from './MCTSTuner';
