/**
 * 6th Edition - Special Land Abilities
 *
 * This file registers activated abilities for non-basic lands with special
 * mana abilities. Basic lands are handled generically by the mana system.
 *
 * Categories:
 * - Pain lands: Tap for colorless or colored (with 1 damage)
 * - Sacrifice lands: Tap for single mana or sacrifice for double
 * - City of Brass: Tap for any color (damage is a trigger, not cost)
 * - Crystal Vein: Tap for colorless or sacrifice for double colorless
 */

import { registerAbilities } from '../../registry';
import {
  createPainLandAbilities,
  createSacrificeLandAbilities,
  createCrystalVeinAbilities,
  createCityOfBrassAbility,
} from '../../templates';

// =============================================================================
// PAIN LANDS
// =============================================================================

// Adarkar Wastes
// "{T}: Add {C}."
// "{T}: Add {W} or {U}. Adarkar Wastes deals 1 damage to you."
registerAbilities('Adarkar Wastes', (card) => createPainLandAbilities(card, ['W', 'U']));

// Brushland
// "{T}: Add {C}."
// "{T}: Add {G} or {W}. Brushland deals 1 damage to you."
registerAbilities('Brushland', (card) => createPainLandAbilities(card, ['G', 'W']));

// Karplusan Forest
// "{T}: Add {C}."
// "{T}: Add {R} or {G}. Karplusan Forest deals 1 damage to you."
registerAbilities('Karplusan Forest', (card) => createPainLandAbilities(card, ['R', 'G']));

// Sulfurous Springs
// "{T}: Add {C}."
// "{T}: Add {B} or {R}. Sulfurous Springs deals 1 damage to you."
registerAbilities('Sulfurous Springs', (card) => createPainLandAbilities(card, ['B', 'R']));

// Underground River
// "{T}: Add {C}."
// "{T}: Add {U} or {B}. Underground River deals 1 damage to you."
registerAbilities('Underground River', (card) => createPainLandAbilities(card, ['U', 'B']));

// =============================================================================
// SACRIFICE LANDS (Enter tapped)
// =============================================================================

// Dwarven Ruins
// "Dwarven Ruins enters tapped."
// "{T}: Add {R}."
// "{T}, Sacrifice Dwarven Ruins: Add {R}{R}."
registerAbilities('Dwarven Ruins', (card) => createSacrificeLandAbilities(card, 'R'));

// Ebon Stronghold
// "Ebon Stronghold enters tapped."
// "{T}: Add {B}."
// "{T}, Sacrifice Ebon Stronghold: Add {B}{B}."
registerAbilities('Ebon Stronghold', (card) => createSacrificeLandAbilities(card, 'B'));

// Havenwood Battleground
// "Havenwood Battleground enters tapped."
// "{T}: Add {G}."
// "{T}, Sacrifice Havenwood Battleground: Add {G}{G}."
registerAbilities('Havenwood Battleground', (card) => createSacrificeLandAbilities(card, 'G'));

// Ruins of Trokair
// "Ruins of Trokair enters tapped."
// "{T}: Add {W}."
// "{T}, Sacrifice Ruins of Trokair: Add {W}{W}."
registerAbilities('Ruins of Trokair', (card) => createSacrificeLandAbilities(card, 'W'));

// Svyelunite Temple
// "Svyelunite Temple enters tapped."
// "{T}: Add {U}."
// "{T}, Sacrifice Svyelunite Temple: Add {U}{U}."
registerAbilities('Svyelunite Temple', (card) => createSacrificeLandAbilities(card, 'U'));

// =============================================================================
// SPECIAL LANDS
// =============================================================================

// Crystal Vein
// "{T}: Add {C}."
// "{T}, Sacrifice Crystal Vein: Add {C}{C}."
registerAbilities('Crystal Vein', (card) => createCrystalVeinAbilities(card));

// City of Brass
// "Whenever City of Brass becomes tapped, it deals 1 damage to you."
// "{T}: Add one mana of any color."
// Note: The damage trigger is handled in triggers.ts
registerAbilities('City of Brass', (card) => [createCityOfBrassAbility(card)]);

// =============================================================================
// EXPORT COUNT
// =============================================================================

export const LANDS_COUNT = 12;
