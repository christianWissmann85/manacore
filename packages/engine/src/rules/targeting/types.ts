/**
 * Targeting System Types
 *
 * Pure type definitions for the targeting system.
 * No logic, just interfaces and type aliases.
 */

import type { Zone } from '../../state/Zone';

// =============================================================================
// TARGET TYPES
// =============================================================================

/**
 * What type of thing can be targeted
 */
export type TargetType =
  | 'any' // "any target" - creature or player
  | 'creature' // "target creature"
  | 'player' // "target player"
  | 'opponent' // "target opponent"
  | 'spell' // "target spell" (on stack)
  | 'creature_spell' // "target creature spell" (on stack)
  | 'permanent' // "target permanent"
  | 'artifact' // "target artifact"
  | 'enchantment' // "target enchantment"
  | 'land' // "target land"
  | 'artifact_or_enchantment'; // "target artifact or enchantment"

/**
 * MTG color symbols
 */
export type MtgColor = 'W' | 'U' | 'B' | 'R' | 'G';

// =============================================================================
// TARGET RESTRICTIONS
// =============================================================================

/**
 * Restrictions that narrow valid targets
 *
 * Each restriction type has its own shape for type safety.
 */
export type TargetRestriction =
  | { type: 'color'; color: MtgColor; negated: boolean } // "nonblack", "black"
  | { type: 'controller'; controller: 'you' | 'opponent' } // "you control", "opponent controls"
  | { type: 'combat'; status: 'attacking' | 'blocking' | 'attacking_or_blocking' }
  | { type: 'tapped' }
  | { type: 'untapped' }
  | { type: 'nonartifact' }
  | { type: 'nonland' }
  | { type: 'keyword'; keyword: string } // "flying", "trample", etc.
  | { type: 'subtype'; subtype: string }; // "Wall", "Goblin", etc.

// =============================================================================
// TARGET REQUIREMENT
// =============================================================================

/**
 * A single targeting requirement for a spell or ability
 *
 * Parsed from oracle text like "target creature" or "target nonblack creature"
 */
export interface TargetRequirement {
  /** Unique ID for matching with effects */
  id: string;
  /** How many targets needed (usually 1) */
  count: number;
  /** What can be targeted */
  targetType: TargetType;
  /** Where targets must be */
  zone: Zone | 'any';
  /** Additional constraints */
  restrictions: TargetRestriction[];
  /** "up to X" vs required */
  optional: boolean;
  /** Human-readable description */
  description: string;
}

// =============================================================================
// RESOLVED TARGET
// =============================================================================

/**
 * A resolved target with metadata
 *
 * Used when tracking what was actually targeted by a spell/ability
 */
export interface ResolvedTarget {
  /** instanceId or playerId */
  id: string;
  /** What kind of target this is */
  type: 'card' | 'player' | 'stack_object';
}

// =============================================================================
// COLOR NAME MAPPING
// =============================================================================

/**
 * Mapping from color codes to full color names
 */
export const COLOR_NAMES: Record<MtgColor, string> = {
  W: 'white',
  U: 'blue',
  B: 'black',
  R: 'red',
  G: 'green',
};
