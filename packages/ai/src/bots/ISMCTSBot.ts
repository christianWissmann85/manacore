/**
 * ISMCTSBot - Information Set Monte Carlo Tree Search AI
 *
 * Handles hidden information by running multiple determinizations
 * and aggregating statistics across all possible worlds.
 *
 * Better than standard MCTS for games with hidden information
 * (like opponent's hand in MTG).
 */

import type { Bot } from './Bot';
import type { GameState, Action, PlayerId } from '@manacore/engine';
import { runISMCTS, type ISMCTSConfig, DEFAULT_ISMCTS_CONFIG } from '../search/ISMCTS';
import { type RolloutPolicy, randomRolloutPolicy } from '../search/MCTS';

export interface ISMCTSBotConfig extends Partial<ISMCTSConfig> {
  /** Name suffix for identification */
  nameSuffix?: string;
}

export class ISMCTSBot implements Bot {
  private config: ISMCTSConfig;
  private rolloutPolicy: RolloutPolicy;
  private nameSuffix: string;

  // Stats tracking
  private totalDecisions = 0;
  private totalDeterminizations = 0;
  private totalIterations = 0;
  private totalTimeMs = 0;

  /**
   * Create a new ISMCTSBot
   *
   * @param config - ISMCTS configuration options
   * @param rolloutPolicy - Policy for simulations (default: random)
   */
  constructor(config: ISMCTSBotConfig = {}, rolloutPolicy?: RolloutPolicy) {
    this.nameSuffix = config.nameSuffix || '';
    this.config = { ...DEFAULT_ISMCTS_CONFIG, ...config };
    this.rolloutPolicy = rolloutPolicy || randomRolloutPolicy;
  }

  getName(): string {
    const dets = this.config.determinizations;
    const iters = this.config.iterations;
    const suffix = this.nameSuffix ? `-${this.nameSuffix}` : '';
    return `ISMCTSBot-${dets}x${Math.floor(iters! / dets)}${suffix}`;
  }

  getDescription(): string {
    return `ISMCTS with ${this.config.determinizations} determinizations, ${this.config.iterations} total iterations`;
  }

  /**
   * Choose the best action using ISMCTS
   */
  chooseAction(state: GameState, playerId: PlayerId): Action {
    const result = runISMCTS(state, playerId, this.rolloutPolicy, this.config);

    // Track stats
    this.totalDecisions++;
    this.totalDeterminizations += result.determinizations;
    this.totalIterations += result.totalIterations;
    this.totalTimeMs += result.timeMs;

    return result.action;
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    decisions: number;
    totalDeterminizations: number;
    avgDeterminizations: number;
    totalIterations: number;
    avgIterations: number;
    totalTimeMs: number;
    avgTimeMs: number;
  } {
    return {
      decisions: this.totalDecisions,
      totalDeterminizations: this.totalDeterminizations,
      avgDeterminizations:
        this.totalDecisions > 0 ? this.totalDeterminizations / this.totalDecisions : 0,
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
    this.totalDeterminizations = 0;
    this.totalIterations = 0;
    this.totalTimeMs = 0;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ISMCTSConfig>): void {
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
 * Create an ISMCTSBot with specific configuration
 * Convenience factory for common configurations
 */
export function createISMCTSBot(
  determinizations: number,
  iterationsPerDet: number,
  options: { debug?: boolean } = {},
): ISMCTSBot {
  return new ISMCTSBot({
    determinizations,
    iterations: determinizations * iterationsPerDet,
    ismctsDebug: options.debug ?? false,
    rolloutDepth: 0, // Use evaluation function
    moveOrdering: true,
  });
}

/**
 * Pre-configured ISMCTS bot variants
 */
export const ISMCTSBotPresets = {
  /** Fast bot - 5 determinizations x 20 iterations = 100 total */
  fast: () => createISMCTSBot(5, 20),

  /** Standard bot - 10 determinizations x 50 iterations = 500 total */
  standard: () => createISMCTSBot(10, 50),

  /** Strong bot - 10 determinizations x 100 iterations = 1000 total */
  strong: () => createISMCTSBot(10, 100),

  /** Expert bot - 20 determinizations x 100 iterations = 2000 total */
  expert: () => createISMCTSBot(20, 100),
};
