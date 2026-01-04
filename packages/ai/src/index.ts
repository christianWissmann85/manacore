/**
 * @manacore/ai - AI bots and search algorithms
 *
 * This package contains:
 * - RandomBot (random legal moves)
 * - GreedyBot (1-ply lookahead) [Phase 2]
 * - MCTSBot (Monte Carlo Tree Search) [Phase 2]
 * - Evaluation functions [Phase 2]
 */

export const AI_VERSION = '0.0.1';

// Bot exports
export type { Bot } from './bots/Bot';
export { RandomBot } from './bots/RandomBot';

console.log(`✅ @manacore/ai v${AI_VERSION} loaded`);
