/**
 * TunableBot - GreedyBot with configurable evaluation coefficients
 *
 * Used for weight tuning experiments. Uses 1-ply lookahead like GreedyBot
 * but allows custom evaluation coefficients for tuning.
 *
 * NOTE: Uses quickEvaluateWithCoefficients (raw scores) not evaluate() (normalized).
 * This matches GreedyBot's scoring style for fair comparison.
 */

import type { Bot } from '../bots/Bot';
import type { GameState, Action, PlayerId } from '@manacore/engine';
import { getLegalActions, applyAction } from '@manacore/engine';
import {
  quickEvaluateWithCoefficients,
  type EvaluationWeights,
  type EvaluationCoefficients,
  DEFAULT_WEIGHTS,
  DEFAULT_COEFFICIENTS,
} from '../evaluation/evaluate';

/**
 * Normalize weights to sum to 1.0
 * Returns DEFAULT_WEIGHTS if input contains NaN or sums to 0
 */
export function normalizeWeights(weights: EvaluationWeights): EvaluationWeights {
  // Handle undefined/NaN values by falling back to defaults
  const life = Number.isFinite(weights.life) ? weights.life : DEFAULT_WEIGHTS.life;
  const board = Number.isFinite(weights.board) ? weights.board : DEFAULT_WEIGHTS.board;
  const cards = Number.isFinite(weights.cards) ? weights.cards : DEFAULT_WEIGHTS.cards;
  const mana = Number.isFinite(weights.mana) ? weights.mana : DEFAULT_WEIGHTS.mana;
  const tempo = Number.isFinite(weights.tempo) ? weights.tempo : DEFAULT_WEIGHTS.tempo;

  const sum = life + board + cards + mana + tempo;
  if (sum === 0 || !Number.isFinite(sum)) return DEFAULT_WEIGHTS;

  return {
    life: life / sum,
    board: board / sum,
    cards: cards / sum,
    mana: mana / sum,
    tempo: tempo / sum,
  };
}

/**
 * Convert normalized weights to coefficients
 * Scales weights to produce similar magnitude scores as DEFAULT_COEFFICIENTS
 */
export function weightsToCoefficients(weights: EvaluationWeights): EvaluationCoefficients {
  const normalized = normalizeWeights(weights);

  // Scale factors based on DEFAULT_COEFFICIENTS magnitudes
  // life: 2.0 at weight 0.30 → scale = 2.0/0.30 = 6.67
  // board: 5.0 at weight 0.45 → scale = 5.0/0.45 = 11.11
  // cards: 0.1 at weight 0.10 → scale = 0.1/0.10 = 1.0
  // mana: 1.5 at weight 0.10 → scale = 1.5/0.10 = 15.0
  return {
    life: normalized.life * 6.67,
    board: normalized.board * 11.11,
    cards: normalized.cards * 1.0,
    mana: normalized.mana * 15.0,
    stack: DEFAULT_COEFFICIENTS.stack, // Not tuned yet
  };
}

export class TunableBot implements Bot {
  private weights: EvaluationWeights;
  private coefficients: EvaluationCoefficients;
  private rng: () => number;
  private name: string;
  private recentActions: Action[] = [];
  private readonly MAX_RECENT_ACTIONS = 10;

  constructor(weights: EvaluationWeights, seed?: number, name?: string) {
    this.weights = normalizeWeights(weights);
    this.coefficients = weightsToCoefficients(weights);
    this.name = name || 'TunableBot';

    if (seed !== undefined) {
      this.rng = createSeededRandom(seed);
    } else {
      this.rng = Math.random;
    }
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    const w = this.weights;
    return `Tunable 1-ply (L=${w.life.toFixed(2)} B=${w.board.toFixed(2)} C=${w.cards.toFixed(2)} M=${w.mana.toFixed(2)} T=${w.tempo.toFixed(2)})`;
  }

  getWeights(): EvaluationWeights {
    return { ...this.weights };
  }

  getCoefficients(): EvaluationCoefficients {
    return { ...this.coefficients };
  }

