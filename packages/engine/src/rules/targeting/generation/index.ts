/**
 * Legal Target Generation
 *
 * Functions to generate all legal targets for a spell/ability.
 * Used by getLegalActions() to generate valid (spell, targets) combinations.
 */

import type { GameState } from '../../../state/GameState';
import type { CardInstance } from '../../../state/CardInstance';
import type { PlayerId } from '../../../state/Zone';
import type { TargetRequirement } from '../types';
import type { CardTemplate } from '../../../cards/CardTemplate';
import { CardLoader } from '../../../cards/CardLoader';
import { isCreature, isArtifact, isEnchantment, isLand } from '../../../cards/CardTemplate';
import { validateSingleTarget } from '../validation';
import { hasHexproof, hasShroud, hasProtectionFromSource } from '../validation/protection';

// Re-export combinations module
export {
  getAllLegalTargetCombinations,
  generateCombinations,
  countLegalTargetCombinations,
  hasLegalTargets,
} from './combinations';

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Get all legal targets for a requirement
 *
 * Collects targets from different zones based on the requirement's target type
 * and zone restrictions. Each potential target is validated before being added.
 *
 * @param state - Current game state
 * @param requirement - The target requirement
 * @param controller - Player who controls the spell/ability
 * @param sourceCard - Optional source card (for protection checks)
 * @returns Array of valid target IDs
 */
export function getLegalTargets(
  state: GameState,
  requirement: TargetRequirement,
  controller: PlayerId,
  sourceCard?: CardInstance,
): string[] {
  const validTargets: string[] = [];

  // === Player Targets ===
  if (
    requirement.targetType === 'any' ||
    requirement.targetType === 'player' ||
    requirement.targetType === 'opponent'
  ) {
    validTargets.push(...getPlayerTargets(requirement, controller));
  }

  // === Stack Targets ===
  if (
    requirement.zone === 'stack' ||
    requirement.targetType === 'spell' ||
    requirement.targetType === 'creature_spell'
  ) {
    validTargets.push(...getStackTargets(state, requirement, sourceCard));
    // If we're specifically targeting on the stack, return early
    if (requirement.zone === 'stack') {
      return validTargets;
    }
  }

  // === Battlefield Targets ===
  if (requirement.zone === 'battlefield' || requirement.zone === 'any') {
    validTargets.push(...getBattlefieldTargets(state, requirement, controller, sourceCard));
  }

  // === Graveyard Targets ===
  if (requirement.zone === 'graveyard') {
    validTargets.push(...getGraveyardTargets(state, requirement, controller, sourceCard));
  }

  return validTargets;
}

// =============================================================================
// PLAYER TARGETS
// =============================================================================

/**
 * Get valid player targets based on requirement
 *
 * @param requirement - The target requirement
 * @param controller - Player who controls the spell/ability
 * @returns Array of valid player target IDs ('player' or 'opponent')
 */
export function getPlayerTargets(requirement: TargetRequirement, controller: PlayerId): string[] {
  const targets: string[] = [];

  if (requirement.targetType === 'opponent') {
    // Only the opponent is a valid target
    targets.push(controller === 'player' ? 'opponent' : 'player');
  } else if (requirement.targetType === 'any' || requirement.targetType === 'player') {
    // Both players are valid targets
    targets.push('player', 'opponent');
  }

  return targets;
}

// =============================================================================
// STACK TARGETS
// =============================================================================

/**
 * Get valid stack targets (spells on the stack)
 *
 * Used for counterspells and similar effects.
 *
 * @param state - Current game state
 * @param requirement - The target requirement
 * @param sourceCard - Optional source card (to exclude self-targeting)
 * @returns Array of valid stack object IDs
 */
export function getStackTargets(
  state: GameState,
  requirement: TargetRequirement,
  sourceCard?: CardInstance,
): string[] {
  const targets: string[] = [];

  for (const stackObj of state.stack) {
    // Skip our own spell that's creating this targeting
    if (sourceCard && stackObj.card.instanceId === sourceCard.instanceId) {
      continue;
    }

    // Check creature spell restriction
    if (requirement.targetType === 'creature_spell') {
      const template = CardLoader.getById(stackObj.card.scryfallId);
      if (!template || !template.type_line.includes('Creature')) {
        continue;
      }
    }

    targets.push(stackObj.id);
  }

  return targets;
}

