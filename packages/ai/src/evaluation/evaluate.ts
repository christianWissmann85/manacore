/**
 * Board Evaluation Function
 *
 * Evaluates a game state from a player's perspective.
 * Returns a score in range [0, 1]:
 *   - 1.0 = certain win
 *   - 0.5 = even position
 *   - 0.0 = certain loss
 *
 * Used by GreedyBot for 1-ply lookahead and MCTS for leaf evaluation.
 */

import type { GameState, PlayerId, CardInstance } from '@manacore/engine';
import {
  getPlayer,
  getOpponent,
  getEffectivePower,
  getEffectiveToughness,
  isCreature,
  CardLoader,
} from '@manacore/engine';

/**
 * Evaluation weights - normalized to sum to 1.0
 * Used for MCTS backpropagation (returns [0,1] scores)
 */
export interface EvaluationWeights {
  life: number; // Life total differential
  board: number; // Creature power on battlefield
  cards: number; // Hand size differential
  mana: number; // Available mana (lands on battlefield)
  tempo: number; // Tempo advantage (untapped vs tapped permanents)
}

/**
 * Evaluation coefficients - raw multipliers for quickEvaluate
 * Used for greedy action selection (returns unbounded scores)
 */
export interface EvaluationCoefficients {
  life: number; // Multiplier for life differential
  board: number; // Multiplier for board power differential
  cards: number; // Multiplier for card advantage
  mana: number; // Multiplier for mana advantage
  stack: number; // Multiplier for creatures on stack (pending)
}

/**
 * Default weights - tuned for aggressive play
 * Board presence is king, life matters more at low values
 */
export const DEFAULT_WEIGHTS: EvaluationWeights = {
  life: 0.3,
  board: 0.45, // Increased - creatures win games
  cards: 0.1, // Decreased - cards in hand don't win, cards on board do
  mana: 0.1,
  tempo: 0.05, // New - reward having untapped permanents
};

/**
 * Optimized weights from self-play tuning (Phase 2.3)
 * Found via local search optimization with 4355 games
 */
export const TUNED_WEIGHTS: EvaluationWeights = {
  life: 0.31,
  board: 0.46,
  cards: 0.09,
  mana: 0.08,
  tempo: 0.05,
};

/**
 * Default coefficients for quickEvaluate (raw scoring)
 * These produce unbounded scores suitable for greedy action selection
 */
export const DEFAULT_COEFFICIENTS: EvaluationCoefficients = {
  life: 2.0, // Each life point difference
  board: 5.0, // Each power point on battlefield
  cards: 0.1, // Each card in hand
  mana: 1.5, // Each land on battlefield
  stack: 8.0, // Creatures on stack (will resolve!)
};

/**
 * Tuned coefficients derived from optimized weights
 * Scaled to maintain similar score magnitudes
 */
export const TUNED_COEFFICIENTS: EvaluationCoefficients = {
  life: 2.2, // 0.31 / 0.30 * 2.0
  board: 5.1, // 0.46 / 0.45 * 5.0
  cards: 0.09, // 0.09 / 0.10 * 0.1
  mana: 1.2, // 0.08 / 0.10 * 1.5
  stack: 8.0, // Keep same - not tuned yet
};

/**
 * Aggressive weights - prioritize damage and board control
 */
export const AGGRESSIVE_WEIGHTS: EvaluationWeights = {
  life: 0.25,
  board: 0.5,
  cards: 0.05,
  mana: 0.1,
  tempo: 0.1,
};

/**
 * Evaluate a game state from a player's perspective
 *
 * @param state - Current game state
 * @param playerId - Player to evaluate for
 * @param weights - Optional custom weights
 * @returns Score in range [0, 1]
 */
export function evaluate(
  state: GameState,
  playerId: PlayerId,
  weights: EvaluationWeights = DEFAULT_WEIGHTS,
): number {
  // Terminal state check
  if (state.gameOver) {
    if (state.winner === playerId) return 1.0;
    if (state.winner === null) return 0.5; // Draw
    return 0.0; // Loss
  }

  const me = getPlayer(state, playerId);
  const opp = getOpponent(state, playerId);

  // Life differential with non-linear scaling (low life is VERY bad)
  // Being at 5 life vs 20 is worse than being at 15 vs 20
  const myLifeValue = lifeValue(me.life);
  const oppLifeValue = lifeValue(opp.life);
  const lifeDiff = normalizeScore(myLifeValue - oppLifeValue, 20);

  // Board presence (total creature power)
  const myPower = getBoardPower(state, me.battlefield);
  const oppPower = getBoardPower(state, opp.battlefield);
  const boardDiff = normalizeScore(myPower - oppPower, 20);

  // Card advantage (hand size)
  const cardDiff = normalizeScore(me.hand.length - opp.hand.length, 7);

  // Mana advantage (lands on battlefield)
  const myLands = countLands(me.battlefield);
  const oppLands = countLands(opp.battlefield);
  const manaDiff = normalizeScore(myLands - oppLands, 10);

  // Tempo advantage (untapped permanents)
  const myTempo = countUntapped(me.battlefield);
  const oppTempo = countUntapped(opp.battlefield);
  const tempoDiff = normalizeScore(myTempo - oppTempo, 10);

  // Weighted combination
  const rawScore =
    weights.life * lifeDiff +
    weights.board * boardDiff +
    weights.cards * cardDiff +
    weights.mana * manaDiff +
    weights.tempo * tempoDiff;

  // Convert from [-1, 1] to [0, 1]
  return 0.5 + 0.5 * clamp(rawScore, -1, 1);
}

