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
} from './evaluation/evaluate';

// Search exports
export type { MCTSNode } from './search/MCTSNode';
export type { MCTSConfig, MCTSResult, RolloutPolicy } from './search/MCTS';
export {
  runMCTS,
  randomRolloutPolicy,
  greedyRolloutPolicy,
  epsilonGreedyRolloutPolicy,
  DEFAULT_MCTS_CONFIG,
} from './search/MCTS';
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

if (!process.env.MANACORE_SILENT_INIT) {
  console.log(`✅ @manacore/ai v${AI_VERSION} loaded`);
}
