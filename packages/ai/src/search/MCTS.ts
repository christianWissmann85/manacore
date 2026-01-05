/**
 * MCTS - Monte Carlo Tree Search implementation
 *
 * Uses UCT (Upper Confidence Bounds for Trees) for node selection.
 * Supports configurable rollout policies and iteration limits.
 */

/* global performance */

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
import {
  evaluate,
  quickEvaluateWithCoefficients,
  TUNED_WEIGHTS,
  TUNED_COEFFICIENTS,
} from '../evaluation/evaluate';

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

  /** Maximum depth for rollouts (0 = no rollout, just evaluate) */
  rolloutDepth: number;

  /** Enable debug output */
  debug: boolean;

  /** Enable profiling output */
  profile: boolean;

  /** Enable determinization (shuffle opponent's hidden cards) */
  determinize: boolean;
}

export const DEFAULT_MCTS_CONFIG: MCTSConfig = {
  iterations: 500,
  timeLimit: 5000,
  explorationConstant: 1.41,
  rolloutDepth: 20, // Reduced - we use evaluation function for incomplete games
  debug: false,
  profile: false,
  determinize: true, // Default to fair play - don't cheat!
};

/**
 * Determinize a game state by shuffling opponent's hidden information
 *
 * This makes MCTS "fair" by not letting it see the opponent's actual hand.
 * We combine opponent's hand + library, shuffle, and redistribute.
 */
export function determinize(state: GameState, playerId: PlayerId): GameState {
  const opponentId = playerId === 'player' ? 'opponent' : 'player';
  const opponent = state.players[opponentId];

  // Combine hand and library (all hidden cards)
  const hiddenCards = [...opponent.hand, ...opponent.library];

  // Fisher-Yates shuffle
  for (let i = hiddenCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [hiddenCards[i], hiddenCards[j]] = [hiddenCards[j]!, hiddenCards[i]!];
  }

  // Redistribute: hand gets original hand size, rest goes to library
  const handSize = opponent.hand.length;
  const newHand = hiddenCards.slice(0, handSize);
  const newLibrary = hiddenCards.slice(handSize);

  // Update zones
  for (const card of newHand) {
    card.zone = 'hand';
  }
  for (const card of newLibrary) {
    card.zone = 'library';
  }

  // Create new state with shuffled opponent zones
  // Use structuredClone for the opponent since we're modifying their zones
  const newState: GameState = {
    ...state,
    players: {
      ...state.players,
      [opponentId]: {
        ...opponent,
        hand: newHand,
        library: newLibrary,
      },
    },
  };

  return newState;
}

/**
 * Profiling statistics for MCTS performance analysis
 */
