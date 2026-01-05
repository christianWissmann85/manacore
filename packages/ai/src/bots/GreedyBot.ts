/**
 * GreedyBot - 1-ply lookahead AI
 *
 * Evaluates each legal action by applying it and scoring the result.
 * Picks the action that leads to the best immediate board state.
 *
 * Strengths:
 * - Much stronger than RandomBot
 * - Fast (single evaluation per action)
 * - Good baseline for MCTS comparison
 *
 * Weaknesses:
 * - No look-ahead beyond immediate result
 * - Can't see opponent responses
 * - May miss long-term strategies
 */

import type { Bot } from './Bot';
import type { GameState, Action, PlayerId } from '@manacore/engine';
import { getLegalActions, applyAction } from '@manacore/engine';
import { quickEvaluate } from '../evaluation/evaluate';

export class GreedyBot implements Bot {
  private rng: () => number;
  private debug = false;
  private totalDecisions = 0;
  private totalActionsEvaluated = 0;
  private recentActions: Action[] = [];
  private readonly MAX_RECENT_ACTIONS = 10;

  /**
   * Create a new GreedyBot
   * @param seed - Optional RNG seed for tie-breaking
   * @param debug - Enable debug output
   */
  constructor(seed?: number, debug = false) {
    this.debug = debug;
    if (seed !== undefined) {
      this.rng = createSeededRandom(seed);
    } else {
      this.rng = Math.random;
    }
  }

  getName(): string {
    return 'GreedyBot';
  }

  getDescription(): string {
    return '1-ply lookahead, picks best immediate outcome';
  }

  /**
   * Enable/disable debug output
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  /**
   * Choose the action that leads to the best board state
   */
  chooseAction(state: GameState, playerId: PlayerId): Action {
    const startTime = Date.now();
    const legalActions = getLegalActions(state, playerId);

    if (legalActions.length === 0) {
      throw new Error(
        `No legal actions available for ${playerId}. ` +
          `State: phase=${state.phase}, step=${state.step}, ` +
          `activePlayer=${state.activePlayer}, priorityPlayer=${state.priorityPlayer}, ` +
          `turn=${state.turnCount}`,
      );
    }

    // Single action? Take it.
    if (legalActions.length === 1) {
      return legalActions[0]!;
    }

    // Optimization: If we have too many actions, use heuristics
    let actionsToEvaluate = legalActions;
    if (legalActions.length > 100) {
      // Prioritize: spells > abilities > attacks > blocks > pass
      actionsToEvaluate = this.filterImportantActions(legalActions);
      if (this.debug) {
        console.log(
          `[GreedyBot] Filtered ${legalActions.length} actions down to ${actionsToEvaluate.length}`,
        );
      }
    }

    // Evaluate each action
    const scoredActions: Array<{ action: Action; score: number }> = [];

    for (const action of actionsToEvaluate) {
      try {
        // Apply action and evaluate resulting state
        const newState = applyAction(state, action);
        let score = quickEvaluate(newState, playerId);

        // ANTI-LOOP FIX: Penalize repetitive ability activations
        // If we've activated the same ability recently, reduce its score
        if (action.type === 'ACTIVATE_ABILITY') {
          const sameAbilityCount = this.countRecentSameAbility(action);
          if (sameAbilityCount > 0) {
            // Exponentially penalize repeated activations
            // 1st repeat: -10, 2nd: -100, 3rd: -1000, etc.
            const penalty = Math.pow(10, sameAbilityCount + 1);
            score -= penalty;

            if (this.debug && sameAbilityCount >= 2) {
              console.log(
                `[GreedyBot] Penalizing repeated ability ${action.payload.abilityId}: ` +
                  `${sameAbilityCount} recent uses, penalty=${penalty}`,
              );
            }
          }
        }

        scoredActions.push({ action, score });
      } catch {
        // If action fails, give it worst score
        scoredActions.push({ action, score: -Infinity });
      }
    }

    this.totalDecisions++;
    this.totalActionsEvaluated += actionsToEvaluate.length;

    const elapsed = Date.now() - startTime;

    // Debug output for slow decisions
    if (this.debug && (elapsed > 100 || legalActions.length > 50)) {
      console.log(
        `[GreedyBot] Turn ${state.turnCount} ${state.phase}: ` +
          `${legalActions.length} actions evaluated in ${elapsed}ms`,
      );
    }

    // Sort by score (descending)
    scoredActions.sort((a, b) => b.score - a.score);

    // Get all actions with the best score (for tie-breaking)
    const bestScore = scoredActions[0]!.score;
    const bestActions = scoredActions.filter((sa) => sa.score === bestScore);

    // Random tie-break among equally good actions
    const index = Math.floor(this.rng() * bestActions.length);
    const chosenAction = bestActions[index]!.action;

    // Track this action for repetition detection
    this.recentActions.push(chosenAction);
    if (this.recentActions.length > this.MAX_RECENT_ACTIONS) {
      this.recentActions.shift();
    }

    return chosenAction;
  }

