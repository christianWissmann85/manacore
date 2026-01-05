/**
 * 6th Edition Card Abilities
 *
 * This file imports all 6th Edition card ability registrations.
 * Each category file calls registerAbilities() for its cards.
 *
 * Categories:
 * - lands: Pain lands, sacrifice lands, City of Brass, Crystal Vein
 * - mana-creatures: Llanowar Elves, Birds of Paradise, Blood Pet, etc.
 * - pingers: Prodigal Sorcerer, Anaba Shaman, etc.
 * - pumpers: Flame Spirit, Infantry Veteran, etc.
 * - regeneration: Drudge Skeletons, River Boa, etc.
 * - sacrifice: Fallen Angel, Skull Catapult, etc.
 * - utility: Samite Healer, Elder Druid, etc.
 * - enchantments: Greed, Tranquil Grove, Circles of Protection, etc.
 * - artifacts: Diamonds (mana rocks), Mana Prism
 */

// Special lands (pain lands, sacrifice lands, City of Brass, etc.)
import { LANDS_COUNT } from './lands';

// Mana-producing creatures (Llanowar Elves, Birds of Paradise, etc.)
import { MANA_CREATURES_COUNT } from './mana-creatures';

// Damage-dealing creatures (Prodigal Sorcerer, Anaba Shaman, etc.)
import { PINGERS_COUNT } from './pingers';

// Pump-self creatures (Flame Spirit, Dragon Engine, etc.)
import { PUMPERS_COUNT } from './pumpers';

// Regeneration creatures (Drudge Skeletons, River Boa, etc.)
import { REGENERATION_COUNT } from './regeneration';

// Sacrifice-based abilities (Fallen Angel, Blood Pet, etc.)
import { SACRIFICE_COUNT } from './sacrifice';

// Utility abilities (Samite Healer, Elder Druid, etc.)
import { UTILITY_COUNT } from './utility';

// Global enchantments (Greed, Tranquil Grove, Circles of Protection, etc.)
import { ENCHANTMENTS_COUNT } from './enchantments';

// Artifacts (Diamonds, Mana Prism, etc.)
import { ARTIFACTS_COUNT } from './artifacts';

// Export registration stats for debugging
export const CARDS_REGISTERED =
  LANDS_COUNT +
  MANA_CREATURES_COUNT +
  PINGERS_COUNT +
  PUMPERS_COUNT +
  REGENERATION_COUNT +
  SACRIFICE_COUNT +
  UTILITY_COUNT +
  ENCHANTMENTS_COUNT +
  ARTIFACTS_COUNT;

// Log registration count in development
if (process.env.NODE_ENV !== 'production' && !process.env.MANACORE_SILENT_INIT) {
  console.log(`[6ed] Registered ${CARDS_REGISTERED} cards with abilities`);
}