export interface MCTSProfile {
  totalMs: number;
  selectionMs: number;
  expansionMs: number;
  rolloutMs: number;
  backpropMs: number;
  cloneCount: number;
  applyActionCount: number;
  getLegalActionsCount: number;
  evaluateCount: number;
}

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

  /** Profiling data (if enabled) */
  profile?: MCTSProfile;
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
  const startTime = performance.now();

  // Apply determinization if enabled (shuffle opponent's hidden cards)
  // This makes MCTS "fair" by not letting it peek at opponent's actual hand
  const searchState = cfg.determinize ? determinize(state, playerId) : state;

  // Profiling counters
  const profile: MCTSProfile = {
    totalMs: 0,
    selectionMs: 0,
    expansionMs: 0,
    rolloutMs: 0,
    backpropMs: 0,
    cloneCount: 0,
    applyActionCount: 0,
    getLegalActionsCount: 0,
    evaluateCount: 0,
  };

  // Get legal actions for root
  const rootActions = getLegalActions(searchState, playerId);
  profile.getLegalActionsCount++;

  if (rootActions.length === 0) {
    throw new Error('No legal actions available for MCTS');
  }

  // Single action? Return immediately
  if (rootActions.length === 1) {
    const root = createMCTSNode(searchState, null, null, []);
    return {
      action: rootActions[0]!,
      iterations: 0,
      timeMs: performance.now() - startTime,
      root,
      winRate: 0.5,
    };
  }

  // Create root node
  const root = createMCTSNode(searchState, null, null, [...rootActions]);

  let iterations = 0;

  // Main MCTS loop
  while (iterations < cfg.iterations) {
    // Check time limit
    if (cfg.timeLimit > 0 && performance.now() - startTime >= cfg.timeLimit) {
      break;
    }

    // 1. SELECTION: Traverse tree using UCB1 until we find an expandable node
    const selStart = performance.now();
    let node = root;
    // OPTIMIZATION: Use node.state directly instead of cloning from root each time
    let currentState = node.state;

    while (isFullyExpanded(node) && !isTerminal(node)) {
      const bestChild = selectBestChild(node, cfg.explorationConstant);
      if (!bestChild) break;
      node = bestChild;
      currentState = node.state; // State is stored in node - no clone needed!
    }
    profile.selectionMs += performance.now() - selStart;

    // 2. EXPANSION: Add a new child node if not terminal
    const expStart = performance.now();
    if (!isTerminal(node) && node.untriedActions.length > 0) {
      // Pick a random untried action
      const actionIndex = Math.floor(Math.random() * node.untriedActions.length);
      const action = node.untriedActions.splice(actionIndex, 1)[0]!;

      // Apply action to get new state
      try {
        const newState = applyAction(currentState, action);
        profile.applyActionCount++;
        const childActions = getLegalActions(newState, newState.priorityPlayer);
        profile.getLegalActionsCount++;

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
    profile.expansionMs += performance.now() - expStart;

    // 3. SIMULATION: Play out using rollout policy (or skip if rolloutDepth=0)
    const rollStart = performance.now();
    let evalState = currentState;

    if (cfg.rolloutDepth > 0 && !currentState.gameOver) {
      // Clone once for rollout, then mutate via applyAction
      let simState = structuredClone(currentState);
      profile.cloneCount++;
      let depth = 0;

      while (!simState.gameOver && depth < cfg.rolloutDepth) {
        try {
          const simAction = rolloutPolicy(simState, simState.priorityPlayer);
          simState = applyAction(simState, simAction);
          profile.applyActionCount++;
          depth++;
        } catch {
          // Simulation error - break and evaluate
          break;
        }
      }
      evalState = simState;
    }
    profile.rolloutMs += performance.now() - rollStart;

    // 4. BACKPROPAGATION: Update statistics up the tree
    const backStart = performance.now();
    let reward: number;

    if (evalState.gameOver) {
      // Terminal state - clear win/loss/draw
      if (evalState.winner === playerId) {
        reward = 1.0;
      } else if (evalState.winner === null) {
        reward = 0.5; // Draw
      } else {
        reward = 0.0; // Loss
      }
    } else {
      // Non-terminal - use evaluation function with tuned weights
      reward = evaluate(evalState, playerId, TUNED_WEIGHTS);
      profile.evaluateCount++;
    }

    backpropagate(node, reward, playerId);
    profile.backpropMs += performance.now() - backStart;
    iterations++;
  }

  // Select best action (most visited child of root)
  const bestChild = selectMostVisitedChild(root);

  if (!bestChild || !bestChild.action) {
    // Fallback to first legal action
    return {
      action: rootActions[0]!,
      iterations,
      timeMs: performance.now() - startTime,
      root,
      winRate: 0.5,
    };
  }

  const winRate = bestChild.visits > 0 ? bestChild.totalReward / bestChild.visits : 0.5;
  profile.totalMs = performance.now() - startTime;

  if (cfg.debug) {
    console.log(
      `[MCTS] ${iterations} iterations in ${profile.totalMs.toFixed(0)}ms, ` +
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

  if (cfg.profile) {
    console.log(
      `[MCTS Profile] Total: ${profile.totalMs.toFixed(1)}ms for ${iterations} iterations`,
    );
    console.log(
      `  Selection:  ${profile.selectionMs.toFixed(1)}ms (${((profile.selectionMs / profile.totalMs) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  Expansion:  ${profile.expansionMs.toFixed(1)}ms (${((profile.expansionMs / profile.totalMs) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  Rollout:    ${profile.rolloutMs.toFixed(1)}ms (${((profile.rolloutMs / profile.totalMs) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  Backprop:   ${profile.backpropMs.toFixed(1)}ms (${((profile.backpropMs / profile.totalMs) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  Clones: ${profile.cloneCount}, ApplyAction: ${profile.applyActionCount}, GetLegalActions: ${profile.getLegalActionsCount}, Evaluate: ${profile.evaluateCount}`,
    );
  }

  return {
    action: bestChild.action,
    iterations,
    timeMs: profile.totalMs,
    root,
    winRate,
    profile: cfg.profile ? profile : undefined,
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

/**
 * Greedy rollout policy - picks action with best immediate evaluation
 *
 * Uses quickEvaluateWithCoefficients() with tuned coefficients to score actions.
 * Significantly better simulation quality than random at the cost of more computation.
 */
export function greedyRolloutPolicy(state: GameState, playerId: PlayerId): Action {
  const actions = getLegalActions(state, playerId);
  if (actions.length === 0) {
    throw new Error('No legal actions in rollout');
  }

  // Single action? Return immediately
  if (actions.length === 1) {
    return actions[0]!;
  }

  let bestAction = actions[0]!;
  let bestScore = -Infinity;

  // Limit action evaluation to avoid explosion (same as GreedyBot)
  const maxActionsToEvaluate = 30;
  const actionsToEvaluate =
    actions.length <= maxActionsToEvaluate ? actions : sampleActions(actions, maxActionsToEvaluate);

  for (const action of actionsToEvaluate) {
    try {
      const newState = applyAction(state, action);
      const score = quickEvaluateWithCoefficients(newState, playerId, TUNED_COEFFICIENTS);

      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    } catch {
      // Skip actions that fail to apply
      continue;
    }
  }

  return bestAction;
}

/**
 * Epsilon-greedy rollout policy - mostly greedy with some random exploration
 *
 * @param epsilon - Probability of random action (default 0.1 = 10%)
 */
export function epsilonGreedyRolloutPolicy(
  epsilon = 0.1,
): (state: GameState, playerId: PlayerId) => Action {
  return (state: GameState, playerId: PlayerId): Action => {
    if (Math.random() < epsilon) {
      return randomRolloutPolicy(state, playerId);
    }
    return greedyRolloutPolicy(state, playerId);
  };
}

/**
 * Sample N actions from a list, prioritizing important action types
 */
function sampleActions(actions: Action[], n: number): Action[] {
  // Prioritize: spells > abilities > attacks > blocks > pass
  const spells = actions.filter((a) => a.type === 'CAST_SPELL');
  const abilities = actions.filter((a) => a.type === 'ACTIVATE_ABILITY');
  const attacks = actions.filter((a) => a.type === 'DECLARE_ATTACKERS');
  const blocks = actions.filter((a) => a.type === 'DECLARE_BLOCKERS');
  const lands = actions.filter((a) => a.type === 'PLAY_LAND');
  const other = actions.filter(
    (a) =>
      a.type !== 'CAST_SPELL' &&
      a.type !== 'ACTIVATE_ABILITY' &&
      a.type !== 'DECLARE_ATTACKERS' &&
      a.type !== 'DECLARE_BLOCKERS' &&
      a.type !== 'PLAY_LAND',
  );

  const result: Action[] = [];

  // Take from each category proportionally
  const categories = [spells, abilities, lands, attacks, blocks, other];
  let remaining = n;

  for (const category of categories) {
    if (remaining <= 0) break;
    const take = Math.min(category.length, Math.ceil(remaining / 2));
    for (let i = 0; i < take && i < category.length; i++) {
      result.push(category[i]!);
    }
    remaining -= take;
  }

  // Fill remaining with random from all actions
  while (result.length < n && result.length < actions.length) {
    const randomAction = actions[Math.floor(Math.random() * actions.length)]!;
    if (!result.includes(randomAction)) {
      result.push(randomAction);
    }
  }

  return result;
}
