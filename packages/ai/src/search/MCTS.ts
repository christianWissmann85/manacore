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
import {
  evaluate,
  quickEvaluateWithCoefficients,
  TUNED_WEIGHTS,
  TUNED_COEFFICIENTS,
} from '../evaluation/evaluate';
import { TranspositionTable } from './TranspositionTable';

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

  /** Enable move ordering (sort untried actions by type priority) */
  moveOrdering: boolean;

  /** Transposition table for caching statistics (null = disabled) */
  transpositionTable: TranspositionTable | null;
}

export const DEFAULT_MCTS_CONFIG: MCTSConfig = {
  iterations: 500,
  timeLimit: 5000,
  explorationConstant: 1.41,
  rolloutDepth: 20, // Reduced - we use evaluation function for incomplete games
  debug: false,
  profile: false,
  determinize: true, // Default to fair play - don't cheat!
  moveOrdering: false, // Default off for backwards compatibility
  transpositionTable: null, // Default off - create explicitly to enable
};

/**
 * Action type priorities for move ordering (higher = expand first)
 * Based on typical MTG importance: spells matter most, passing least
 */
export const ACTION_PRIORITY: Record<string, number> = {
  CAST_SPELL: 100,
  ACTIVATE_ABILITY: 80,
  DECLARE_ATTACKERS: 60,
  DECLARE_BLOCKERS: 50,
  PLAY_LAND: 40,
  PASS_PRIORITY: 0,
};

/**
 * Order actions by type priority for more efficient MCTS expansion
 * Higher priority actions are placed first and expanded earlier
 */
export function orderActionsByPriority(actions: Action[]): Action[] {
  return [...actions].sort((a, b) => {
    const priorityA = ACTION_PRIORITY[a.type] ?? 20;
    const priorityB = ACTION_PRIORITY[b.type] ?? 20;
    return priorityB - priorityA; // Descending order (highest first)
  });
}

/**
 * Filter out repeated ability activations to prevent infinite loops
 *
 * This prevents MCTS from exploring paths where the same pump ability
 * (like Dragon Engine's {2}: +1/+0) is activated multiple times in a row.
 *
 * @param actions - All available actions
 * @param parentAction - The action that led to the current state
 * @returns Filtered actions with repeated abilities removed
 */
export function filterRepeatedAbilities(actions: Action[], parentAction: Action | null): Action[] {
  // If parent wasn't an ability activation, no filtering needed
  if (!parentAction || parentAction.type !== 'ACTIVATE_ABILITY') {
    return actions;
  }

  const parentAbilityId = parentAction.payload.abilityId;

  // Remove the same ability activation from available actions
  return actions.filter((action) => {
    if (action.type !== 'ACTIVATE_ABILITY') {
      return true; // Keep non-ability actions
    }
    // Filter out the same ability that was just activated
    return action.payload.abilityId !== parentAbilityId;
  });
}

/**
 * Select an action using weighted random selection based on priority
 *
 * Higher priority actions are MORE LIKELY to be selected, but not guaranteed.
 * This preserves MCTS exploration while biasing toward promising moves.
 *
 * Uses softmax-style weighting: P(action) ∝ exp(priority / temperature)
 *
 * @param actions - Actions to select from (will be mutated - selected action removed)
 * @returns The selected action
 */