/**
 * Quick evaluation for sorting actions (doesn't need full calculation)
 * Uses DEFAULT_COEFFICIENTS for scoring
 */
export function quickEvaluate(state: GameState, playerId: PlayerId): number {
  return quickEvaluateWithCoefficients(state, playerId, DEFAULT_COEFFICIENTS);
}

/**
 * Quick evaluation with custom coefficients
 * Returns unbounded scores suitable for greedy action selection
 *
 * @param state - Current game state
 * @param playerId - Player to evaluate for
 * @param coeff - Custom coefficients for scoring
 * @returns Raw score (unbounded)
 */
export function quickEvaluateWithCoefficients(
  state: GameState,
  playerId: PlayerId,
  coeff: EvaluationCoefficients,
): number {
  if (state.gameOver) {
    if (state.winner === playerId) return 1000;
    if (state.winner === null) return 0;
    return -1000;
  }

  const me = getPlayer(state, playerId);
  const opp = getOpponent(state, playerId);

  // Simple heuristic: life + board power + cards + mana
  const myPower = getBoardPower(state, me.battlefield);
  const oppPower = getBoardPower(state, opp.battlefield);
  const myLands = countLands(me.battlefield);
  const oppLands = countLands(opp.battlefield);

  // CRITICAL FIX: Account for creatures on the stack!
  // When we cast a creature, it goes on the stack but doesn't resolve immediately.
  // We need to value having creatures on the stack as if they were on the battlefield.
  const myStackPower = getStackPower(state, playerId);
  const oppStackPower = getStackPower(state, playerId === 'player' ? 'opponent' : 'player');

  return (
    (me.life - opp.life) * coeff.life +
    (myPower - oppPower) * coeff.board +
    (myStackPower - oppStackPower) * coeff.stack +
    (me.hand.length - opp.hand.length) * coeff.cards +
    (myLands - oppLands) * coeff.mana
  );
}

/**
 * Calculate power of creatures on the stack (will resolve soon)
 */
function getStackPower(state: GameState, playerId: PlayerId): number {
  let totalPower = 0;

  for (const stackItem of state.stack) {
    if (stackItem.controller === playerId && !stackItem.resolved && !stackItem.countered) {
      const template = CardLoader.getById(stackItem.card.scryfallId);
      if (template && isCreature(template)) {
        const basePower = parseInt(template.power || '0', 10) || 0;
        const baseToughness = parseInt(template.toughness || '0', 10) || 0;
        // Value at full power since it will resolve
        totalPower += basePower + baseToughness * 0.3;
      }
    }
  }

  return totalPower;
}

/**
 * Calculate total creature power on battlefield
 */
function getBoardPower(_state: GameState, battlefield: CardInstance[]): number {
  let totalPower = 0;

  for (const card of battlefield) {
    const template = CardLoader.getById(card.scryfallId);
    if (template && isCreature(template)) {
      const basePower = parseInt(template.power || '0', 10) || 0;
      const baseToughness = parseInt(template.toughness || '0', 10) || 0;
      const power = getEffectivePower(card, basePower);
      const toughness = getEffectiveToughness(card, baseToughness);

      // Value creatures by power, with bonus for toughness
      totalPower += power + toughness * 0.3;

      // Attacking creatures are GOOD - they're about to deal damage!
      // Don't penalize tapped creatures if they're attacking
      if (card.attacking) {
        totalPower += power * 1.5; // Huge bonus for attacking - damage is coming!
      } else if (!card.tapped) {
        // Small bonus for untapped creatures (can attack/block)
        totalPower += 0.3;
      }
    }
  }

  return totalPower;
}

/**
 * Count lands on battlefield
 */
function countLands(battlefield: CardInstance[]): number {
  let count = 0;

  for (const card of battlefield) {
    const template = CardLoader.getById(card.scryfallId);
    if (template && template.type_line?.toLowerCase().includes('land')) {
      count++;
    }
  }

  return count;
}

/**
 * Normalize a value to [-1, 1] range
 */
function normalizeScore(value: number, maxExpected: number): number {
  return clamp(value / maxExpected, -1, 1);
}

/**
 * Clamp a value to [min, max]
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Non-linear life value - low life is disproportionately bad
 * 20 life = 20, 10 life = 8, 5 life = 3, 1 life = 0.5
 */
function lifeValue(life: number): number {
  if (life <= 0) return -10; // Dead or about to die
  if (life >= 20) return life; // Above starting life is linear
  // Quadratic scaling below 20: life^1.5 / sqrt(20)
  return Math.pow(life, 1.5) / Math.sqrt(20);
}

/**
 * Count untapped permanents (tempo indicator)
 */
function countUntapped(battlefield: CardInstance[]): number {
  let count = 0;
  for (const card of battlefield) {
    if (!card.tapped) {
      const template = CardLoader.getById(card.scryfallId);
      if (template) {
        // Creatures count more than lands for tempo
        if (template.type_line?.toLowerCase().includes('creature')) {
          count += 2;
        } else {
          count += 1;
        }
      }
    }
  }
  return count;
}
