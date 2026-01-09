/**
 * Reward Shaping for RL Training
 *
 * Provides dense intermediate rewards based on game state changes.
 * This helps the agent learn faster by getting feedback on good/bad moves
 * before the game ends.
 *
 * Key principles:
 * 1. Shaped rewards are much smaller than terminal rewards (0.01-0.1 vs ±1.0)
 * 2. Rewards are based on state deltas, not absolute values
 * 3. Terminal rewards (+1/-1) remain unchanged
 */

import type { GameState, PlayerId, CardInstance } from '@manacore/engine';
import { CardLoader, isCreature, isLand, getEffectivePower } from '@manacore/engine';

/**
 * Features used for reward shaping
 */
export interface ShapingFeatures {
  lifeDelta: number; // (player - opponent) / 40
  boardPowerDelta: number; // (player power - opponent power) / 30
  creatureCountDelta: number; // (player creatures - opponent creatures) / 10
  cardAdvantage: number; // (player hand - opponent hand) / 7
  manaAdvantage: number; // (player lands - opponent lands) / 10
}

/**
 * Weights for each feature in the potential function
 * These determine how much each metric contributes to the shaped reward
 */
export interface ShapingWeights {
  lifeDelta: number;
  boardPowerDelta: number;
  creatureCountDelta: number;
  cardAdvantage: number;
  manaAdvantage: number;
}

/**
 * Default weights - prioritize life and board presence
 */
export const DEFAULT_SHAPING_WEIGHTS: ShapingWeights = {
  lifeDelta: 0.3, // Life is important
  boardPowerDelta: 0.25, // Board presence matters
  creatureCountDelta: 0.2, // Having more creatures is good
  cardAdvantage: 0.15, // Card advantage helps long-term
  manaAdvantage: 0.1, // Mana development
};

/**
 * Extract features used for reward shaping from game state
 */
export function extractShapingFeatures(
  state: GameState,
  playerId: PlayerId = 'player',
): ShapingFeatures {
  const player = state.players[playerId];
  const opponent = state.players[playerId === 'player' ? 'opponent' : 'player'];

  // Count creature stats
  const countCreatureStats = (battlefield: CardInstance[]) => {
    let count = 0;
    let power = 0;

    for (const card of battlefield) {
      const template = CardLoader.getById(card.scryfallId);
      if (template && isCreature(template)) {
        count++;
        const basePower = parseInt(template.power || '0', 10) || 0;
        power += getEffectivePower(card, basePower);
      }
    }

    return { count, power };
  };

  const playerStats = countCreatureStats(player.battlefield);
  const opponentStats = countCreatureStats(opponent.battlefield);

  // Count lands
  const countLands = (battlefield: CardInstance[]) => {
    let count = 0;
    for (const card of battlefield) {
      const template = CardLoader.getById(card.scryfallId);
      if (template && isLand(template)) {
        count++;
      }
    }
    return count;
  };

  const playerLands = countLands(player.battlefield);
  const opponentLands = countLands(opponent.battlefield);

  return {
    lifeDelta: (player.life - opponent.life) / 40,
    boardPowerDelta: (playerStats.power - opponentStats.power) / 30,
    creatureCountDelta: (playerStats.count - opponentStats.count) / 10,
    cardAdvantage: (player.hand.length - opponent.hand.length) / 7,
    manaAdvantage: (playerLands - opponentLands) / 10,
  };
}

/**
 * Calculate the potential function value for a state
 * V(s) = weighted sum of features
 */
export function calculatePotential(
  features: ShapingFeatures,
  weights: ShapingWeights = DEFAULT_SHAPING_WEIGHTS,
): number {
  return (
    weights.lifeDelta * features.lifeDelta +
    weights.boardPowerDelta * features.boardPowerDelta +
    weights.creatureCountDelta * features.creatureCountDelta +
    weights.cardAdvantage * features.cardAdvantage +
    weights.manaAdvantage * features.manaAdvantage
  );
}

/**
 * Calculate shaped reward based on potential-based reward shaping
 *
 * F(s, s') = gamma * V(s') - V(s)
 *
 * This preserves the optimal policy (potential-based shaping theorem)
 * while providing denser rewards.
 *
 * @param prevFeatures - Features from previous state
 * @param currFeatures - Features from current state
 * @param gamma - Discount factor (typically 0.99)
 * @param scale - Scale factor to keep rewards small (typically 0.1)
 * @param weights - Feature weights for potential function
 */
export function calculateShapedReward(
  prevFeatures: ShapingFeatures,
  currFeatures: ShapingFeatures,
  gamma: number = 0.99,
  scale: number = 0.1,
  weights: ShapingWeights = DEFAULT_SHAPING_WEIGHTS,
): number {
  const prevPotential = calculatePotential(prevFeatures, weights);
  const currPotential = calculatePotential(currFeatures, weights);

  // Potential-based reward shaping: F = gamma * V(s') - V(s)
  const shapedReward = (gamma * currPotential - prevPotential) * scale;

  // Clamp to reasonable range to avoid extreme values
  return Math.max(-0.5, Math.min(0.5, shapedReward));
}

/**
 * Configuration for reward shaping
 */
export interface RewardShapingConfig {
  enabled: boolean;
  gamma: number;
  scale: number;
  weights: ShapingWeights;
}

/**
 * Default reward shaping configuration
 */
export const DEFAULT_REWARD_SHAPING_CONFIG: RewardShapingConfig = {
  enabled: true,
  gamma: 0.99,
  scale: 0.1,
  weights: DEFAULT_SHAPING_WEIGHTS,
};

/**
 * Reward Shaper class - tracks state history and computes shaped rewards
 */
export class RewardShaper {
  private config: RewardShapingConfig;
  private prevFeatures: ShapingFeatures | null = null;

  constructor(config: Partial<RewardShapingConfig> = {}) {
    this.config = { ...DEFAULT_REWARD_SHAPING_CONFIG, ...config };
  }

  /**
   * Calculate reward for a state transition
   *
   * @param state - Current game state
   * @param terminalReward - Terminal reward (1, -1, or 0 for ongoing)
   * @param done - Whether the game is over
   * @returns Combined terminal + shaped reward
   */
  calculateReward(state: GameState, terminalReward: number, done: boolean): number {
    // If game is over, return terminal reward only
    if (done) {
      this.prevFeatures = null;
      return terminalReward;
    }

    // If shaping is disabled, return 0 for non-terminal states
    if (!this.config.enabled) {
      return 0;
    }

    // Extract current features
    const currFeatures = extractShapingFeatures(state, 'player');

    // Calculate shaped reward if we have previous features
    let shapedReward = 0;
    if (this.prevFeatures !== null) {
      shapedReward = calculateShapedReward(
        this.prevFeatures,
        currFeatures,
        this.config.gamma,
        this.config.scale,
        this.config.weights,
      );
    }

    // Update previous features for next step
    this.prevFeatures = currFeatures;

    return shapedReward;
  }

  /**
   * Reset the shaper (call at start of new game)
   */
  reset(): void {
    this.prevFeatures = null;
  }

  /**
   * Initialize with current state (call after game creation)
   */
  initialize(state: GameState): void {
    this.prevFeatures = extractShapingFeatures(state, 'player');
  }
}
