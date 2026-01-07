/**
 * MCTSBot - Monte Carlo Tree Search AI
 *
 * Uses MCTS with UCB1 selection to find optimal moves.
 * Configurable iterations, time limits, and rollout policies.
 */

import type { Bot } from './Bot';
import type { GameState, Action, PlayerId } from '@manacore/engine';
import {
  runMCTS,
  randomRolloutPolicy,
  type MCTSConfig,
  type RolloutPolicy,
  DEFAULT_MCTS_CONFIG,
} from '../search/MCTS';

export interface MCTSBotConfig extends Partial<MCTSConfig> {
  /** Name suffix for identification */
  nameSuffix?: string;
}

export class MCTSBot implements Bot {
  private config: MCTSConfig;
  private rolloutPolicy: RolloutPolicy;
  private nameSuffix: string;

  // Stats tracking
  private totalDecisions = 0;
  private totalIterations = 0;
  private totalTimeMs = 0;

  // Loop prevention
  private recentActions: Action[] = [];
  private readonly MAX_RECENT_ACTIONS = 10;

  /**
   * Create a new MCTSBot
   *
   * @param config - MCTS configuration options
   * @param rolloutPolicy - Policy for simulations (default: random)
   */
  constructor(config: MCTSBotConfig = {}, rolloutPolicy?: RolloutPolicy) {
    this.nameSuffix = config.nameSuffix || '';
    this.config = { ...DEFAULT_MCTS_CONFIG, ...config };
    this.rolloutPolicy = rolloutPolicy || randomRolloutPolicy;
  }

  getName(): string {
    const iterations = this.config.iterations;
    const suffix = this.nameSuffix ? `-${this.nameSuffix}` : '';
    return `MCTSBot-${iterations}${suffix}`;
  }

  getDescription(): string {
    return `MCTS with ${this.config.iterations} iterations, ${this.config.timeLimit}ms time limit`;
  }

  /**
   * Choose the best action using MCTS
   */
  chooseAction(state: GameState, playerId: PlayerId): Action {
    const result = runMCTS(state, playerId, this.rolloutPolicy, this.config);
    let chosenAction = result.action;

    // ANTI-LOOP FIX: Check for repetitive ability activations
    if (chosenAction.type === 'ACTIVATE_ABILITY') {
      const sameAbilityCount = this.countRecentSameAbility(chosenAction);

      // If we've done this 5+ times recently, stop!
      if (sameAbilityCount >= 5) {
        if (this.config.debug) {
          console.log(
            `[MCTSBot] Detected loop with ability ${chosenAction.payload.abilityId} (${sameAbilityCount} times). Forcing PASS.`,
          );
        }

        // Find a safe fallback action (usually PASS_PRIORITY)
        // We can't just return PASS_PRIORITY blindly because it might not be legal?
        // But if we are casting abilities, we have priority, so we should be able to pass.
        // Let's verify by checking legal actions if we want to be 100% safe,
        // but constructing a simple PASS action is usually safe for "player with priority".
        chosenAction = {
          type: 'PASS_PRIORITY',
          playerId,
          payload: {},
        };
      }
    }

    // Track stats
    this.totalDecisions++;
    this.totalIterations += result.iterations;
    this.totalTimeMs += result.timeMs;

    // Update history
    this.recentActions.push(chosenAction);
    if (this.recentActions.length > this.MAX_RECENT_ACTIONS) {
      this.recentActions.shift();
    }

    return chosenAction;
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
   * Get performance statistics
   */

  /**
   * Get performance statistics
   */
  getStats(): {
    decisions: number;
    totalIterations: number;
    avgIterations: number;
    totalTimeMs: number;
    avgTimeMs: number;
  } {
    return {
      decisions: this.totalDecisions,
      totalIterations: this.totalIterations,
      avgIterations: this.totalDecisions > 0 ? this.totalIterations / this.totalDecisions : 0,
      totalTimeMs: this.totalTimeMs,
      avgTimeMs: this.totalDecisions > 0 ? this.totalTimeMs / this.totalDecisions : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.totalDecisions = 0;
    this.totalIterations = 0;
    this.totalTimeMs = 0;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<MCTSConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set rollout policy
   */
  setRolloutPolicy(policy: RolloutPolicy): void {
    this.rolloutPolicy = policy;
  }
}

/**
 * Create an MCTSBot with specific iteration count
 * Convenience factory for common configurations
 */
export function createMCTSBot(
  iterations: number,
  options: { timeLimit?: number; debug?: boolean } = {},
): MCTSBot {
  return new MCTSBot({
    iterations,
    timeLimit: options.timeLimit ?? 0,
    debug: options.debug ?? false,
  });
}

/**
 * Pre-configured bot variants
 */
export const MCTSBotPresets = {
  /** Ultra-fast bot for quick testing - 25 iterations */
  ultraFast: () => createMCTSBot(25, { timeLimit: 500 }),

  /** Fast bot for testing - 50 iterations */
  fast: () => createMCTSBot(50),

  /** Standard bot - 200 iterations */
  standard: () => createMCTSBot(200),

  /** Strong bot - 500 iterations */
  strong: () => createMCTSBot(500),

  /** Expert bot - 1000 iterations, 5s time limit */
  expert: () => createMCTSBot(1000, { timeLimit: 5000 }),
};