// =============================================================================
// BATTLEFIELD TARGETS
// =============================================================================

/**
 * Get valid battlefield targets
 *
 * Iterates through all permanents on the battlefield and checks:
 * - Target type matches (creature, artifact, etc.)
 * - Hexproof/Shroud restrictions
 * - Protection from source
 * - Any additional restrictions (color, combat status, etc.)
 *
 * @param state - Current game state
 * @param requirement - The target requirement
 * @param controller - Player who controls the spell/ability
 * @param sourceCard - Optional source card (for protection checks)
 * @returns Array of valid card instance IDs
 */
export function getBattlefieldTargets(
  state: GameState,
  requirement: TargetRequirement,
  controller: PlayerId,
  sourceCard?: CardInstance,
): string[] {
  const targets: string[] = [];

  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];

    for (const card of player.battlefield) {
      // Use the full validation to check all rules
      const errors = validateSingleTarget(
        state,
        card.instanceId,
        requirement,
        controller,
        sourceCard,
      );

      if (errors.length === 0) {
        targets.push(card.instanceId);
      }
    }
  }

  return targets;
}

// =============================================================================
// GRAVEYARD TARGETS
// =============================================================================

/**
 * Get valid graveyard targets
 *
 * Used for recursion effects that target cards in graveyards.
 *
 * @param state - Current game state
 * @param requirement - The target requirement
 * @param controller - Player who controls the spell/ability
 * @param sourceCard - Optional source card
 * @returns Array of valid card instance IDs
 */
export function getGraveyardTargets(
  state: GameState,
  requirement: TargetRequirement,
  controller: PlayerId,
  sourceCard?: CardInstance,
): string[] {
  const targets: string[] = [];

  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];

    for (const card of player.graveyard) {
      const errors = validateSingleTarget(
        state,
        card.instanceId,
        requirement,
        controller,
        sourceCard,
      );

      if (errors.length === 0) {
        targets.push(card.instanceId);
      }
    }
  }

  return targets;
}

// =============================================================================
// QUICK TARGET TYPE CHECKS (for optimization)
// =============================================================================

/**
 * Check if a card matches the required target type (fast path)
 *
 * This is used for quick filtering before full validation.
 * For complete validation, use validateSingleTarget.
 *
 * @param template - Card template
 * @param targetType - Required target type
 * @returns true if the card could potentially be a valid target
 */
export function matchesTargetType(
  template: CardTemplate,
  targetType: TargetRequirement['targetType'],
): boolean {
  switch (targetType) {
    case 'any':
      return true;

    case 'creature':
      return isCreature(template);

    case 'permanent':
      return true; // All cards on battlefield are permanents

    case 'artifact':
      return isArtifact(template);

    case 'enchantment':
      return isEnchantment(template);

    case 'land':
      return isLand(template);

    case 'artifact_or_enchantment':
      return isArtifact(template) || isEnchantment(template);

    case 'player':
    case 'opponent':
      return false; // Not a card

    case 'spell':
    case 'creature_spell':
      return false; // Stack only

    default:
      return false;
  }
}

/**
 * Check if a permanent can be targeted (ignoring restrictions)
 *
 * Quick check for hexproof, shroud, and protection.
 * Does NOT check restrictions like color or combat status.
 *
 * @param template - Target card template
 * @param sourceTemplate - Source card template (for protection)
 * @param targetController - Controller of the target
 * @param spellController - Controller of the spell/ability
 * @returns true if the permanent can be targeted
 */
export function canBeTargeted(
  template: CardTemplate,
  sourceTemplate: CardTemplate | null,
  targetController: PlayerId,
  spellController: PlayerId,
): boolean {
  // Shroud - can't be targeted by anyone
  if (hasShroud(template)) {
    return false;
  }

  // Hexproof - can't be targeted by opponents
  if (hasHexproof(template) && targetController !== spellController) {
    return false;
  }

  // Protection from source
  if (sourceTemplate && hasProtectionFromSource(template, sourceTemplate)) {
    return false;
  }

  return true;
}
