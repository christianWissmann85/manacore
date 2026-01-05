/**
 * MCTSNode - Node in the Monte Carlo Tree Search tree
 *
 * Each node represents a game state after taking an action.
 * Tracks visit counts and total rewards for UCB1 selection.
 */

import type { GameState, Action } from '@manacore/engine';

export interface MCTSNode {
  /** Game state at this node */
  state: GameState;

  /** Action that led to this node (null for root) */
  action: Action | null;

  /** Parent node (null for root) */
  parent: MCTSNode | null;

  /** Child nodes */
  children: MCTSNode[];

  /** Number of times this node was visited */
  visits: number;

  /** Total reward accumulated (sum of all simulation results) */
  totalReward: number;

  /** Actions not yet expanded into children */
  untriedActions: Action[];

  /** Player who made the move to reach this state */
  playerToMove: 'player' | 'opponent';
}

/**
 * Create a new MCTS node
 */
export function createMCTSNode(
  state: GameState,
  action: Action | null,
  parent: MCTSNode | null,
  untriedActions: Action[],
): MCTSNode {
  return {
    state,
    action,
    parent,
    children: [],
    visits: 0,
    totalReward: 0,
    untriedActions,
    playerToMove: state.priorityPlayer,
  };
}

/**
 * Check if node is fully expanded (all actions have been tried)
 */
export function isFullyExpanded(node: MCTSNode): boolean {
  return node.untriedActions.length === 0;
}

/**
 * Check if node is terminal (game over)
 */
export function isTerminal(node: MCTSNode): boolean {
  return node.state.gameOver;
}

/**
 * Get the win rate for this node
 */
export function getWinRate(node: MCTSNode): number {
  if (node.visits === 0) return 0;
  return node.totalReward / node.visits;
}

/**
 * UCB1 formula for node selection
 *
 * UCB1 = winRate + C * sqrt(ln(parentVisits) / visits)
 *
 * @param node - Node to calculate UCB1 for
 * @param explorationConstant - C value (default sqrt(2) ≈ 1.41)
 * @returns UCB1 value (higher = more promising)
 */
export function calculateUCB1(node: MCTSNode, explorationConstant = 1.41): number {
  if (node.visits === 0) {
    return Infinity; // Unvisited nodes have highest priority
  }

  if (!node.parent) {
    return getWinRate(node); // Root node - just return win rate
  }

  const exploitation = node.totalReward / node.visits;
  const exploration = explorationConstant * Math.sqrt(Math.log(node.parent.visits) / node.visits);

  return exploitation + exploration;
}

/**
 * Select the best child using UCB1
 */
export function selectBestChild(node: MCTSNode, explorationConstant = 1.41): MCTSNode | null {
  if (node.children.length === 0) {
    return null;
  }

  let bestChild: MCTSNode | null = null;
  let bestUCB1 = -Infinity;

  for (const child of node.children) {
    const ucb1 = calculateUCB1(child, explorationConstant);
    if (ucb1 > bestUCB1) {
      bestUCB1 = ucb1;
      bestChild = child;
    }
  }

  return bestChild;
}

/**
 * Select the most visited child (for final move selection)
 */
export function selectMostVisitedChild(node: MCTSNode): MCTSNode | null {
  if (node.children.length === 0) {
    return null;
  }

  let bestChild: MCTSNode | null = null;
  let mostVisits = -1;

  for (const child of node.children) {
    if (child.visits > mostVisits) {
      mostVisits = child.visits;
      bestChild = child;
    }
  }

  return bestChild;
}

/**
 * Backpropagate result up the tree
 *
 * @param node - Leaf node to start from
 * @param reward - Reward value from evaluating player's perspective (1.0 = best, 0.0 = worst)
 * @param evaluatingPlayer - Which player the reward is evaluated for
 */
export function backpropagate(
  node: MCTSNode | null,
  reward: number,
  evaluatingPlayer: 'player' | 'opponent',
): void {
  let current = node;

  while (current !== null) {
    current.visits++;

    // The reward is from evaluatingPlayer's perspective
    // We need to assign reward based on who made the move leading to this node
    if (current.parent) {
      const parentPlayer = current.parent.playerToMove;
      // If the parent (who made the move) is the evaluating player, use reward directly
      // Otherwise, flip it (opponent's gain is our loss)
      if (parentPlayer === evaluatingPlayer) {
        current.totalReward += reward;
      } else {
        current.totalReward += 1 - reward;
      }
    } else {
      // Root node - use reward directly (it's from our perspective)
      current.totalReward += reward;
    }

    current = current.parent;
  }
}
