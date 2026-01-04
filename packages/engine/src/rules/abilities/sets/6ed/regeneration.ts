/**
 * 6th Edition - Regeneration Creatures
 *
 * Creatures with regeneration abilities.
 */

import { registerAbilities, registerBulk } from '../../registry';
import {
  createRegenerate,
  createLifeRegenerate,
  createLandSacrificeRegenerate,
} from '../../templates';

// =============================================================================
// BLACK REGENERATION ({B}: Regenerate)
// =============================================================================

// Drudge Skeletons, Kjeldoran Dead
// "{B}: Regenerate this creature."
registerBulk(['Drudge Skeletons', 'Kjeldoran Dead'], (card) => [createRegenerate(card, '{B}')]);

// =============================================================================
// GREEN REGENERATION ({G}: Regenerate)
// =============================================================================

// River Boa
// "{G}: Regenerate this creature." (also has Islandwalk)
registerAbilities('River Boa', (card) => [createRegenerate(card, '{G}')]);

// Gorilla Chieftain
// "{1}{G}: Regenerate this creature."
registerAbilities('Gorilla Chieftain', (card) => [createRegenerate(card, '{1}{G}')]);

// =============================================================================
// LIFE PAYMENT REGENERATION
// =============================================================================

// Mischievous Poltergeist
// "Pay 1 life: Regenerate this creature." (also has Flying)
registerAbilities('Mischievous Poltergeist', (card) => [createLifeRegenerate(card, 1)]);

// =============================================================================
// SACRIFICE REGENERATION
// =============================================================================

// Uktabi Wildcats
// "{G}, Sacrifice a Forest: Regenerate this creature." (P/T = Forests)
registerAbilities('Uktabi Wildcats', (card) => [
  createLandSacrificeRegenerate(card, '{G}', 'Forest'),
]);

// =============================================================================
// EXPORT COUNT
// =============================================================================

export const REGENERATION_COUNT = 6;
