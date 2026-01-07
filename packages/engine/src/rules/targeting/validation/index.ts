/**
 * Target Validation
 *
 * Main validation entry points for checking target legality.
 * Handles player targets, stack targets (spells), and card targets.
 */

import type { GameState } from '../../../state/GameState';
import type { CardInstance } from '../../../state/CardInstance';
import type { PlayerId } from '../../../state/Zone';
import type { TargetRequirement, TargetType, MtgColor } from '../types';
import { COLOR_NAMES } from '../types';
import { findCard } from '../../../state/GameState';
import { CardLoader } from '../../../cards/CardLoader';
import type { CardTemplate } from '../../../cards/CardTemplate';
import { isCreature, isArtifact, isEnchantment, isLand } from '../../../cards/CardTemplate';
import {
  hasHexproof,
  hasShroud,
  hasProtectionFrom,
  hasProtectionFromAllColors,
  getSourceColors,
} from './protection';
import { validateRestriction } from './validators';
import { getRequiredTargetCount, getMaxTargetCount } from '../parser';

// =============================================================================
// MAIN VALIDATION ENTRY POINTS
// =============================================================================

/**
 * Validate that targets are legal for a spell/ability
 *
 * @param state - Current game state
 * @param targets - Array of target IDs (instanceId, 'player', 'opponent', or stack object ID)
 * @param requirements - Target requirements from the spell/ability
 * @param controller - Player who controls the spell/ability
 * @param sourceCard - Optional source card (for protection checks)
 * @returns Array of error messages (empty if all targets are valid)
 */
export function validateTargets(
  state: GameState,
  targets: string[],
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance,
): string[] {
  const errors: string[] = [];

  // Check target count
  const requiredCount = getRequiredTargetCount(requirements);
  const maxCount = getMaxTargetCount(requirements);

  if (targets.length < requiredCount) {
    errors.push(`Need at least ${requiredCount} target(s), got ${targets.length}`);
    return errors;
  }

  if (targets.length > maxCount) {
    errors.push(`Maximum ${maxCount} target(s) allowed, got ${targets.length}`);
    return errors;
  }

  // Validate each target against requirements
  let targetIndex = 0;
  for (const req of requirements) {
    for (let i = 0; i < req.count && targetIndex < targets.length; i++) {
      const targetId = targets[targetIndex]!;
      const targetErrors = validateSingleTarget(state, targetId, req, controller, sourceCard);
      errors.push(...targetErrors);
      targetIndex++;
    }
  }

  // Check for duplicate targets (most spells can't target same thing twice)
  const uniqueTargets = new Set(targets);
  if (uniqueTargets.size !== targets.length) {
    errors.push('Cannot target the same thing multiple times');
  }

  return errors;
}

/**
 * Validate a single target against a requirement
 *
 * Dispatches to the appropriate validator based on target type:
 * - Player targets ('player', 'opponent')
 * - Stack targets (spells on the stack)
 * - Card targets (permanents on battlefield, cards in graveyard, etc.)
 *
 * @param state - Current game state
 * @param targetId - The target ID
 * @param requirement - The target requirement
 * @param controller - Player who controls the spell/ability
 * @param sourceCard - Optional source card (for protection checks)
 * @returns Array of error messages (empty if valid)
 */
export function validateSingleTarget(
  state: GameState,
  targetId: string,
  requirement: TargetRequirement,
  controller: PlayerId,
  sourceCard?: CardInstance,
): string[] {
  // === Player Targets ===
  if (targetId === 'player' || targetId === 'opponent') {
    return validatePlayerTarget(targetId, requirement, controller);
  }

  // === Stack Targets (for counterspells) ===
  if (requirement.zone === 'stack') {
    return validateStackTarget(state, targetId, requirement);
  }

  // === Card Targets (battlefield, graveyard, etc.) ===
  return validateCardTarget(state, targetId, requirement, controller, sourceCard);
}

// =============================================================================
// PLAYER TARGET VALIDATION
// =============================================================================

/**
 * Validate a player target
 *
 * @param targetId - 'player' or 'opponent'
 * @param requirement - The target requirement
 * @param controller - Player who controls the spell/ability
 * @returns Array of error messages (empty if valid)
 */
function validatePlayerTarget(
  targetId: string,
  requirement: TargetRequirement,
  controller: PlayerId,
): string[] {
  // Check if requirement allows player targets
  if (requirement.targetType === 'any' || requirement.targetType === 'player') {
    // Valid player target
    return [];
  }

  if (requirement.targetType === 'opponent') {
    // Must target opponent
    if (targetId === controller) {
      return ['Must target opponent, not yourself'];
    }
    return [];
  }

  return [`Cannot target a player with "${requirement.description}"`];
}

// =============================================================================
// STACK TARGET VALIDATION
// =============================================================================

/**
 * Validate a stack target (spell on the stack)
 *
 * @param state - Current game state
 * @param targetId - Stack object ID
 * @param requirement - The target requirement
 * @returns Array of error messages (empty if valid)
 */
function validateStackTarget(
  state: GameState,
  targetId: string,
  requirement: TargetRequirement,
): string[] {
  const stackObj = state.stack.find((s) => s.id === targetId);
  if (!stackObj) {
    return [`Target ${targetId} not found on stack`];
  }

  // Check spell type restrictions
  if (requirement.targetType === 'creature_spell') {
    const template = CardLoader.getById(stackObj.card.scryfallId);
    if (!template || !template.type_line.includes('Creature')) {
      return ['Target must be a creature spell'];
    }
  }

  return [];
}

// =============================================================================
// CARD TARGET VALIDATION
// =============================================================================

