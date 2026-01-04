/**
 * Tutor/Search Spells Category
 *
 * Contains implementations for spells that search libraries.
 * These spells use the searchLibrary helper from effects.ts.
 *
 * Cards in this category:
 * - Enlightened Tutor: Search for artifact/enchantment, put on top of library
 * - Mystical Tutor: Search for instant/sorcery, put on top of library
 * - Vampiric Tutor: Search for any card, put on top of library, lose 2 life
 * - Worldly Tutor: Search for creature, put on top of library
 * - Rampant Growth: Search for basic land, put onto battlefield tapped
 * - Untamed Wilds: Search for basic land, put onto battlefield
 */

import type { SpellImplementation } from '../SpellImplementation';
import { CardLoader } from '../../cards/CardLoader';
import {
  isCreature,
  isArtifact,
  isEnchantment,
  isInstant,
  isSorcery,
} from '../../cards/CardTemplate';
import { registerSpells } from '../registry';
import { searchLibrary } from '../../rules/effects';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a card is a basic land
 */
function isBasicLand(template: { type_line?: string; name?: string }): boolean {
  const basicLandNames = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
  if (template.name && basicLandNames.includes(template.name)) {
    return true;
  }
  return template.type_line?.toLowerCase().includes('basic land') || false;
}

// =============================================================================
// SPELL IMPLEMENTATIONS
// =============================================================================

export const tutorSpells: SpellImplementation[] = [
  {
    cardName: 'Enlightened Tutor',
    resolve: (state, stackObj) => {
      // Search your library for an artifact or enchantment card,
      // reveal it, put on top of library, shuffle
      searchLibrary(
        state,
        stackObj.controller,
        stackObj.controller,
        (card) => {
          const template = CardLoader.getById(card.scryfallId);
          return template ? isArtifact(template) || isEnchantment(template) : false;
        },
        'library_top',
      );
    },
  },

  {
    cardName: 'Mystical Tutor',
    resolve: (state, stackObj) => {
      // Search your library for an instant or sorcery card,
      // reveal it, put on top of library, shuffle
      searchLibrary(
        state,
        stackObj.controller,
        stackObj.controller,
        (card) => {
          const template = CardLoader.getById(card.scryfallId);
          return template ? isInstant(template) || isSorcery(template) : false;
        },
        'library_top',
      );
    },
  },

  {
    cardName: 'Vampiric Tutor',
    resolve: (state, stackObj) => {
      // Search your library for a card, put on top of library, lose 2 life, shuffle
      searchLibrary(
        state,
        stackObj.controller,
        stackObj.controller,
        () => true, // Any card
        'library_top',
      );
      state.players[stackObj.controller].life -= 2;
    },
  },

  {
    cardName: 'Worldly Tutor',
    resolve: (state, stackObj) => {
      // Search your library for a creature card,
      // reveal it, put on top of library, shuffle
      searchLibrary(
        state,
        stackObj.controller,
        stackObj.controller,
        (card) => {
          const template = CardLoader.getById(card.scryfallId);
          return template ? isCreature(template) : false;
        },
        'library_top',
      );
    },
  },

  {
    cardName: 'Rampant Growth',
    resolve: (state, stackObj) => {
      // Search your library for a basic land card,
      // put it onto the battlefield tapped, shuffle
      searchLibrary(
        state,
        stackObj.controller,
        stackObj.controller,
        (card) => {
          const template = CardLoader.getById(card.scryfallId);
          return template ? isBasicLand(template) : false;
        },
        'battlefield_tapped',
      );
    },
  },

  {
    cardName: 'Untamed Wilds',
    resolve: (state, stackObj) => {
      // Search your library for a basic land card,
      // put it onto the battlefield, shuffle
      searchLibrary(
        state,
        stackObj.controller,
        stackObj.controller,
        (card) => {
          const template = CardLoader.getById(card.scryfallId);
          return template ? isBasicLand(template) : false;
        },
        'battlefield',
      );
    },
  },
];

// =============================================================================
// REGISTRATION
// =============================================================================

registerSpells(tutorSpells);
