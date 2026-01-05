/**
 * 6th Edition - Enchantment Abilities
 *
 * Activated abilities on global enchantments.
 * Phase 1.5.5: Week 1.5.5 Global Enchantments
 */

import { registerAbilities } from '../../registry';
import { sourceExistsCheck, countAvailableMana } from '../../templates';
import type { ActivatedAbility } from '../../types';
import type { GameState } from '../../../../state/GameState';
import type { PlayerId } from '../../../../state/Zone';

// =============================================================================
// CARD DRAW ENCHANTMENTS
// =============================================================================

// Greed
// "{B}, Pay 2 life: Draw a card."
registerAbilities('Greed', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_greed_draw`,
    name: '{B}, Pay 2 life: Draw a card',
    cost: { mana: '{B}', life: 2 },
    effect: {
      type: 'CUSTOM',
      custom: (state: GameState) => {
        const player = state.players[card.controller];
        if (player.library.length > 0) {
          const drawnCard = player.library.shift()!;
          drawnCard.zone = 'hand';
          player.hand.push(drawnCard);
        }
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!sourceExistsCheck(state, sourceId, controller)) {
        return false;
      }
      const player = state.players[controller];
      // Must have more than 2 life to pay
      if (player.life <= 2) return false;
      // Must have black mana
      if (countAvailableMana(state, controller, 'B') < 1) return false;
      return true;
    },
  };
  return [ability];
});

// =============================================================================
// ENCHANTMENT DESTRUCTION
// =============================================================================

// Tranquil Grove
// "{1}{G}{G}: Destroy all other enchantments."
registerAbilities('Tranquil Grove', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tranquil_destroy`,
    name: '{1}{G}{G}: Destroy all other enchantments',
    cost: { mana: '{1}{G}{G}' },
    effect: {
      type: 'CUSTOM',
      custom: (state: GameState) => {
        // Destroy all enchantments except this one
        for (const playerId of ['player', 'opponent'] as const) {
          const player = state.players[playerId];
          const enchantmentsToDestroy = player.battlefield.filter((c) => {
            if (c.instanceId === card.instanceId) return false; // Don't destroy self
            const template = require('../../../../cards/CardLoader').CardLoader.getById(
              c.scryfallId,
            );
            return template && template.type_line?.toLowerCase().includes('enchantment');
          });

          for (const ench of enchantmentsToDestroy) {
            const index = player.battlefield.indexOf(ench);
            if (index !== -1) {
              player.battlefield.splice(index, 1);
              ench.zone = 'graveyard';
              ench.attachedTo = undefined;
              player.graveyard.push(ench);
            }
          }
        }
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!sourceExistsCheck(state, sourceId, controller)) {
        return false;
      }
      // Check mana: need 1 colorless + 2 green
      if (countAvailableMana(state, controller, 'G') < 2) return false;
      // For simplicity, we assume {1} can be paid if there's any available mana
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      // Need at least 3 total mana (2G + 1)
      if (totalMana < 3) return false;
      return true;
    },
  };
  return [ability];
});

// =============================================================================
// CIRCLES OF PROTECTION
// =============================================================================

// Circle of Protection: Black
// "{1}: The next time a black source of your choice would deal damage to you this turn, prevent that damage."
registerAbilities('Circle of Protection: Black', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_cop_black`,
    name: '{1}: Prevent next black damage',
    cost: { mana: '{1}' },
    effect: {
      type: 'CUSTOM',
      custom: (state: GameState) => {
        // Add a prevention shield for black damage
        const player = state.players[card.controller];
        if (!player.preventionShields) player.preventionShields = [];
        player.preventionShields.push({ color: 'B', amount: 'next' });
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!sourceExistsCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 1;
    },
  };
  return [ability];
});

// Circle of Protection: Blue
registerAbilities('Circle of Protection: Blue', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_cop_blue`,
    name: '{1}: Prevent next blue damage',
    cost: { mana: '{1}' },
    effect: {
      type: 'CUSTOM',
      custom: (state: GameState) => {
        const player = state.players[card.controller];
        if (!player.preventionShields) player.preventionShields = [];
        player.preventionShields.push({ color: 'U', amount: 'next' });
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!sourceExistsCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 1;
    },
  };
  return [ability];
});

