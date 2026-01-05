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
export type { EvaluationWeights } from './evaluation/evaluate';
export { evaluate, quickEvaluate, DEFAULT_WEIGHTS } from './evaluation/evaluate';

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

if (!process.env.MANACORE_SILENT_INIT) {
  console.log(`✅ @manacore/ai v${AI_VERSION} loaded`);
}