  chooseAction(state: GameState, playerId: PlayerId): Action {
    const legalActions = getLegalActions(state, playerId);

    if (legalActions.length === 0) {
      throw new Error(`No legal actions available for ${playerId}`);
    }

    if (legalActions.length === 1) {
      return legalActions[0]!;
    }

    // Limit actions to evaluate for speed
    let actionsToEvaluate = legalActions;
    if (legalActions.length > 50) {
      actionsToEvaluate = this.filterImportantActions(legalActions);
    }

    // Evaluate each action using quickEvaluateWithCoefficients (raw scores)
    const scoredActions: Array<{ action: Action; score: number }> = [];

    for (const action of actionsToEvaluate) {
      try {
        const newState = applyAction(state, action);
        let score = quickEvaluateWithCoefficients(newState, playerId, this.coefficients);

        // Anti-loop: penalize repeated ability activations
        if (action.type === 'ACTIVATE_ABILITY') {
          const sameAbilityCount = this.countRecentSameAbility(action);
          if (sameAbilityCount > 0) {
            score -= Math.pow(10, sameAbilityCount + 1);
          }
        }

        scoredActions.push({ action, score });
      } catch {
        scoredActions.push({ action, score: -Infinity });
      }
    }

    // Filter out NaN scores (can happen with invalid coefficients)
    const validActions = scoredActions.filter((sa) => !Number.isNaN(sa.score));

    // If all scores are NaN, fall back to first legal action
    if (validActions.length === 0) {
      return actionsToEvaluate[0]!;
    }

    // Sort by score descending
    validActions.sort((a, b) => b.score - a.score);

    // Tie-break randomly
    const bestScore = validActions[0]!.score;
    const bestActions = validActions.filter((sa) => sa.score === bestScore);
    const index = Math.floor(this.rng() * bestActions.length);
    const chosenAction = bestActions[index]!.action;

    // Track for repetition detection
    this.recentActions.push(chosenAction);
    if (this.recentActions.length > this.MAX_RECENT_ACTIONS) {
      this.recentActions.shift();
    }

    return chosenAction;
  }

  private countRecentSameAbility(action: Action): number {
    if (action.type !== 'ACTIVATE_ABILITY') return 0;

    const abilityId = action.payload.abilityId;
    let count = 0;

    for (const recent of this.recentActions) {
      if (recent?.type === 'ACTIVATE_ABILITY' && recent.payload.abilityId === abilityId) {
        count++;
      }
    }

    return count;
  }

  private filterImportantActions(actions: Action[]): Action[] {
    const MAX_ACTIONS = 50;
    const filtered: Action[] = [];

    // Always include pass/end
    filtered.push(...actions.filter((a) => a.type === 'PASS_PRIORITY' || a.type === 'END_TURN'));

    // Spells (first 10)
    filtered.push(...actions.filter((a) => a.type === 'CAST_SPELL').slice(0, 10));

    // Abilities (first 10)
    filtered.push(...actions.filter((a) => a.type === 'ACTIVATE_ABILITY').slice(0, 10));

    // Attacks (no attack + all attack + some singles)
    const attacks = actions.filter((a) => a.type === 'DECLARE_ATTACKERS');
    const noAttack = attacks.find(
      (a) => a.type === 'DECLARE_ATTACKERS' && a.payload.attackers.length === 0,
    );
    if (noAttack) filtered.push(noAttack);
    const allAttack = attacks.reduce(
      (max, a) => {
        if (a.type !== 'DECLARE_ATTACKERS' || !max) return a;
        if (max.type !== 'DECLARE_ATTACKERS') return a;
        return a.payload.attackers.length > max.payload.attackers.length ? a : max;
      },
      undefined as Action | undefined,
    );
    if (allAttack && allAttack !== noAttack) filtered.push(allAttack);
    filtered.push(
      ...attacks
        .filter((a) => a.type === 'DECLARE_ATTACKERS' && a.payload.attackers.length === 1)
        .slice(0, 5),
    );

    // Blocks (some options)
    const blocks = actions.filter((a) => a.type === 'DECLARE_BLOCKERS');
    const noBlock = blocks.find(
      (a) => a.type === 'DECLARE_BLOCKERS' && a.payload.blocks.length === 0,
    );
    if (noBlock) filtered.push(noBlock);
    filtered.push(
      ...blocks
        .filter((a) => a.type === 'DECLARE_BLOCKERS' && a.payload.blocks.length > 0)
        .slice(0, 10),
    );

    // Lands
    filtered.push(...actions.filter((a) => a.type === 'PLAY_LAND').slice(0, 5));

    const unique = [...new Set(filtered)];
    return unique.slice(0, MAX_ACTIONS);
  }
}

function createSeededRandom(seed: number): () => number {
  let state = seed;
  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
