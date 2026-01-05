/**
 * @manacore/ai - AI bots and search algorithms
 *
 * This package contains:
 * - RandomBot (random legal moves)
 * - GreedyBot (1-ply lookahead)
 * - MCTSBot (Monte Carlo Tree Search) [Coming Soon]
 * - Evaluation functions
 */

export const AI_VERSION = '0.2.0';

// Bot exports
export type { Bot } from './bots/Bot';
export { RandomBot } from './bots/RandomBot';
export { GreedyBot } from './bots/GreedyBot';

// Evaluation exports
export type { EvaluationWeights } from './evaluation/evaluate';
export { evaluate, quickEvaluate, DEFAULT_WEIGHTS } from './evaluation/evaluate';

console.log(`✅ @manacore/ai v${AI_VERSION} loaded`);