export function selectWeightedAction(actions: Action[]): Action {
  if (actions.length === 1) {
    return actions.shift()!;
  }

  // Temperature controls how strongly we bias toward high-priority actions
  // Lower = more deterministic, Higher = more uniform
  const temperature = 50;

  // Calculate weights using softmax-style formula
  const weights = actions.map((action) => {
    const priority = ACTION_PRIORITY[action.type] ?? 20;
    return Math.exp(priority / temperature);
  });

  // Sum of all weights
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Random selection weighted by priority
  let random = Math.random() * totalWeight;
  for (let i = 0; i < actions.length; i++) {
    random -= weights[i]!;
    if (random <= 0) {
      return actions.splice(i, 1)[0]!;
    }
  }

  // Fallback (shouldn't happen, but safety first)
  return actions.shift()!;
}

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
  // Transposition table stats
  ttHits: number;
  ttMisses: number;
  ttStores: number;
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
    ttHits: 0,
    ttMisses: 0,
    ttStores: 0,
  };

  // Get transposition table reference for easy access
  const tt = cfg.transpositionTable;

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
  // Note: With weighted selection, we don't need to pre-sort - selection handles priority
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
      // Pick action to expand:
      // - With move ordering: weighted random (biased toward high-priority actions)
      // - Without: uniform random
      const action = cfg.moveOrdering
        ? selectWeightedAction(node.untriedActions)
        : node.untriedActions.splice(Math.floor(Math.random() * node.untriedActions.length), 1)[0]!;

      // Apply action to get new state
      try {
        const newState = applyAction(currentState, action);
        profile.applyActionCount++;
        let childActions = getLegalActions(newState, newState.priorityPlayer);
        profile.getLegalActionsCount++;

        // ANTI-LOOP FIX: Filter out repeated ability activations
        // This prevents infinite loops with pump abilities like Dragon Engine
        childActions = filterRepeatedAbilities(childActions, action);

        // Create child node
        // Note: With weighted selection, we don't need to pre-sort - selection handles priority
        const child = createMCTSNode(newState, action, node, [...childActions]);

        // TRANSPOSITION TABLE: Check if we've seen this state before
        if (tt) {
          const hash = tt.computeHash(newState, playerId);
          const cached = tt.lookup(hash);

          if (cached) {
            // Use cached statistics as priors (virtual visits)
            // This helps guide UCB selection toward previously successful paths
            child.visits = cached.visits;
            child.totalReward = cached.totalReward;
            profile.ttHits++;
          } else {
            profile.ttMisses++;
          }
        }

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
      // No need to clone - applyAction returns a new state via incrementalClone
      let simState = currentState;
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

    // TRANSPOSITION TABLE: Store updated statistics
    if (tt) {
      // Store stats for the expanded node (not root - that doesn't help)
      // We traverse up from the expanded node, storing at each level
      let ttNode: MCTSNode | null = node;
      let depth = 0;

      while (ttNode && ttNode.parent) {
        const hash = tt.computeHash(ttNode.state, playerId);
        tt.store(hash, ttNode.visits, ttNode.totalReward, depth);
        profile.ttStores++;
        ttNode = ttNode.parent;
        depth++;
      }
    }

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
    if (tt) {
      const ttTotal = profile.ttHits + profile.ttMisses;
      const ttHitRate = ttTotal > 0 ? ((profile.ttHits / ttTotal) * 100).toFixed(1) : '0.0';
      console.log(
        `  TT Hits: ${profile.ttHits}, Misses: ${profile.ttMisses}, Stores: ${profile.ttStores}, Hit Rate: ${ttHitRate}%`,
      );
    }
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
      let score = quickEvaluateWithCoefficients(newState, playerId, TUNED_COEFFICIENTS);

      // ANTI-LOOP FIX: Penalize pump abilities (they cause infinite loops)
      // Pump abilities like Dragon Engine's {2}: +1/+0 should not dominate simulations
      if (action.type === 'ACTIVATE_ABILITY') {
        // Check recent history for repetition
        const lastActionJson = state.actionHistory[state.actionHistory.length - 1];
        if (lastActionJson) {
          try {
            const lastAction = JSON.parse(lastActionJson) as Action;
            if (
              lastAction &&
              lastAction.type === 'ACTIVATE_ABILITY' &&
              lastAction.payload &&
              lastAction.payload.abilityId === action.payload.abilityId
            ) {
              // Same ability activated immediately before - penalize HEAVILY
              score -= 1000;
            } else {
              // Heuristic: Avoid pump abilities unless clearly winning
              score -= 5;
            }
          } catch {
            score -= 5;
          }
        } else {
          score -= 5;
        }
      }

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
