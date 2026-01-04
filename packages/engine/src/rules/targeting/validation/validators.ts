/**
 * Restriction Validators
 *
 * Individual validator functions for each target restriction type.
 * Each validator checks a specific constraint on a target.
 *
 * Validators return null if valid, or an error string if invalid.
 */

import type { GameState } from '../../../state/GameState';
import type { CardInstance } from '../../../state/CardInstance';
import type { CardTemplate } from '../../../cards/CardTemplate';
import type { PlayerId } from '../../../state/Zone';
import type { TargetRestriction, MtgColor } from '../types';
import { COLOR_NAMES } from '../types';
import { isArtifact, isLand, hasKeyword } from '../../../cards/CardTemplate';

// =============================================================================
// VALIDATOR TYPE
// =============================================================================

/**
 * Validator function signature
 *
 * @param state - Current game state
 * @param card - The target card instance
 * @param template - The target card's template
 * @param restriction - The restriction to validate
 * @param controller - The player who controls the source spell/ability
 * @returns null if valid, error string if invalid
 */
export type RestrictionValidator = (
  state: GameState,
  card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  controller: PlayerId,
) => string | null;

// =============================================================================
// INDIVIDUAL VALIDATORS
// =============================================================================

/**
 * Validate color restriction
 *
 * Handles both positive ("target black creature") and
 * negative ("target nonblack creature") restrictions.
 */
export function validateColorRestriction(
  _state: GameState,
  _card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  _controller: PlayerId,
): string | null {
  if (restriction.type !== 'color') return null;

  const hasColor = template.colors.includes(restriction.color);

  if (restriction.negated) {
    // "nonblack" - must NOT have the color
    if (hasColor) {
      return `Target cannot be ${COLOR_NAMES[restriction.color]}`;
    }
  } else {
    // "black" - must HAVE the color
    if (!hasColor) {
      return `Target must be ${COLOR_NAMES[restriction.color]}`;
    }
  }

  return null;
}

/**
 * Validate controller restriction
 *
 * Handles "you control" and "opponent controls" restrictions.
 */
export function validateControllerRestriction(
  _state: GameState,
  card: CardInstance,
  _template: CardTemplate,
  restriction: TargetRestriction,
  controller: PlayerId,
): string | null {
  if (restriction.type !== 'controller') return null;

  if (restriction.controller === 'you') {
    if (card.controller !== controller) {
      return 'Target must be controlled by you';
    }
  } else {
    if (card.controller === controller) {
      return 'Target must be controlled by an opponent';
    }
  }

  return null;
}

/**
 * Validate combat restriction
 *
 * Handles "attacking", "blocking", and "attacking or blocking" restrictions.
 */
export function validateCombatRestriction(
  _state: GameState,
  card: CardInstance,
  _template: CardTemplate,
  restriction: TargetRestriction,
  _controller: PlayerId,
): string | null {
  if (restriction.type !== 'combat') return null;

  if (restriction.status === 'attacking') {
    if (!card.attacking) {
      return 'Target must be attacking';
    }
  } else if (restriction.status === 'blocking') {
    if (!card.blocking) {
      return 'Target must be blocking';
    }
  } else if (restriction.status === 'attacking_or_blocking') {
    if (!card.attacking && !card.blocking) {
      return 'Target must be attacking or blocking';
    }
  }

  return null;
}

/**
 * Validate tapped restriction
 *
 * Target must be tapped.
 */
export function validateTappedRestriction(
  _state: GameState,
  card: CardInstance,
  _template: CardTemplate,
  restriction: TargetRestriction,
  _controller: PlayerId,
): string | null {
  if (restriction.type !== 'tapped') return null;

  if (!card.tapped) {
    return 'Target must be tapped';
  }

  return null;
}

/**
 * Validate untapped restriction
 *
 * Target must be untapped.
 */
export function validateUntappedRestriction(
  _state: GameState,
  card: CardInstance,
  _template: CardTemplate,
  restriction: TargetRestriction,
  _controller: PlayerId,
): string | null {
  if (restriction.type !== 'untapped') return null;

  if (card.tapped) {
    return 'Target must be untapped';
  }

  return null;
}

/**
 * Validate nonartifact restriction
 *
 * Target cannot be an artifact.
 */
export function validateNonartifactRestriction(
  _state: GameState,
  _card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  _controller: PlayerId,
): string | null {
  if (restriction.type !== 'nonartifact') return null;

  if (isArtifact(template)) {
    return 'Target cannot be an artifact';
  }

  return null;
}

/**
 * Validate nonland restriction
 *
 * Target cannot be a land.
 */
export function validateNonlandRestriction(
  _state: GameState,
  _card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  _controller: PlayerId,
): string | null {
  if (restriction.type !== 'nonland') return null;

  if (isLand(template)) {
    return 'Target cannot be a land';
  }

  return null;
}

/**
 * Validate keyword restriction
 *
 * Target must have a specific keyword ability.
 */
export function validateKeywordRestriction(
  _state: GameState,
  _card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  _controller: PlayerId,
): string | null {
  if (restriction.type !== 'keyword') return null;

  if (!hasKeyword(template, restriction.keyword)) {
    return `Target must have ${restriction.keyword}`;
  }

  return null;
}

/**
 * Validate subtype restriction
 *
 * Target must have a specific subtype (e.g., "Goblin", "Wall").
 */
export function validateSubtypeRestriction(
  _state: GameState,
  _card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  _controller: PlayerId,
): string | null {
  if (restriction.type !== 'subtype') return null;

  // Subtypes are in the type_line after the em dash
  const typeLine = template.type_line.toLowerCase();
  const subtype = restriction.subtype.toLowerCase();

  if (!typeLine.includes(subtype)) {
    return `Target must be a ${restriction.subtype}`;
  }

  return null;
}

// =============================================================================
// VALIDATOR REGISTRY
// =============================================================================

/**
 * Registry of all restriction validators
 *
 * Maps restriction type to validator function.
 * Use this to look up validators dynamically.
 */
export const RESTRICTION_VALIDATORS: Record<string, RestrictionValidator> = {
  color: validateColorRestriction,
  controller: validateControllerRestriction,
  combat: validateCombatRestriction,
  tapped: validateTappedRestriction,
  untapped: validateUntappedRestriction,
  nonartifact: validateNonartifactRestriction,
  nonland: validateNonlandRestriction,
  keyword: validateKeywordRestriction,
  subtype: validateSubtypeRestriction,
};

/**
 * Validate a restriction using the registry
 *
 * Looks up the appropriate validator and executes it.
 *
 * @param state - Current game state
 * @param card - The target card instance
 * @param template - The target card's template
 * @param restriction - The restriction to validate
 * @param controller - The player who controls the source
 * @returns null if valid, error string if invalid
 */
export function validateRestriction(
  state: GameState,
  card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  controller: PlayerId,
): string | null {
  const validator = RESTRICTION_VALIDATORS[restriction.type];
  if (!validator) {
    // Unknown restriction type - allow by default
    return null;
  }
  return validator(state, card, template, restriction, controller);
}