  /**
   * Get stats for debugging
   */
  getStats(): { decisions: number; actionsEvaluated: number; avgActions: number } {
    return {
      decisions: this.totalDecisions,
      actionsEvaluated: this.totalActionsEvaluated,
      avgActions: this.totalDecisions > 0 ? this.totalActionsEvaluated / this.totalDecisions : 0,
    };
  }

  /**
   * Count how many times we've recently activated the same ability
   */
  private countRecentSameAbility(action: Action): number {
    if (action.type !== 'ACTIVATE_ABILITY') {
      return 0;
    }

    const abilityId = action.payload.abilityId;
    let count = 0;

    // Look at recent actions (more recent = more weight)
    for (let i = this.recentActions.length - 1; i >= 0; i--) {
      const recent = this.recentActions[i];
      if (recent?.type === 'ACTIVATE_ABILITY' && recent.payload.abilityId === abilityId) {
        count++;
      }
    }

    return count;
  }

  /**
   * Filter down to important actions when there are too many
   * This is a heuristic to keep GreedyBot fast
   */
  private filterImportantActions(actions: Action[]): Action[] {
    const MAX_ACTIONS = 50;
    const filtered: Action[] = [];

    // Priority 1: Always include PASS_PRIORITY and END_TURN
    const passActions = actions.filter((a) => a.type === 'PASS_PRIORITY' || a.type === 'END_TURN');
    filtered.push(...passActions);

    // Priority 2: Cast spells (limited to first 10)
    const castActions = actions.filter((a) => a.type === 'CAST_SPELL');
    filtered.push(...castActions.slice(0, 10));

    // Priority 3: Activate abilities (limited to first 10)
    const abilityActions = actions.filter((a) => a.type === 'ACTIVATE_ABILITY');
    filtered.push(...abilityActions.slice(0, 10));

    // Priority 4: Attack declarations (limited)
    const attackActions = actions.filter((a) => a.type === 'DECLARE_ATTACKERS');
    // Include: no attack, all attack, and some individual attacks
    const getAttackerCount = (a: Action): number => {
      if (a.type === 'DECLARE_ATTACKERS') {
        return a.payload.attackers.length;
      }
      return 0;
    };
    const noAttack = attackActions.find((a) => getAttackerCount(a) === 0);
    const allAttack = attackActions.reduce(
      (max, a) => (getAttackerCount(a) > getAttackerCount(max!) ? a : max),
      attackActions[0],
    );
    if (noAttack) filtered.push(noAttack);
    if (allAttack && allAttack !== noAttack) filtered.push(allAttack);
    // Add a few individual attacks
    filtered.push(...attackActions.filter((a) => getAttackerCount(a) === 1).slice(0, 5));

    // Priority 5: Block declarations (limited)
    const blockActions = actions.filter((a) => a.type === 'DECLARE_BLOCKERS');
    const getBlockCount = (a: Action): number => {
      if (a.type === 'DECLARE_BLOCKERS') {
        return a.payload.blocks.length;
      }
      return 0;
    };
    const noBlock = blockActions.find((a) => getBlockCount(a) === 0);
    if (noBlock) filtered.push(noBlock);
    // Add some blocking options
    filtered.push(...blockActions.filter((a) => getBlockCount(a) > 0).slice(0, 10));

    // Priority 6: Play lands
    const landActions = actions.filter((a) => a.type === 'PLAY_LAND');
    filtered.push(...landActions.slice(0, 5));

    // Deduplicate and limit
    const unique = [...new Set(filtered)];
    return unique.slice(0, MAX_ACTIONS);
  }
}

/**
 * Create a seeded random number generator
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;

  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
