/**
 * State for a single player
 */

import type { CardInstance } from './CardInstance';
import type { PlayerId } from './Zone';

/**
 * Mana pool (tapped/untapped lands)
 */
export interface ManaPool {
  white: number;
  blue: number;
  black: number;
  red: number;
  green: number;
  colorless: number;
}

export function createEmptyManaPool(): ManaPool {
  return {
    white: 0,
    blue: 0,
    black: 0,
    red: 0,
    green: 0,
    colorless: 0,
  };
}

/**
 * Complete state for one player
 */
export interface PlayerState {
  id: PlayerId;
  life: number;
  manaPool: ManaPool;

  // Zones
  library: CardInstance[];
  hand: CardInstance[];
  battlefield: CardInstance[];
  graveyard: CardInstance[];
  exile: CardInstance[];

  // Game rules tracking
  landsPlayedThisTurn: number;
  hasPassedPriority: boolean;       // Passed priority on current stack state
  consecutivePasses: number;        // Track consecutive priority passes
}

/**
 * Create initial player state
 */
export function createPlayerState(
  id: PlayerId,
  library: CardInstance[],
  startingLife: number = 20,
): PlayerState {
  return {
    id,
    life: startingLife,
    manaPool: createEmptyManaPool(),
    library,
    hand: [],
    battlefield: [],
    graveyard: [],
    exile: [],
    landsPlayedThisTurn: 0,
    hasPassedPriority: false,
    consecutivePasses: 0,
  };
}
