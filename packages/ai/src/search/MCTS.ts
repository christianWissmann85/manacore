/**
 * MCTS - Monte Carlo Tree Search implementation
 *
 * Uses UCT (Upper Confidence Bounds for Trees) for node selection.
 * Supports configurable rollout policies and iteration limits.
 */

import type { GameState, Action, PlayerId } from '@manacore/engine';
import { getLegalActions, applyAction } from '@manacore/engine';
import {
  type MCTSNode,
  createMCTSNode,
  isFullyExpanded,
  isTerminal,
  selectBestChild,
  selectMostVisitedChild,
  backpropagate,
} from './MCTSNode';
import { evaluate } from '../evaluation/evaluate';

/**
 * Rollout policy function type
 * Given a state and player, returns an action to take during simulation
 */
export type RolloutPolicy = (state: GameState, playerId: PlayerId) => Action;

/**
 * MCTS configuration options
 */
export interface MCTSConfig {
  /** Maximum number of iterations */
  iterations: number;

  /** Maximum time in milliseconds (0 = no limit) */
  timeLimit: number;

  /** UCB1 exploration constant (default sqrt(2)) */
  explorationConstant: number;

  /** Maximum depth for rollouts */
  rolloutDepth: number;

  /** Enable debug output */
  debug: boolean;
}

export const DEFAULT_MCTS_CONFIG: MCTSConfig = {
  iterations: 500,
  timeLimit: 5000,
  explorationConstant: 1.41,
  rolloutDepth: 20, // Reduced - we use evaluation function for incomplete games
  debug: false,
};

/**
 * MCTS search result
 */
export interface MCTSResult {
  /** Best action found */
  action: Action;

  /** Number of iterations completed */
  iterations: number;

  /** Time spent in milliseconds */
  timeMs: number;

  /** Root node (for debugging/visualization) */
  root: MCTSNode;

  /** Win rate of best action */
  winRate: number;
}

/**
 * Run MCTS search from the given state
 *
 * @param state - Current game state
 * @param playerId - Player to find best move for
 * @param rolloutPolicy - Policy for simulation phase
 * @param config - MCTS configuration
 * @returns Best action and search statistics
 */
export function runMCTS(
  state: GameState,
  playerId: PlayerId,
  rolloutPolicy: RolloutPolicy,
  config: Partial<MCTSConfig> = {},
): MCTSResult {
  const cfg = { ...DEFAULT_MCTS_CONFIG, ...config };
  const startTime = Date.now();

  // Get legal actions for root
  const rootActions = getLegalActions(state, playerId);

  if (rootActions.length === 0) {
    throw new Error('No legal actions available for MCTS');
  }

  // Single action? Return immediately
  if (rootActions.length === 1) {
    const root = createMCTSNode(state, null, null, []);
    return {
      action: rootActions[0]!,
      iterations: 0,
      timeMs: Date.now() - startTime,
      root,
      winRate: 0.5,
    };
  }

  // Create root node
  const root = createMCTSNode(state, null, null, [...rootActions]);

  let iterations = 0;

  // Main MCTS loop
  while (iterations < cfg.iterations) {
    // Check time limit
    if (cfg.timeLimit > 0 && Date.now() - startTime >= cfg.timeLimit) {
      break;
    }

    // 1. SELECTION: Traverse tree using UCB1 until we find an expandable node
    let node = root;
    let currentState = structuredClone(state);

    while (isFullyExpanded(node) && !isTerminal(node)) {
      const bestChild = selectBestChild(node, cfg.explorationConstant);
      if (!bestChild) break;

      node = bestChild;
      // State is already in the node, but we track it for clarity
      currentState = node.state;
    }

    // 2. EXPANSION: Add a new child node if not terminal
    if (!isTerminal(node) && node.untriedActions.length > 0) {
      // Pick a random untried action
      const actionIndex = Math.floor(Math.random() * node.untriedActions.length);
      const action = node.untriedActions.splice(actionIndex, 1)[0]!;

      // Apply action to get new state
      try {
        const newState = applyAction(currentState, action);
        const childActions = getLegalActions(newState, newState.priorityPlayer);

        // Create child node
        const child = createMCTSNode(newState, action, node, [...childActions]);
        node.children.push(child);
        node = child;
        currentState = newState;
      } catch {
        // Action failed - skip this expansion
        iterations++;
        continue;
      }
    }

    // 3. SIMULATION: Play out the game using rollout policy
    // Use a lighter simulation - fewer steps but evaluate at the end
    let simState = structuredClone(currentState);
    let depth = 0;

    while (!simState.gameOver && depth < cfg.rolloutDepth) {
      try {
        const simAction = rolloutPolicy(simState, simState.priorityPlayer);
        simState = applyAction(simState, simAction);
        depth++;
      } catch {
        // Simulation error - break and evaluate
        break;
      }
    }

    // 4. BACKPROPAGATION: Update statistics up the tree
    let reward: number;

    if (simState.gameOver) {
      // Terminal state - clear win/loss/draw
      if (simState.winner === playerId) {
        reward = 1.0;
      } else if (simState.winner === null) {
        reward = 0.5; // Draw
      } else {
        reward = 0.0; // Loss
      }
    } else {
      // Non-terminal - use evaluation function
      // This is the key: evaluate() returns score from playerId's perspective [0,1]
      reward = evaluate(simState, playerId);
    }

    // Backpropagate from playerId's perspective
    backpropagate(node, reward, playerId);
    iterations++;
  }

  // Select best action (most visited child of root)
  const bestChild = selectMostVisitedChild(root);

  if (!bestChild || !bestChild.action) {
    // Fallback to first legal action
    return {
      action: rootActions[0]!,
      iterations,
      timeMs: Date.now() - startTime,
      root,
      winRate: 0.5,
    };
  }

  const winRate = bestChild.visits > 0 ? bestChild.totalReward / bestChild.visits : 0.5;

  if (cfg.debug) {
    console.log(
      `[MCTS] ${iterations} iterations in ${Date.now() - startTime}ms, ` +
        `best action visits=${bestChild.visits}, winRate=${(winRate * 100).toFixed(1)}%`,
    );

    // Show top actions
    const sortedChildren = [...root.children].sort((a, b) => b.visits - a.visits);
    console.log('[MCTS] Top actions:');
    for (let i = 0; i < Math.min(5, sortedChildren.length); i++) {
      const child = sortedChildren[i]!;
      const wr = child.visits > 0 ? child.totalReward / child.visits : 0;
      console.log(
        `  ${i + 1}. ${child.action?.type} - visits=${child.visits}, winRate=${(wr * 100).toFixed(1)}%`,
      );
    }
  }

  return {
    action: bestChild.action,
    iterations,
    timeMs: Date.now() - startTime,
    root,
    winRate,
  };
}

/**
 * Random rollout policy - picks random legal actions
 */
export function randomRolloutPolicy(state: GameState, playerId: PlayerId): Action {
  const actions = getLegalActions(state, playerId);
  if (actions.length === 0) {
    throw new Error('No legal actions in rollout');
  }
  return actions[Math.floor(Math.random() * actions.length)]!;
}
