/**
 * Spell Implementation System - Main Entry Point
 *
 * This module provides the primary API for spell implementations.
 * It uses a registry pattern with O(1) lookup for card-specific
 * spell effects, falling back to generic parsing for unregistered spells.
 *
 * Resolution order in stack.ts:
 * 1. Check registry for card-specific implementation (this system)
 * 2. Fall back to generic oracle text parsing (existing behavior)
 *
 * @example
 * ```typescript
 * import { getSpellImplementation } from '../spells';
 *
 * const impl = getSpellImplementation(template.name);
 * if (impl) {
 *   impl.resolve(state, stackObj);
 * } else {
 *   applyGenericSpellEffect(state, stackObj);
 * }
 * ```
 */

// Re-export types
export type { SpellImplementation, SpellFactory } from './SpellImplementation';

// Re-export registry functions
export {
  registerSpell,
  registerSpells,
  getSpellImplementation,
  hasSpellImplementation,
  getRegisteredSpells,
  getSpellRegistrySize,
  clearSpellRegistry,
} from './registry';

// =============================================================================
// CATEGORY IMPORTS
// =============================================================================

// Import category registrations - these files call registerSpells() during import
// Uncomment as categories are implemented:

import './categories/damage';
import './categories/destruction';
import './categories/counters';
import './categories/xcost';
import './categories/tutors';
import './categories/card-draw';
import './categories/graveyard';
import './categories/untap';
import './categories/prevention';
import './categories/misc';
