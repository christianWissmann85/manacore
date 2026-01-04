/**
 * Destruction Spells Category
 *
 * Contains implementations for spells that destroy permanents, including:
 * - Mass destruction (Wrath of God, Armageddon, etc.)
 * - Targeted destruction (Shatter, Stone Rain, etc.)
 * - Color hosers (Perish, Boil, Flashfires)
 * - Conditional destruction (Fatal Blow, Reprisal)
 *
 * Cards in this category:
 * - Wrath of God: Destroy all creatures
 * - Armageddon: Destroy all lands
 * - Shatterstorm: Destroy all artifacts
 * - Tranquility: Destroy all enchantments
 * - Perish: Destroy all green creatures
 * - Flashfires: Destroy all Plains
 * - Boil: Destroy all Islands
 * - Jokulhaups: Destroy all artifacts, creatures, and lands
 * - Shatter: Destroy target artifact
 * - Stone Rain: Destroy target land
 * - Pillage: Destroy target artifact or land
 * - Creeping Mold: Destroy target artifact, enchantment, or land
 * - Fatal Blow: Destroy target creature that was dealt damage this turn
 * - Reprisal: Destroy target creature with power 4 or greater
 */

import type { SpellImplementation } from '../SpellImplementation';
import { registerSpells } from '../registry';
import {
  // Mass destruction
  destroyAllCreatures,
  destroyAllLands,
  destroyAllArtifacts,
  destroyAllEnchantments,
  destroyAllCreaturesOfColor,
  destroyAllLandsOfType,
  destroyAllNonEnchantments,
  // Single target destruction
  destroyPermanent,
  // Conditional destruction
  destroyIfDamaged,
  destroyIfPowerFourOrGreater,
} from '../../rules/effects';

// =============================================================================
// SPELL IMPLEMENTATIONS
// =============================================================================

export const destructionSpells: SpellImplementation[] = [
  // ===========================================================================
  // MASS DESTRUCTION SPELLS
  // ===========================================================================

  {
    cardName: 'Wrath of God',
    resolve: (state) => {
      // Destroy all creatures. They can't be regenerated.
      destroyAllCreatures(state);
    },
  },

  {
    cardName: 'Armageddon',
    resolve: (state) => {
      // Destroy all lands
      destroyAllLands(state);
    },
  },

  {
    cardName: 'Shatterstorm',
    resolve: (state) => {
      // Destroy all artifacts. They can't be regenerated.
      destroyAllArtifacts(state);
    },
  },

  {
    cardName: 'Tranquility',
    resolve: (state) => {
      // Destroy all enchantments
      destroyAllEnchantments(state);
    },
  },

  {
    cardName: 'Perish',
    resolve: (state) => {
      // Destroy all green creatures. They can't be regenerated.
      destroyAllCreaturesOfColor(state, 'G');
    },
  },

  {
    cardName: 'Flashfires',
    resolve: (state) => {
      // Destroy all Plains
      destroyAllLandsOfType(state, 'Plains');
    },
  },

  {
    cardName: 'Boil',
    resolve: (state) => {
      // Destroy all Islands
      destroyAllLandsOfType(state, 'Island');
    },
  },

  {
    cardName: 'Jokulhaups',
    resolve: (state) => {
      // Destroy all artifacts, creatures, and lands
      destroyAllNonEnchantments(state);
    },
  },

  // ===========================================================================
  // TARGETED DESTRUCTION SPELLS
  // ===========================================================================

  {
    cardName: 'Shatter',
    resolve: (state, stackObj) => {
      // Destroy target artifact
      const target = stackObj.targets[0];
      if (target) {
        destroyPermanent(state, target);
      }
    },
  },

  {
    cardName: 'Stone Rain',
    resolve: (state, stackObj) => {
      // Destroy target land
      const target = stackObj.targets[0];
      if (target) {
        destroyPermanent(state, target);
      }
    },
  },

  {
    cardName: 'Pillage',
    resolve: (state, stackObj) => {
      // Destroy target artifact or land. It can't be regenerated.
      const target = stackObj.targets[0];
      if (target) {
        destroyPermanent(state, target);
      }
    },
  },

  {
    cardName: 'Creeping Mold',
    resolve: (state, stackObj) => {
      // Destroy target artifact, enchantment, or land
      const target = stackObj.targets[0];
      if (target) {
        destroyPermanent(state, target);
      }
    },
  },

  // ===========================================================================
  // CONDITIONAL DESTRUCTION SPELLS
  // ===========================================================================

  {
    cardName: 'Fatal Blow',
    resolve: (state, stackObj) => {
      // Destroy target creature that was dealt damage this turn
      const target = stackObj.targets[0];
      if (target) {
        destroyIfDamaged(state, target);
      }
    },
  },

  {
    cardName: 'Reprisal',
    resolve: (state, stackObj) => {
      // Destroy target creature with power 4 or greater. It can't be regenerated.
      const target = stackObj.targets[0];
      if (target) {
        destroyIfPowerFourOrGreater(state, target);
      }
    },
  },
];

// =============================================================================
// REGISTRATION
// =============================================================================

registerSpells(destructionSpells);
