/**
 * RandomBot - picks a random legal action
 *
 * This is the simplest possible AI. It's used for:
 * 1. Testing the engine (find bugs through randomness)
 * 2. Baseline for comparing smarter AIs
 * 3. Quick automated testing
 */

import type { Bot } from './Bot';
import type { GameState, Action, PlayerId } from '@manacore/engine';
import { getLegalActions } from '@manacore/engine';

export class RandomBot implements Bot {
  private rng: () => number;

  /**
   * Create a new RandomBot
   * @param seed - Optional RNG seed for deterministic behavior
   */
  constructor(seed?: number) {
    if (seed !== undefined) {
      this.rng = createSeededRandom(seed);
    } else {
      this.rng = Math.random;
    }
  }

  getName(): string {
    return 'RandomBot';
  }

  getDescription(): string {
    return 'Picks random legal actions';
  }

  /**
   * Choose a random legal action
   */
  chooseAction(state: GameState, playerId: PlayerId): Action {
    const legalActions = getLegalActions(state, playerId);

    if (legalActions.length === 0) {
      // Provide detailed debug info to help diagnose the issue
      throw new Error(
        `No legal actions available for ${playerId}. ` +
          `State: phase=${state.phase}, step=${state.step}, ` +
          `activePlayer=${state.activePlayer}, priorityPlayer=${state.priorityPlayer}, ` +
          `turn=${state.turnCount}`,
      );
    }

    // Pick a random action
    const index = Math.floor(this.rng() * legalActions.length);
    return legalActions[index]!;
  }
}

/**
 * Create a seeded random number generator
 * Simple LCG (Linear Congruential Generator)
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;

  return function () {
    // LCG parameters (from Numerical Recipes)
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