// Circle of Protection: Green
registerAbilities('Circle of Protection: Green', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_cop_green`,
    name: '{1}: Prevent next green damage',
    cost: { mana: '{1}' },
    effect: {
      type: 'CUSTOM',
      custom: (state: GameState) => {
        const player = state.players[card.controller];
        if (!player.preventionShields) player.preventionShields = [];
        player.preventionShields.push({ color: 'G', amount: 'next' });
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!sourceExistsCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 1;
    },
  };
  return [ability];
});

// Circle of Protection: Red
registerAbilities('Circle of Protection: Red', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_cop_red`,
    name: '{1}: Prevent next red damage',
    cost: { mana: '{1}' },
    effect: {
      type: 'CUSTOM',
      custom: (state: GameState) => {
        const player = state.players[card.controller];
        if (!player.preventionShields) player.preventionShields = [];
        player.preventionShields.push({ color: 'R', amount: 'next' });
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!sourceExistsCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 1;
    },
  };
  return [ability];
});

// Circle of Protection: White
registerAbilities('Circle of Protection: White', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_cop_white`,
    name: '{1}: Prevent next white damage',
    cost: { mana: '{1}' },
    effect: {
      type: 'CUSTOM',
      custom: (state: GameState) => {
        const player = state.players[card.controller];
        if (!player.preventionShields) player.preventionShields = [];
        player.preventionShields.push({ color: 'W', amount: 'next' });
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!sourceExistsCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 1;
    },
  };
  return [ability];
});

// =============================================================================
// TOKEN GENERATION ENCHANTMENTS
// =============================================================================

// Goblin Warrens
// "{2}{R}, Sacrifice two Goblins: Create three 1/1 red Goblin creature tokens."
registerAbilities('Goblin Warrens', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_warrens_create`,
    name: '{2}{R}, Sacrifice two Goblins: Create 3 Goblin tokens',
    cost: { mana: '{2}{R}' }, // Sacrifice cost is checked in canActivate
    effect: {
      type: 'CUSTOM',
      custom: (state: GameState) => {
        // Import createTokens from tokens.ts
        const { createTokens } = require('../../../tokens');
        // Find 2 goblins to sacrifice
        const player = state.players[card.controller];
        const goblins = player.battlefield.filter((c) => {
          if (c.isToken && c.tokenType === 'Goblin') return true;
          const template = require('../../../../cards/CardLoader').CardLoader.getById(c.scryfallId);
          return template && template.type_line?.toLowerCase().includes('goblin');
        });

        // Sacrifice 2 goblins
        for (let i = 0; i < 2 && i < goblins.length; i++) {
          const goblin = goblins[i];
          if (!goblin) continue;
          const index = player.battlefield.indexOf(goblin);
          if (index !== -1) {
            player.battlefield.splice(index, 1);
            goblin.zone = 'graveyard';
            if (!goblin.isToken) {
              player.graveyard.push(goblin);
            }
          }
        }

        // Create 3 goblin tokens
        createTokens(state, card.controller, 'goblin', 3);
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!sourceExistsCheck(state, sourceId, controller)) return false;

      // Check mana: need 2 colorless + 1 red
      if (countAvailableMana(state, controller, 'R') < 1) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      if (totalMana < 3) return false;

      // Check for 2 Goblins to sacrifice
      const player = state.players[controller];
      const goblins = player.battlefield.filter((c) => {
        if (c.isToken && c.tokenType === 'Goblin') return true;
        const template = require('../../../../cards/CardLoader').CardLoader.getById(c.scryfallId);
        return template && template.type_line?.toLowerCase().includes('goblin');
      });
      if (goblins.length < 2) return false;

      return true;
    },
  };
  return [ability];
});

// =============================================================================
// DAMAGE ENCHANTMENTS
// =============================================================================

