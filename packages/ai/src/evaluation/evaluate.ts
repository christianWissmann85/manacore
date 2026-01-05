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
 * Evaluation weights - can be tuned through self-play
 */
export interface EvaluationWeights {
  life: number; // Life total differential
  board: number; // Creature power on battlefield
  cards: number; // Hand size differential
  mana: number; // Available mana (lands on battlefield)
}

export const DEFAULT_WEIGHTS: EvaluationWeights = {
  life: 0.35,
  board: 0.4,
  cards: 0.15,
  mana: 0.1,
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

  // Life differential (normalized to [-1, 1])
  const lifeDiff = normalizeScore(me.life - opp.life, 40);

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

  // Weighted combination
  const rawScore =
    weights.life * lifeDiff +
    weights.board * boardDiff +
    weights.cards * cardDiff +
    weights.mana * manaDiff;

  // Convert from [-1, 1] to [0, 1]
  return 0.5 + 0.5 * clamp(rawScore, -1, 1);
}

/**
 * Quick evaluation for sorting actions (doesn't need full calculation)
 */
export function quickEvaluate(state: GameState, playerId: PlayerId): number {
  if (state.gameOver) {
    if (state.winner === playerId) return 1000;
    if (state.winner === null) return 0;
    return -1000;
  }

  const me = getPlayer(state, playerId);
  const opp = getOpponent(state, playerId);

  // Simple heuristic: life + board power + cards
  const myPower = getBoardPower(state, me.battlefield);
  const oppPower = getBoardPower(state, opp.battlefield);

  return (
    (me.life - opp.life) * 2 + (myPower - oppPower) * 1.5 + (me.hand.length - opp.hand.length) * 0.5
  );
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

      // Bonus for untapped creatures (can attack/block)
      if (!card.tapped) {
        totalPower += 0.5;
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
