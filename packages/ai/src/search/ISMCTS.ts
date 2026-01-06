/**
 * ISMCTS - Information Set Monte Carlo Tree Search
 *
 * Handles hidden information by running multiple determinizations
 * and aggregating statistics across all "possible worlds."
 *
 * Key insight: In games with hidden information (like opponent's hand),
 * we can't know the true game state. ISMCTS samples multiple possible
 * states and finds actions that work well across all of them.
 *
 * Algorithm:
 * 1. For each determinization:
 *    a. Shuffle opponent's hidden cards into possible positions
 *    b. Run standard MCTS on this determinized state
 *    c. Collect statistics from root's children
 * 2. Aggregate statistics across all determinizations
 * 3. Select action with best average performance
 *
 * @see http://www.aifactory.co.uk/newsletter/2013_01_reduce_burden.htm
 */

import type { GameState, Action, PlayerId } from '@manacore/engine';
import { getLegalActions } from '@manacore/engine';
import {
  runMCTS,
  determinize,
  type MCTSConfig,
  type RolloutPolicy,
  randomRolloutPolicy,
} from './MCTS';

/**
 * ISMCTS configuration options
 */
export interface ISMCTSConfig extends Partial<MCTSConfig> {
  /** Number of determinizations to run (default: 10) */
  determinizations: number;

  /** How to aggregate statistics across determinizations */
  aggregation: 'sum' | 'average';

  /** Enable debug output for ISMCTS */
  ismctsDebug: boolean;
}

export const DEFAULT_ISMCTS_CONFIG: ISMCTSConfig = {
  determinizations: 10,
  aggregation: 'sum',
  ismctsDebug: false,
  // MCTS defaults (inherited)
  iterations: 1000, // Total budget split across determinizations
  rolloutDepth: 0, // Use evaluation function
  explorationConstant: 1.41,
  determinize: false, // We handle determinization ourselves
  moveOrdering: true, // Use weighted selection
};

/**
 * Statistics for an action across all determinizations
 */
interface ActionStats {
  /** Total visits across all determinizations */
  visits: number;
  /** Total reward across all determinizations */
  totalReward: number;
  /** Number of determinizations where this action was available */
  occurrences: number;
  /** The action itself */
  action: Action;
}

/**
 * Result from ISMCTS search
 */
export interface ISMCTSResult {
  /** Best action found */
  action: Action;
  /** Number of determinizations completed */
  determinizations: number;
  /** Total iterations across all determinizations */
  totalIterations: number;
  /** Time spent in milliseconds */
  timeMs: number;
  /** Average win rate of best action */
  winRate: number;
  /** Statistics for top actions */
  topActions: Array<{
    action: Action;
    visits: number;
    avgReward: number;
    occurrences: number;
  }>;
}

/**
 * Create a unique key for an action (for aggregation)
 */
function actionKey(action: Action): string {
  // Create a stable key based on action type and payload
  // Use type narrowing via switch to access payload properties safely
  switch (action.type) {
    case 'CAST_SPELL':
      return `CAST:${action.payload.cardInstanceId}`;
    case 'ACTIVATE_ABILITY':
      return `ABILITY:${action.payload.abilityId}`;
    case 'PLAY_LAND':
      return `LAND:${action.payload.cardInstanceId}`;
    case 'DECLARE_ATTACKERS': {
      // Sort attacker IDs for consistent key
      const attackers = [...(action.payload.attackers || [])].sort().join(',');
      return `ATTACK:${attackers}`;
    }
    case 'DECLARE_BLOCKERS': {
      // Create stable key from blocker assignments
      const blocks = (action.payload.blocks || [])
        .map((b) => `${b.attackerId}:${b.blockerId}`)
        .sort()
        .join(';');
      return `BLOCK:${blocks}`;
    }
    case 'PASS_PRIORITY':
      return 'PASS';
    default:
      return `${action.type}:${JSON.stringify(action.payload)}`;
  }
}

/**
 * Run ISMCTS search from the given state
 *
 * @param state - Current game state (with hidden information)
 * @param playerId - Player to find best move for
 * @param rolloutPolicy - Policy for simulation phase
 * @param config - ISMCTS configuration
 * @returns Best action and search statistics
 */
