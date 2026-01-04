/**
 * Activated Abilities System - Main Entry Point
 *
 * This module provides the primary API for getting activated abilities.
 * It uses a registry pattern with O(1) lookup, falling back to the
 * legacy switch-based implementation for cards not yet migrated.
 *
 * Resolution order:
 * 1. Check registry for card-specific abilities (new system)
 * 2. Fall back to legacy activatedAbilities.ts (old system)
 *
 * @example
 * ```typescript
 * import { getActivatedAbilities } from './rules/abilities';
 *
 * const abilities = getActivatedAbilities(card, state);
 * for (const ability of abilities) {
 *   if (ability.canActivate(state, card.instanceId, playerId)) {
 *     // Ability can be activated
 *   }
 * }
 * ```
 */

import type { CardInstance } from '../../state/CardInstance';
import type { GameState } from '../../state/GameState';
import { CardLoader } from '../../cards/CardLoader';
import { getFromRegistry } from './registry';

// Import the legacy function as fallback for non-migrated cards
// This is the renamed function that handles special lands
import { getLegacyAbilities } from '../activatedAbilities';

// Re-export types
export type {
  ActivatedAbility,
  AbilityCost,
  AbilityEffect,
  SacrificeCost,
  ManaColor,
  AbilityFactory,
} from './types';

// Re-export registry functions for card registration
export {
  registerAbilities,
  registerBulk,
  hasRegisteredAbilities,
  getRegisteredCards,
  getRegistrySize,
} from './registry';

// Re-export common utilities for templates
export {
  standardTapCheck,
  sourceExistsCheck,
  untappedCheck,
  countAvailableMana,
  canPaySimpleMana,
  hasSacrificeable,
  hasLandTypeToSacrifice,
} from './templates/common';

/**
 * Get all activated abilities for a card
 *
 * This is the main API for retrieving abilities. It first checks
 * the registry for migrated cards, then falls back to the legacy
 * implementation.
 *
 * @param card The card instance to get abilities for
 * @param state Current game state
 * @returns Array of activated abilities
 */
export function getActivatedAbilities(
  card: CardInstance,
  state: GameState,
): import('./types').ActivatedAbility[] {
  const template = CardLoader.getById(card.scryfallId);
  if (!template) return [];

  // 1. Check registry first (O(1) lookup for migrated cards)
  const registeredAbilities = getFromRegistry(template.name, card, state);
  if (registeredAbilities !== null) {
    return registeredAbilities;
  }

  // 2. Fall back to legacy implementation
  // The legacy function returns the same shape, so we can use it directly
  // Note: As cards are migrated, they'll be found in the registry above
  return getLegacyAbilities(card, state) as import('./types').ActivatedAbility[];
}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Import set registrations - these files call registerAbilities() during import
import './sets';
