/**
 * Counter Spells Category
 *
 * Contains implementations for spells that counter other spells.
 * Simple "Counter target spell" effects are handled by generic oracle text parsing.
 * This category handles counter spells with special effects:
 *
 * Cards in this category:
 * - Memory Lapse: Counter target spell, put it on top of owner's library instead of graveyard
 * - Remove Soul: Counter target creature spell
 */

import type { SpellImplementation } from '../SpellImplementation';
import { registerSpells } from '../registry';
import { CardLoader } from '../../cards/CardLoader';
import { isCreature } from '../../cards/CardTemplate';

// =============================================================================
// SPELL IMPLEMENTATIONS
// =============================================================================

export const counterSpells: SpellImplementation[] = [
  {
    cardName: 'Counterspell',
    resolve: (state, stackObj) => {
      // Counter target spell
      const targetId = stackObj.targets[0];
      if (!targetId) return;

      const targetStackObj = state.stack.find((s) => s.id === targetId);
      if (!targetStackObj) return;

      // Mark as countered - it will be moved to graveyard when it resolves
      targetStackObj.countered = true;
    },
  },

  {
    cardName: 'Memory Lapse',
    resolve: (state, stackObj) => {
      // Counter target spell. Put it on top of its owner's library instead of
      // into that player's graveyard.
      const targetId = stackObj.targets[0];
      if (!targetId) return;

      const targetStackObj = state.stack.find((s) => s.id === targetId);
      if (!targetStackObj) return;

      // Mark as countered
      targetStackObj.countered = true;

      // Set a flag to indicate the spell should go to library top instead of graveyard
      // This is checked in resolveTopOfStack() when handling countered spells
      (targetStackObj as { putOnLibrary?: boolean }).putOnLibrary = true;
    },
  },

  {
    cardName: 'Remove Soul',
    resolve: (state, stackObj) => {
      // Counter target creature spell
      const targetId = stackObj.targets[0];
      if (!targetId) return;

      const targetStackObj = state.stack.find((s) => s.id === targetId);
      if (!targetStackObj) return;

      // Verify the target is a creature spell
      const template = CardLoader.getById(targetStackObj.card.scryfallId);
      if (template && isCreature(template)) {
        targetStackObj.countered = true;
      }
    },
  },
];

// =============================================================================
// REGISTRATION
// =============================================================================

registerSpells(counterSpells);
