/**
 * Damage Spells Category
 *
 * Contains implementations for spells that deal damage to creatures
 * and/or players. Simple targeted damage spells (like Shock, Lightning Bolt)
 * are handled by generic oracle text parsing.
 *
 * Cards in this category:
 * - Dry Spell: 1 damage to each creature and player
 * - Tremor: 1 damage to each non-flying creature
 * - Inferno: 6 damage to each creature and player
 * - Vertigo: 2 damage to target flying creature
 * - Spitting Earth: Damage equal to Mountains you control
 * - Pyrotechnics: 4 damage divided among targets
 */

import type { SpellImplementation } from '../SpellImplementation';
import type { GameState, StackObject } from '../../state/GameState';
import type { PlayerId } from '../../state/Zone';
import { CardLoader } from '../../cards/CardLoader';
import { registerSpells } from '../registry';
import { dealDamageToAll, applyDamage } from '../../rules/effects';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Count Mountains controlled by a player
 * Used by: Spitting Earth
 */
function countMountains(state: GameState, controller: PlayerId): number {
  const player = state.players[controller];
  let count = 0;

  for (const permanent of player.battlefield) {
    const template = CardLoader.getById(permanent.scryfallId);
    if (template) {
      if (
        template.name === 'Mountain' ||
        (template.type_line && template.type_line.includes('Mountain'))
      ) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Apply Pyrotechnics: 4 damage divided among targets
 */
function applyPyrotechnics(state: GameState, stackObj: StackObject): void {
  const targets = stackObj.targets;
  if (targets.length === 0) return;

  // Divide 4 damage evenly among all targets, remainder goes to first target
  const damagePerTarget = Math.floor(4 / targets.length);
  const remainder = 4 % targets.length;

  for (let i = 0; i < targets.length; i++) {
    const damage = damagePerTarget + (i === 0 ? remainder : 0);
    applyDamage(state, targets[i]!, damage);
  }
}

// =============================================================================
// SPELL IMPLEMENTATIONS
// =============================================================================

export const damageSpells: SpellImplementation[] = [
  {
    cardName: 'Dry Spell',
    resolve: (state) => {
      // Dry Spell deals 1 damage to each creature and each player
      dealDamageToAll(state, 1, { creatures: true, players: true });
    },
  },

  {
    cardName: 'Tremor',
    resolve: (state) => {
      // Tremor deals 1 damage to each creature without flying
      dealDamageToAll(state, 1, {
        creatures: true,
        players: false,
        excludeFlyers: true,
      });
    },
  },

  {
    cardName: 'Inferno',
    resolve: (state) => {
      // Inferno deals 6 damage to each creature and each player
      dealDamageToAll(state, 6, { creatures: true, players: true });
    },
  },

  {
    cardName: 'Vertigo',
    resolve: (state, stackObj) => {
      // Vertigo deals 2 damage to target creature with flying
      const target = stackObj.targets[0];
      if (target) {
        applyDamage(state, target, 2);
      }
    },
  },

  {
    cardName: 'Spitting Earth',
    resolve: (state, stackObj) => {
      // Spitting Earth deals damage equal to the number of Mountains you control
      const target = stackObj.targets[0];
      if (target) {
        const mountainCount = countMountains(state, stackObj.controller);
        applyDamage(state, target, mountainCount);
      }
    },
  },

  {
    cardName: 'Pyrotechnics',
    resolve: (state, stackObj) => {
      // Pyrotechnics deals 4 damage divided as you choose among any number of targets
      applyPyrotechnics(state, stackObj);
    },
  },
];

// =============================================================================
// REGISTRATION
// =============================================================================

registerSpells(damageSpells);
