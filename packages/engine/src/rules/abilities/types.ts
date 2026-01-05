/**
 * Type definitions for the activated abilities system
 *
 * These types define the structure of activated abilities, their costs,
 * effects, and targeting requirements.
 */

import type { GameState } from '../../state/GameState';
import type { CardInstance } from '../../state/CardInstance';
import type { PlayerId } from '../../state/Zone';
import type { TargetRequirement } from '../targeting';

// =============================================================================
// MANA COLORS
// =============================================================================

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

// =============================================================================
// ABILITY COSTS
// =============================================================================

/**
 * Cost to sacrifice a permanent
 */
export interface SacrificeCost {
  /** Type of permanent to sacrifice */
  type: 'self' | 'creature' | 'permanent' | 'artifact' | 'land';
  /** Number of permanents to sacrifice (default: 1) */
  count?: number;
  /** Specific land type required (e.g., 'Swamp' for Blighted Shaman) */
  landType?: 'Plains' | 'Island' | 'Swamp' | 'Mountain' | 'Forest';
  /** Specific creature subtype required */
  creatureSubtype?: string;
  /** Additional restrictions */
  restriction?: {
    /** Can't sacrifice the source itself */
    notSelf?: boolean;
  };
}

/**
 * Cost to activate an ability
 */
export interface AbilityCost {
  /** Requires tapping the source */
  tap?: boolean;
  /** Mana cost string (e.g., '{R}', '{2}{G}') */
  mana?: string;
  /** Life payment */
  life?: number;
  /** Sacrifice requirement */
  sacrifice?: SacrificeCost;
}

// =============================================================================
// ABILITY EFFECTS
// =============================================================================

/**
 * Effect produced by an ability
 */
export interface AbilityEffect {
  /** Type of effect */
  type:
    | 'ADD_MANA'
    | 'DAMAGE'
    | 'REGENERATE'
    | 'PUMP'
    | 'DESTROY'
    | 'PREVENT_DAMAGE'
    | 'CUSTOM'
    | 'DEAL_DAMAGE'
    | 'DRAW_CARDS'
    | 'DRAW_DISCARD'
    | 'GAIN_LIFE'
    | 'MILL'
    | 'DISCARD'
    | 'CREATE_TOKEN'
    | 'GRANT_KEYWORD';

  /** Amount for numeric effects (damage, mana, etc.) */
  amount?: number | 'next';

  /** Mana colors produced (for ADD_MANA) */
  manaColors?: ManaColor[];

  /** Power change (for PUMP) */
  powerChange?: number;

  /** Toughness change (for PUMP) */
  toughnessChange?: number;

  /** Custom effect function (for CUSTOM type) */
  custom?: (state: GameState) => void;

  /** Whether the effect requires a target (for DEAL_DAMAGE, etc.) */
  requiresTarget?: boolean;

  /** Number of cards (for DRAW_CARDS, MILL, DISCARD, etc.) */
  count?: number;

  /** Number of cards to draw (for DRAW_DISCARD) */
  draw?: number;

  /** Number of cards to discard (for DRAW_DISCARD) */
  discard?: number;

  /** Token type to create (for CREATE_TOKEN) */
  tokenType?: string;

  /** Whether to count X value for token creation */
  countFromX?: boolean;

  /** Keyword to grant (for GRANT_KEYWORD) */
  keyword?: string;

  /** Duration for keyword grant */
  duration?: 'end_of_turn' | 'end_of_combat';

  /** Target type (for PREVENT_DAMAGE, etc.) */
  target?: string;
}

// =============================================================================
// ACTIVATED ABILITY
// =============================================================================

/**
 * An activated ability that can be used by a card
 */
export interface ActivatedAbility {
  /** Unique identifier for this ability instance */
  id: string;

  /** Display name for the ability */
  name: string;

  /** Cost to activate */
  cost: AbilityCost;

  /** Effect when resolved */
  effect: AbilityEffect;

  /** Whether this is a mana ability (doesn't use the stack) */
  isManaAbility: boolean;

  /** Targeting requirements (if any) */
  targetRequirements?: TargetRequirement[];

  /**
   * Check if this ability can currently be activated
   * @param state Current game state
   * @param sourceId Instance ID of the source permanent
   * @param controller Player attempting to activate
   */
  canActivate: (state: GameState, sourceId: string, controller: PlayerId) => boolean;

  /**
   * Custom resolve function (optional, used for complex effects)
   * @param state Current game state
   * @param sourceId Instance ID of the source permanent
   * @param controller Player who activated the ability
   * @param targets Optional array of target instance IDs
   * @param xValue Optional X value for X-cost abilities
   */
  resolve?: (
    state: GameState,
    sourceId: string,
    controller: PlayerId,
    targets?: string[],
    xValue?: number,
  ) => void;
}

// =============================================================================
// FACTORY TYPES
// =============================================================================

/**
 * Factory function that creates abilities for a card
 */
export type AbilityFactory = (card: CardInstance, state: GameState) => ActivatedAbility[];
