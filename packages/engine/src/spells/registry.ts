/**
 * Spell Registry - Central registry for spell implementations
 *
 * This module provides O(1) lookup for spell implementations using a Map.
 * Spells register their implementations during module initialization,
 * and getSpellImplementation() retrieves them at runtime.
 *
 * Design follows the same pattern as abilities/registry.ts for consistency.
 */

import type { SpellImplementation } from './SpellImplementation';

// =============================================================================
// REGISTRY
// =============================================================================

/**
 * Central registry mapping card names to their spell implementations
 */
const spellRegistry = new Map<string, SpellImplementation>();

/**
 * Register a spell implementation
 *
 * @param impl The spell implementation to register
 *
 * @example
 * ```typescript
 * registerSpell({
 *   cardName: 'Lightning Bolt',
 *   resolve: (state, stackObj) => {
 *     const target = stackObj.targets[0];
 *     if (target) applyDamage(state, target, 3);
 *   }
 * });
 * ```
 */
export function registerSpell(impl: SpellImplementation): void {
  if (spellRegistry.has(impl.cardName)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[SpellRegistry] Overwriting spell for: ${impl.cardName}`);
    }
  }
  spellRegistry.set(impl.cardName, impl);
}

/**
 * Register multiple spell implementations at once
 *
 * @param impls Array of spell implementations
 *
 * @example
 * ```typescript
 * registerSpells([
 *   { cardName: 'Shock', resolve: (state, stackObj) => { ... } },
 *   { cardName: 'Lightning Bolt', resolve: (state, stackObj) => { ... } },
 * ]);
 * ```
 */
export function registerSpells(impls: SpellImplementation[]): void {
  for (const impl of impls) {
    registerSpell(impl);
  }
}

/**
 * Get a spell implementation by card name
 *
 * @param cardName The card's name
 * @returns The spell implementation, or null if not registered
 */
export function getSpellImplementation(cardName: string): SpellImplementation | null {
  return spellRegistry.get(cardName) ?? null;
}

/**
 * Check if a card has a registered spell implementation
 */
export function hasSpellImplementation(cardName: string): boolean {
  return spellRegistry.has(cardName);
}

/**
 * Get all registered spell names
 *
 * Useful for debugging and statistics.
 */
export function getRegisteredSpells(): string[] {
  return Array.from(spellRegistry.keys());
}

/**
 * Get the count of registered spells
 */
export function getSpellRegistrySize(): number {
  return spellRegistry.size;
}

/**
 * Clear the registry (for testing purposes only)
 */
export function clearSpellRegistry(): void {
  spellRegistry.clear();
}
