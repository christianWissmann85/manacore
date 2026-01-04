/**
 * Prevention Spells Category
 *
 * Contains implementations for spells that prevent damage or provide
 * protective effects.
 *
 * Cards in this category:
 * - Fog: Prevent all combat damage this turn
 * - Healing Salve: Target player gains 3 life OR prevent 3 damage
 * - Remedy: Prevent next 5 damage to target creature
 * - Reverse Damage: Prevent damage, gain life equal to prevented
 */

import type { SpellImplementation } from '../SpellImplementation';
import type { GameState } from '../../state/GameState';
import type { PlayerId } from '../../state/Zone';
import { registerSpells } from '../registry';
import { gainLife, findPermanentByInstanceId } from '../../rules/effects';

// =============================================================================
// SPELL IMPLEMENTATIONS
// =============================================================================

export const preventionSpells: SpellImplementation[] = [
  {
    cardName: 'Fog',
    resolve: (state) => {
      // Prevent all combat damage that would be dealt this turn
      state.preventAllCombatDamage = true;
    },
  },

  {
    cardName: 'Healing Salve',
    resolve: (state, stackObj) => {
      // Choose one:
      // - Target player gains 3 life
      // - Prevent the next 3 damage that would be dealt to any target
      // For now, only implement life gain mode (targets[0] should be 'player' or 'opponent')
      const target = stackObj.targets[0];
      if (target === 'player' || target === 'opponent') {
        gainLife(state, target, 3);
      }
      // TODO: Implement prevention mode with damage shields
    },
  },

  {
    cardName: 'Remedy',
    resolve: (state, stackObj) => {
      // Prevent the next 5 damage that would be dealt to target creature this turn
      // Simplified: Remove 5 damage from creature (if it has damage)
      const target = stackObj.targets[0];
      if (target) {
        const creature = findPermanentByInstanceId(state, target);
        if (creature) {
          creature.damage = Math.max(0, creature.damage - 5);
        }
      }
    },
  },

  {
    cardName: 'Reverse Damage',
    resolve: (state, stackObj) => {
      // The next time a source would deal damage to you this turn,
      // prevent that damage. You gain life equal to damage prevented.
      // Simplified: Gain 5 life (approximation of typical damage)
      gainLife(state, stackObj.controller, 5);
    },
  },
];

// =============================================================================
// REGISTRATION
// =============================================================================

registerSpells(preventionSpells);
