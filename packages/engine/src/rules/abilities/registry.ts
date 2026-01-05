/**
 * Ability Registry - Central registry for card abilities
 *
 * This module provides O(1) lookup for card abilities using a Map.
 * Cards register their abilities during module initialization,
 * and getActivatedAbilities() retrieves them at runtime.
 */

import type { CardInstance } from '../../state/CardInstance';
import type { GameState } from '../../state/GameState';
import type { ActivatedAbility, AbilityFactory } from './types';

// =============================================================================
// REGISTRY
// =============================================================================

/**
 * Central registry mapping card names to their ability factories
 */
const abilityRegistry = new Map<string, AbilityFactory>();

/**
 * Register abilities for a card
 *
 * @param cardName The card's name (must match CardTemplate.name exactly)
 * @param factory Function that creates abilities for the card
 *
 * @example
 * ```typescript
 * registerAbilities('Llanowar Elves', (card) => [
 *   createTapForMana(card, ['G'])
 * ]);
 * ```
 */
export function registerAbilities(cardName: string, factory: AbilityFactory): void {
  if (abilityRegistry.has(cardName)) {
    // In development, warn about duplicate registrations
    // This helps catch copy-paste errors
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[AbilityRegistry] Overwriting abilities for: ${cardName}`);
    }
  }
  abilityRegistry.set(cardName, factory);
}

/**
 * Register multiple cards with the same ability pattern
 *
 * Useful for cards that share identical ability templates.
 *
 * @param cardNames Array of card names
 * @param factory Function that creates abilities
 *
 * @example
 * ```typescript
 * // All basic mana elves share the same ability
 * registerBulk(
 *   ['Llanowar Elves', 'Fyndhorn Elves', 'Elvish Mystic'],
 *   (card) => [createTapForMana(card, ['G'])]
 * );
 * ```
 */
export function registerBulk(cardNames: string[], factory: AbilityFactory): void {
  for (const name of cardNames) {
    registerAbilities(name, factory);
  }
}

/**
 * Get abilities for a card from the registry
 *
 * @param cardName The card's name
 * @param card The card instance
 * @param state Current game state
 * @returns Array of abilities, or null if card not registered
 */
export function getFromRegistry(
  cardName: string,
  card: CardInstance,
  state: GameState,
): ActivatedAbility[] | null {
  const factory = abilityRegistry.get(cardName);
  if (factory) {
    return factory(card, state);
  }
  return null;
}

/**
 * Check if a card has registered abilities
 */
export function hasRegisteredAbilities(cardName: string): boolean {
  return abilityRegistry.has(cardName);
}

/**
 * Get all registered card names
 *
 * Useful for debugging and statistics.
 */
export function getRegisteredCards(): string[] {
  return Array.from(abilityRegistry.keys());
}

/**
 * Get the count of registered cards
 */
export function getRegistrySize(): number {
  return abilityRegistry.size;
}

/**
 * Clear the registry (for testing purposes only)
 */
export function clearRegistry(): void {
  abilityRegistry.clear();
  graveyardAbilityRegistry.clear();
}

// =============================================================================
// GRAVEYARD ABILITY REGISTRY
// =============================================================================

/**
 * Registry for abilities that can be activated from the graveyard
 * (e.g., Necrosavant's return ability)
 */
const graveyardAbilityRegistry = new Map<string, AbilityFactory>();

/**
 * Register a graveyard ability for a card
 *
 * @param cardName The card's name
 * @param factory Function that creates abilities for the card
 */
export function registerGraveyardAbility(cardName: string, factory: AbilityFactory): void {
  if (graveyardAbilityRegistry.has(cardName)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[GraveyardRegistry] Overwriting abilities for: ${cardName}`);
    }
  }
  graveyardAbilityRegistry.set(cardName, factory);
}

/**
 * Get graveyard abilities for a card
 */
export function getGraveyardAbilitiesFromRegistry(
  cardName: string,
  card: CardInstance,
  state: GameState,
): ActivatedAbility[] | null {
  const factory = graveyardAbilityRegistry.get(cardName);
  if (factory) {
    return factory(card, state);
  }
  return null;
}

/**
 * Check if a card has registered graveyard abilities
 */
export function hasGraveyardAbilities(cardName: string): boolean {
  return graveyardAbilityRegistry.has(cardName);
}