// Pestilence
// "{B}: Pestilence deals 1 damage to each creature and each player."
// Note: The trigger "At end step, if no creatures, sacrifice this" is handled in triggers.ts
registerAbilities('Pestilence', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_pestilence_damage`,
    name: '{B}: Deal 1 damage to each creature and player',
    cost: { mana: '{B}' },
    effect: {
      type: 'CUSTOM',
      custom: (state: GameState) => {
        // Deal 1 damage to each player
        state.players.player.life -= 1;
        state.players.opponent.life -= 1;

        // Deal 1 damage to each creature
        for (const playerId of ['player', 'opponent'] as const) {
          for (const creature of state.players[playerId].battlefield) {
            const template = require('../../../../cards/CardLoader').CardLoader.getById(
              creature.scryfallId,
            );
            if (template && template.type_line?.toLowerCase().includes('creature')) {
              creature.damage += 1;
            }
            // Also handle token creatures
            if (creature.isToken) {
              creature.damage += 1;
            }
          }
        }
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!sourceExistsCheck(state, sourceId, controller)) return false;
      if (countAvailableMana(state, controller, 'B') < 1) return false;
      return true;
    },
  };
  return [ability];
});

// =============================================================================
// REANIMATION ENCHANTMENTS
// =============================================================================

// Strands of Night
// "{B}{B}, Pay 2 life, Sacrifice a Swamp: Return target creature card from your graveyard to the battlefield."
registerAbilities('Strands of Night', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_strands_reanimate`,
    name: '{B}{B}, 2 life, Sac Swamp: Return creature',
    cost: { mana: '{B}{B}', life: 2 },
    effect: {
      type: 'CUSTOM',
      custom: (state: GameState) => {
        const player = state.players[card.controller];

        // Find and sacrifice a Swamp
        const swampIndex = player.battlefield.findIndex((c) => {
          const t = require('../../../../cards/CardLoader').CardLoader.getById(c.scryfallId);
          return t && t.type_line?.includes('Swamp');
        });

        if (swampIndex !== -1) {
          const swamp = player.battlefield.splice(swampIndex, 1)[0]!;
          swamp.zone = 'graveyard';
          swamp.tapped = false;
          player.graveyard.push(swamp);
        }

        // Find a creature card in graveyard and return to battlefield
        const creatureIndex = player.graveyard.findIndex((c) => {
          if (c.isToken) return false;
          const t = require('../../../../cards/CardLoader').CardLoader.getById(c.scryfallId);
          return t && t.type_line?.toLowerCase().includes('creature');
        });

        if (creatureIndex !== -1) {
          const creature = player.graveyard.splice(creatureIndex, 1)[0]!;
          creature.zone = 'battlefield';
          creature.damage = 0;
          creature.tapped = false;
          creature.summoningSick = true;
          player.battlefield.push(creature);
        }
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!sourceExistsCheck(state, sourceId, controller)) return false;

      const player = state.players[controller];

      // Check life: need more than 2 life to pay
      if (player.life <= 2) return false;

      // Check mana: need 2 black
      if (countAvailableMana(state, controller, 'B') < 2) return false;

      // Check for a Swamp to sacrifice
      const hasSwamp = player.battlefield.some((c) => {
        const t = require('../../../../cards/CardLoader').CardLoader.getById(c.scryfallId);
        return t && t.type_line?.includes('Swamp');
      });
      if (!hasSwamp) return false;

      // Check for a creature card in graveyard
      const hasCreature = player.graveyard.some((c) => {
        if (c.isToken) return false;
        const t = require('../../../../cards/CardLoader').CardLoader.getById(c.scryfallId);
        return t && t.type_line?.toLowerCase().includes('creature');
      });

      return hasCreature;
    },
  };
  return [ability];
});

// =============================================================================
// SACRIFICE ENCHANTMENTS
// =============================================================================

// Hecatomb
// "{T}, Sacrifice a creature: Hecatomb deals 1 damage to any target."
registerAbilities('Hecatomb', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_hecatomb_damage`,
    name: '{T}, Sacrifice creature: Deal 1 damage',
    cost: { tap: true, sacrifice: { type: 'creature' } },
    effect: {
      type: 'DAMAGE',
      amount: 1,
    },
    isManaAbility: false,
    targetRequirements: [
      {
        id: 'target_0',
        count: 1,
        targetType: 'any',
        zone: 'battlefield',
        restrictions: [],
        optional: false,
        description: 'any target',
      },
    ],
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      const player = state.players[controller];

      // Check source exists and is untapped
      const source = player.battlefield.find((c) => c.instanceId === sourceId);
      if (!source || source.tapped) return false;

      // Check for a creature to sacrifice
      const hasCreature = player.battlefield.some((c) => {
        if (c.instanceId === sourceId) return false; // Can't sacrifice itself
        const template = require('../../../../cards/CardLoader').CardLoader.getById(c.scryfallId);
        if (template && template.type_line?.toLowerCase().includes('creature')) return true;
        if (c.isToken) return true;
        return false;
      });

      return hasCreature;
    },
  };
  return [ability];
});

// Export count for registry
export const ENCHANTMENTS_COUNT = 11; // Greed, Tranquil Grove, 5 CoPs, Goblin Warrens, Pestilence, Strands of Night, Hecatomb