/**
 * Validate a card target (permanent or card in zone)
 *
 * Performs the following checks:
 * 1. Card exists
 * 2. Card is in the correct zone
 * 3. Hexproof check (can't target opponent's hexproof permanents)
 * 4. Shroud check (can't target shrouded permanents)
 * 5. Protection check (can't target protected permanents)
 * 6. Target type matches (creature, artifact, etc.)
 * 7. All restrictions pass (color, combat status, etc.)
 *
 * @param state - Current game state
 * @param targetId - Card instance ID
 * @param requirement - The target requirement
 * @param controller - Player who controls the spell/ability
 * @param sourceCard - Optional source card (for protection checks)
 * @returns Array of error messages (empty if valid)
 */
function validateCardTarget(
  state: GameState,
  targetId: string,
  requirement: TargetRequirement,
  controller: PlayerId,
  sourceCard?: CardInstance,
): string[] {
  // Find the target card
  const target = findCard(state, targetId);
  if (!target) {
    return [`Target ${targetId} not found`];
  }

  const template = CardLoader.getById(target.scryfallId);
  if (!template) {
    return [`Could not find card data for target`];
  }

  // Check zone
  if (requirement.zone !== 'any' && target.zone !== requirement.zone) {
    return [`Target must be in ${requirement.zone}, but is in ${target.zone}`];
  }

  // Check Hexproof (can't be targeted by opponents)
  if (hasHexproof(template) && target.controller !== controller) {
    return ['Target has hexproof'];
  }

  // Check Shroud (can't be targeted by anyone)
  if (hasShroud(template)) {
    return ['Target has shroud'];
  }

  // Check Protection (if we have source card info)
  const protectionError = validateProtection(target, template, sourceCard);
  if (protectionError) {
    return [protectionError];
  }

  // Check target type matches
  const typeError = validateTargetType(template, target, requirement.targetType);
  if (typeError) {
    return [typeError];
  }

  // Check all restrictions
  for (const restriction of requirement.restrictions) {
    const restrictionError = validateRestriction(state, target, template, restriction, controller);
    if (restrictionError) {
      return [restrictionError];
    }
  }

  return [];
}

// =============================================================================
// PROTECTION VALIDATION
// =============================================================================

/**
 * Validate that target doesn't have protection from the source
 *
 * @param target - Target card instance
 * @param template - Target card template
 * @param sourceCard - Source card (optional)
 * @returns Error message if protected, null if valid
 */
function validateProtection(
  _target: CardInstance,
  template: CardTemplate,
  sourceCard?: CardInstance,
): string | null {
  if (!sourceCard) {
    return null;
  }

  const sourceTemplate = CardLoader.getById(sourceCard.scryfallId);
  if (!sourceTemplate) {
    return null;
  }

  const sourceColors = getSourceColors(sourceTemplate);

  // Check protection from all colors
  if (hasProtectionFromAllColors(template) && sourceColors.length > 0) {
    return 'Target has protection from all colors';
  }

  // Check protection from specific colors
  for (const color of sourceColors) {
    if (hasProtectionFrom(template, color)) {
      return `Target has protection from ${COLOR_NAMES[color]}`;
    }
  }

  return null;
}

// =============================================================================
// TARGET TYPE VALIDATION
// =============================================================================

/**
 * Validate that a card matches the required target type
 *
 * @param template - Card template
 * @param card - Card instance
 * @param targetType - Required target type
 * @returns Error message if invalid, null if valid
 */
function validateTargetType(
  template: CardTemplate,
  card: CardInstance,
  targetType: TargetType,
): string | null {
  switch (targetType) {
    case 'any':
      // "Any target" in MTG means creature, player, or planeswalker
      // Players are handled separately, so here we only validate creatures
      // (Planeswalkers would be added here if implemented)
      if (!isCreature(template)) {
        return 'Target must be a creature or player';
      }
      return null;

    case 'creature':
      if (!isCreature(template)) {
        return 'Target must be a creature';
      }
      return null;

    case 'permanent':
      // Any card on battlefield is a permanent
      if (card.zone !== 'battlefield') {
        return 'Target must be a permanent';
      }
      return null;

    case 'artifact':
      if (!isArtifact(template)) {
        return 'Target must be an artifact';
      }
      return null;

    case 'enchantment':
      if (!isEnchantment(template)) {
        return 'Target must be an enchantment';
      }
      return null;

    case 'land':
      if (!isLand(template)) {
        return 'Target must be a land';
      }
      return null;

    case 'artifact_or_enchantment':
      if (!isArtifact(template) && !isEnchantment(template)) {
        return 'Target must be an artifact or enchantment';
      }
      return null;

    case 'player':
    case 'opponent':
      // These are handled at the player check level
      return 'Target must be a player';

    case 'spell':
    case 'creature_spell':
      // These are handled at the stack check level
      return 'Target must be a spell on the stack';

    default:
      return null;
  }
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Re-export protection helpers for convenience
export {
  hasHexproof,
  hasShroud,
  hasProtectionFrom,
  hasProtectionFromAllColors,
  getSourceColors,
  hasProtectionFromSource,
} from './protection';

// Re-export validators
export {
  validateRestriction,
  validateColorRestriction,
  validateControllerRestriction,
  validateCombatRestriction,
  validateTappedRestriction,
  validateUntappedRestriction,
  validateNonartifactRestriction,
  validateNonlandRestriction,
  validateKeywordRestriction,
  validateSubtypeRestriction,
  RESTRICTION_VALIDATORS,
} from './validators';

export type { RestrictionValidator } from './validators';
