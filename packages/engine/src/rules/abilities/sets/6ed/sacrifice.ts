/**
 * 6th Edition - Sacrifice-Based Abilities
 *
 * Creatures with abilities that require sacrificing creatures, lands, or self.
 */

import { registerAbilities } from '../../registry';
import {
  createSacrificeForPump,
  createSacrificeToDestroy,
  createSacrificeToCounter,
  createSacrificeCreatureForDamage,
  createSacrificeCreatureForDraw,
  createSacrificeLandForBuff,
  createSacrificeToPrevent,
} from '../../templates';
import { sourceExistsCheck, standardTapCheck, countAvailableMana } from '../../templates';
import type { ActivatedAbility } from '../../types';
import type { GameState } from '../../../../state/GameState';
import type { PlayerId } from '../../../../state/Zone';

// =============================================================================
// SACRIFICE CREATURE FOR PUMP
// =============================================================================

// Fallen Angel
// "Sacrifice a creature: Fallen Angel gets +2/+1 until end of turn."
registerAbilities('Fallen Angel', (card) => [createSacrificeForPump(card, 2, 1)]);

// Note: Skull Catapult and Phyrexian Vault moved to artifacts.ts

// =============================================================================
// SACRIFICE SELF TO DESTROY
// =============================================================================

// Daraja Griffin
// "Sacrifice Daraja Griffin: Destroy target black creature."
registerAbilities('Daraja Griffin', (card) => [createSacrificeToDestroy(card, { color: 'B' })]);

// Goblin Digging Team
// "{T}, Sacrifice Goblin Digging Team: Destroy target Wall."
registerAbilities('Goblin Digging Team', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_sac_destroy_wall`,
    name: '{T}, Sacrifice: Destroy Wall',
    cost: { tap: true, sacrifice: { type: 'self' } },
    effect: { type: 'DESTROY' },
    isManaAbility: false,
    targetRequirements: [
      {
        id: 'target_0',
        count: 1,
        targetType: 'creature',
        zone: 'battlefield',
        restrictions: [{ type: 'subtype', subtype: 'Wall' }],
        optional: false,
        description: 'target Wall',
      },
    ],
    canActivate: standardTapCheck,
  };
  return [ability];
});

// =============================================================================
// SACRIFICE SELF TO COUNTER
// =============================================================================

// Daring Apprentice
// "{T}, Sacrifice Daring Apprentice: Counter target spell."
registerAbilities('Daring Apprentice', (card) => [
  createSacrificeToCounter(card, { requireTap: true }),
]);

// Unyaro Griffin
// "Sacrifice Unyaro Griffin: Counter target red instant or sorcery spell."
registerAbilities('Unyaro Griffin', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_sac_counter_red`,
    name: 'Sacrifice: Counter red instant/sorcery',
    cost: { sacrifice: { type: 'self' } },
    effect: {
      type: 'CUSTOM',
      custom: () => {
        // Counter red instant/sorcery
      },
    },
    isManaAbility: false,
    targetRequirements: [
      {
        id: 'target_0',
        count: 1,
        targetType: 'spell' as 'creature', // Stack targeting
        zone: 'stack' as 'battlefield',
        restrictions: [], // Would need color restriction
        optional: false,
        description: 'target red instant or sorcery spell',
      },
    ],
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!sourceExistsCheck(state, sourceId, controller)) {
        return false;
      }
      // Must have a spell to counter
      return state.stack.length > 0;
    },
  };
  return [ability];
});

// =============================================================================
// SACRIFICE SELF FOR PREVENTION
// =============================================================================

// Resistance Fighter
// "Sacrifice Resistance Fighter: Prevent all combat damage target creature would deal this turn."
registerAbilities('Resistance Fighter', (card) => [createSacrificeToPrevent(card, 'all_combat')]);

// =============================================================================
// SACRIFICE LAND FOR EFFECT
// =============================================================================

// Blighted Shaman
// "{T}, Sacrifice a Swamp: Target creature gets +1/+1 until end of turn."
registerAbilities('Blighted Shaman', (card) => [createSacrificeLandForBuff(card, 'Swamp', 1, 1)]);

// =============================================================================
// GRAVEYARD ABILITIES
// =============================================================================

// Necrosavant
// "{3}{B}{B}, Sacrifice a creature: Return Necrosavant from your graveyard to the battlefield.
//  Activate only during your upkeep."
// Note: This is a graveyard ability, registered separately
import { registerGraveyardAbility } from '../../registry';
import { CardLoader } from '../../../../cards/CardLoader';
import { isCreature } from '../../../../cards/CardTemplate';

registerGraveyardAbility('Necrosavant', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_necrosavant_return`,
    name: '{3}{B}{B}, Sacrifice creature: Return to battlefield',
    cost: { mana: '{3}{B}{B}', sacrifice: { type: 'creature' } },
    effect: {
      type: 'CUSTOM',
      custom: (state: GameState) => {
        const player = state.players[card.controller];

        // Find Necrosavant in graveyard
        const necroIndex = player.graveyard.findIndex((c) => c.instanceId === card.instanceId);
        if (necroIndex === -1) return;

        // Find and sacrifice a creature
        const creatureIndex = player.battlefield.findIndex((c) => {
          const t = CardLoader.getById(c.scryfallId);
          return t && isCreature(t);
        });
        if (creatureIndex !== -1) {
          const creature = player.battlefield.splice(creatureIndex, 1)[0]!;
          creature.zone = 'graveyard';
          creature.damage = 0;
          creature.tapped = false;
          player.graveyard.push(creature);
        }

        // Move Necrosavant to battlefield
        const necro = player.graveyard.splice(necroIndex, 1)[0]!;
        necro.zone = 'battlefield';
        necro.damage = 0;
        necro.tapped = false;
        necro.summoningSick = true;
        player.battlefield.push(necro);
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      // Must be owner's upkeep
      if (state.activePlayer !== controller) return false;
      if (state.phase !== 'beginning' || state.step !== 'upkeep') return false;

      const player = state.players[controller];

      // Check source exists in graveyard
      const inGraveyard = player.graveyard.some((c) => c.instanceId === sourceId);
      if (!inGraveyard) return false;

      // Check mana: need 3 colorless + 2 black
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      if (totalMana < 5) return false;
      if (countAvailableMana(state, controller, 'B') < 2) return false;

      // Check for a creature to sacrifice
      const hasCreature = player.battlefield.some((c) => {
        const t = CardLoader.getById(c.scryfallId);
        return t && isCreature(t);
      });

      return hasCreature;
    },
  };
  return [ability];
});

// =============================================================================
// EXPORT COUNT
// =============================================================================

export const SACRIFICE_COUNT = 8; // 7 + Necrosavant (graveyard ability)