export function runISMCTS(
  state: GameState,
  playerId: PlayerId,
  rolloutPolicy: RolloutPolicy = randomRolloutPolicy,
  config: Partial<ISMCTSConfig> = {},
): ISMCTSResult {
  const cfg: ISMCTSConfig = { ...DEFAULT_ISMCTS_CONFIG, ...config };
  const startTime = performance.now();

  // Get legal actions from the actual state (before determinization)
  const legalActions = getLegalActions(state, playerId);

  if (legalActions.length === 0) {
    throw new Error('No legal actions available for ISMCTS');
  }

  // Single action? Return immediately
  if (legalActions.length === 1) {
    return {
      action: legalActions[0]!,
      determinizations: 0,
      totalIterations: 0,
      timeMs: performance.now() - startTime,
      winRate: 0.5,
      topActions: [{ action: legalActions[0]!, visits: 0, avgReward: 0.5, occurrences: 1 }],
    };
  }

  // Aggregate action statistics across all determinizations
  const actionStats = new Map<string, ActionStats>();

  // Initialize stats for all legal actions
  for (const action of legalActions) {
    const key = actionKey(action);
    actionStats.set(key, {
      visits: 0,
      totalReward: 0,
      occurrences: 0,
      action,
    });
  }

  // Calculate iterations per determinization
  const iterationsPerDet = Math.max(
    10,
    Math.floor((cfg.iterations || 1000) / cfg.determinizations),
  );

  let totalIterations = 0;

  // Run MCTS for each determinization
  for (let d = 0; d < cfg.determinizations; d++) {
    // Create determinized state (shuffle opponent's hidden cards)
    const detState = determinize(state, playerId);

    // Run standard MCTS on this determinization
    const mctsResult = runMCTS(detState, playerId, rolloutPolicy, {
      ...cfg,
      iterations: iterationsPerDet,
      determinize: false, // Already determinized
      debug: false, // Suppress per-determinization debug
      profile: false,
    });

    totalIterations += mctsResult.iterations;

    // Aggregate statistics from root's children
    for (const child of mctsResult.root.children) {
      if (!child.action) continue;

      const key = actionKey(child.action);
      let stats = actionStats.get(key);

      // Action might not be in our original legal actions (due to determinization)
      // In that case, skip it
      if (!stats) {
        continue;
      }

      stats.visits += child.visits;
      stats.totalReward += child.totalReward;
      stats.occurrences++;
    }

    if (cfg.ismctsDebug) {
      const bestChild = mctsResult.root.children.reduce(
        (best, c) => (c.visits > (best?.visits || 0) ? c : best),
        mctsResult.root.children[0],
      );
      console.log(
        `[ISMCTS] Det ${d + 1}/${cfg.determinizations}: ` +
          `${mctsResult.iterations} iters, best=${bestChild?.action?.type} (${bestChild?.visits} visits)`,
      );
    }
  }

  // Select best action based on aggregated statistics
  let bestAction: Action | null = null;
  let bestScore = -Infinity;

  const topActions: ISMCTSResult['topActions'] = [];

  for (const [_key, stats] of actionStats) {
    if (stats.visits === 0) continue;

    // Calculate average reward
    const avgReward = stats.totalReward / stats.visits;

    topActions.push({
      action: stats.action,
      visits: stats.visits,
      avgReward,
      occurrences: stats.occurrences,
    });

    // Score based on aggregation method
    let score: number;
    if (cfg.aggregation === 'average') {
      score = avgReward;
    } else {
      // 'sum' - prefer actions that were tried more across determinizations
      score = stats.visits;
    }

    if (score > bestScore) {
      bestScore = score;
      bestAction = stats.action;
    }
  }

  // Sort top actions by visits
  topActions.sort((a, b) => b.visits - a.visits);

  // Fallback if no action was selected
  if (!bestAction) {
    bestAction = legalActions[0]!;
  }

  const bestStats = actionStats.get(actionKey(bestAction));
  const winRate = bestStats && bestStats.visits > 0 ? bestStats.totalReward / bestStats.visits : 0.5;

  if (cfg.ismctsDebug) {
    console.log(`[ISMCTS] Complete: ${cfg.determinizations} determinizations, ${totalIterations} total iterations`);
    console.log(`[ISMCTS] Best action: ${bestAction.type}, winRate=${(winRate * 100).toFixed(1)}%`);
    console.log('[ISMCTS] Top actions:');
    for (let i = 0; i < Math.min(5, topActions.length); i++) {
      const ta = topActions[i]!;
      console.log(
        `  ${i + 1}. ${ta.action.type} - visits=${ta.visits}, avgReward=${(ta.avgReward * 100).toFixed(1)}%, occurrences=${ta.occurrences}/${cfg.determinizations}`,
      );
    }
  }

  return {
    action: bestAction,
    determinizations: cfg.determinizations,
    totalIterations,
    timeMs: performance.now() - startTime,
    winRate,
    topActions: topActions.slice(0, 5),
  };
}
