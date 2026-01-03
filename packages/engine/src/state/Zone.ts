/**
 * Game zones where cards can exist
 */

export type Zone =
  | 'library'      // Deck
  | 'hand'         // Hand
  | 'battlefield'  // In play
  | 'graveyard'    // Discard pile
  | 'stack'        // Spells/abilities waiting to resolve
  | 'exile';       // Removed from game

export type PlayerId = 'player' | 'opponent';

/**
 * Phases of a turn
 */
export type GamePhase =
  | 'beginning'
  | 'main1'
  | 'combat'
  | 'main2'
  | 'ending';

/**
 * Steps within phases
 */
export type GameStep =
  | 'untap'
  | 'upkeep'
  | 'draw'
  | 'main'
  | 'begin_combat'
  | 'declare_attackers'
  | 'declare_blockers'
  | 'combat_damage'
  | 'end_combat'
  | 'end'
  | 'cleanup';

/**
 * Counter types (for Phase 1+)
 */
export type CounterType =
  | '+1/+1'
  | '-1/-1'
  | 'loyalty'
  | 'charge';
