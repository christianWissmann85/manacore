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
import { sourceExistsCheck, standardTapCheck } from '../../templates';
import type { ActivatedAbility } from '../../types';
import type { GameState } from '../../../../state/GameState';
import type { PlayerId } from '../../../../state/Zone';

// =============================================================================
// SACRIFICE CREATURE FOR PUMP
// =============================================================================

// Fallen Angel
// "Sacrifice a creature: Fallen Angel gets +2/+1 until end of turn."
registerAbilities('Fallen Angel', (card) => [createSacrificeForPump(card, 2, 1)]);

// =============================================================================
// SACRIFICE CREATURE FOR DAMAGE
// =============================================================================

// Skull Catapult
// "{1}, {T}, Sacrifice a creature: Skull Catapult deals 2 damage to any target."
registerAbilities('Skull Catapult', (card) => [
  createSacrificeCreatureForDamage(card, 2, {
    manaCost: '{1}',
    requireTap: true,
    name: '{1}, Tap, Sacrifice creature: 2 damage',
  }),
]);

// =============================================================================
// SACRIFICE CREATURE FOR DRAW
// =============================================================================

// Phyrexian Vault
// "{2}, {T}, Sacrifice a creature: Draw a card."
registerAbilities('Phyrexian Vault', (card) => [
  createSacrificeCreatureForDraw(card, 1, {
    manaCost: '{2}',
    requireTap: true,
    name: '{2}, Tap, Sacrifice creature: Draw',
  }),
]);

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
// EXPORT COUNT
// =============================================================================

export const SACRIFICE_COUNT = 9;
