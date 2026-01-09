/**
 * AI Thinking Serialization
 *
 * Converts bot internal state into visualization-friendly format.
 * Supports MCTS tree visualization, evaluation breakdowns, and policy distributions.
 */

import type { GameState, PlayerId, Action } from '@manacore/engine';
import { describeAction } from '@manacore/engine';
import type { Bot } from '@manacore/ai';
import { evaluate, TUNED_WEIGHTS } from '@manacore/ai';

/**
 * MCTS tree node for visualization
 */
export interface MCTSTreeNode {
  action: string | null;
  visits: number;
  value: number;
  winRate: number;
  children: MCTSTreeNode[];
}

/**
 * Evaluation breakdown
 */
export interface EvaluationBreakdown {
  life: number;
  board: number;
  cards: number;
  mana: number;
  tempo: number;
  total: number;
}

/**
 * Policy distribution entry (for neural bots)
 */
export interface PolicyEntry {
  actionIndex: number;
  description: string;
  probability: number;
}

/**
 * Complete AI thinking data
 */
export interface AIThinking {
  agentName: string;
  playerId: 'player' | 'opponent';
  winProbability: number;
  evaluatedNodes: number;
  timeMs: number;
  mctsTree?: MCTSTreeNode;
  evaluation?: EvaluationBreakdown;
  policyDistribution?: PolicyEntry[];
}

/**
 * Internal MCTS node structure (from @manacore/ai)
 */
interface InternalMCTSNode {
  state: GameState;
  action: Action | null;
  parent: InternalMCTSNode | null;
  children: InternalMCTSNode[];
  visits: number;
  totalReward: number;
  untriedActions: Action[];
}

/**
 * Internal MCTS result structure
 */
interface InternalMCTSResult {
  action: Action;
  iterations: number;
  timeMs: number;
  root: InternalMCTSNode;
  winRate: number;
}

/**
 * Convert internal MCTS node to visualization format
 * Only serialize top children to avoid huge payloads
 */
function serializeMCTSNode(
  node: InternalMCTSNode,
  state: GameState,
  maxChildren: number = 10,
  depth: number = 0,
  maxDepth: number = 2,
): MCTSTreeNode {
  const winRate = node.visits > 0 ? node.totalReward / node.visits : 0.5;

  // Sort children by visits and take top N
  const sortedChildren = [...node.children].sort((a, b) => b.visits - a.visits);
  const topChildren = sortedChildren.slice(0, maxChildren);

  return {
    action: node.action ? describeAction(node.action, state) : null,
    visits: node.visits,
    value: node.totalReward,
    winRate,
    children:
      depth < maxDepth
        ? topChildren.map((child) => serializeMCTSNode(child, state, maxChildren, depth + 1, maxDepth))
        : [],
  };
}

/**
 * Calculate evaluation breakdown from current state
 */
export function calculateEvaluationBreakdown(state: GameState, playerId: PlayerId): EvaluationBreakdown {
  const player = state.players[playerId];
  const opponent = state.players[playerId === 'player' ? 'opponent' : 'player'];

  // Calculate individual components (simplified)
  const lifeScore = (player.life - opponent.life) / 40;

  // Board power
  const playerPower = player.battlefield
    .filter((c) => c.scryfallId && !c.tapped)
    .reduce((sum, c) => {
      const power = parseInt(c.scryfallId.split('-')[0]) || 0;
      return sum + power;
    }, 0);
  const opponentPower = opponent.battlefield.reduce((sum) => sum, 0);
  const boardScore = (playerPower - opponentPower) / 30;

  // Card advantage
  const cardScore = (player.hand.length - opponent.hand.length) / 14;

  // Mana advantage
  const playerLands = player.battlefield.filter((c) => {
    const template = c.scryfallId;
    return template?.includes('land') ?? false;
  }).length;
  const opponentLands = opponent.battlefield.filter((c) => {
    const template = c.scryfallId;
    return template?.includes('land') ?? false;
  }).length;
  const manaScore = (playerLands - opponentLands) / 10;

  // Tempo (untapped permanents)
  const playerUntapped = player.battlefield.filter((c) => !c.tapped).length;
  const opponentUntapped = opponent.battlefield.filter((c) => !c.tapped).length;
  const tempoScore = (playerUntapped - opponentUntapped) / 10;

  // Weighted total using TUNED_WEIGHTS
  const total =
    lifeScore * TUNED_WEIGHTS.life +
    boardScore * TUNED_WEIGHTS.board +
    cardScore * TUNED_WEIGHTS.cards +
    manaScore * TUNED_WEIGHTS.mana +
    tempoScore * TUNED_WEIGHTS.tempo;

  // Normalize to 0-1
  const normalizedTotal = Math.max(0, Math.min(1, 0.5 + total));

  return {
    life: lifeScore,
    board: boardScore,
    cards: cardScore,
    mana: manaScore,
    tempo: tempoScore,
    total: normalizedTotal,
  };
}

/**
 * Capture AI thinking from MCTS bot
 */
export function captureMCTSThinking(
  result: InternalMCTSResult,
  state: GameState,
  playerId: PlayerId,
  botName: string,
): AIThinking {
  return {
    agentName: botName,
    playerId,
    winProbability: result.winRate,
    evaluatedNodes: result.iterations,
    timeMs: result.timeMs,
    mctsTree: serializeMCTSNode(result.root, state, 5, 0, 2),
    evaluation: calculateEvaluationBreakdown(state, playerId),
  };
}

/**
 * Capture AI thinking from Greedy bot
 */
export function captureGreedyThinking(
  state: GameState,
  playerId: PlayerId,
  botName: string,
  evaluationTimeMs: number = 0,
): AIThinking {
  const evaluation = calculateEvaluationBreakdown(state, playerId);

  return {
    agentName: botName,
    playerId,
    winProbability: evaluation.total,
    evaluatedNodes: 1,
    timeMs: evaluationTimeMs,
    evaluation,
  };
}

/**
 * Create minimal AI thinking for random bot
 */
export function captureRandomThinking(
  state: GameState,
  playerId: PlayerId,
  botName: string,
): AIThinking {
  const evaluation = calculateEvaluationBreakdown(state, playerId);

  return {
    agentName: botName,
    playerId,
    winProbability: 0.5, // Random bot has no opinion
    evaluatedNodes: 0,
    timeMs: 0,
    evaluation,
  };
}
