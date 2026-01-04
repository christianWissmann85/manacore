/**
 * 6th Edition - Mana-Producing Creatures
 *
 * Cards that tap or sacrifice to produce mana.
 */

import { registerAbilities, registerBulk } from '../../registry';
import {
  createTapForMana,
  createTapForAnyColor,
  createTapForMultipleMana,
  createSacrificeForMana,
} from '../../templates';

// =============================================================================
// GREEN MANA DORKS
// =============================================================================

// Llanowar Elves, Fyndhorn Elves, Elvish Mystic
// "{T}: Add {G}."
registerBulk(['Llanowar Elves', 'Fyndhorn Elves', 'Elvish Mystic'], (card) => [
  createTapForMana(card, ['G']),
]);

// Fyndhorn Elder
// "{T}: Add {G}{G}."
registerAbilities('Fyndhorn Elder', (card) => [createTapForMultipleMana(card, 'G', 2)]);

// =============================================================================
// MULTI-COLOR MANA
// =============================================================================

// Birds of Paradise
// "{T}: Add one mana of any color."
registerAbilities('Birds of Paradise', (card) => [createTapForAnyColor(card)]);

// =============================================================================
// SACRIFICE FOR MANA
// =============================================================================

// Blood Pet
// "Sacrifice Blood Pet: Add {B}."
registerAbilities('Blood Pet', (card) => [createSacrificeForMana(card, ['B'])]);

// =============================================================================
// EXPORT COUNT
// =============================================================================

export const MANA_CREATURES_COUNT = 6;
