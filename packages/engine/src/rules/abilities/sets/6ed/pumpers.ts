/**
 * 6th Edition - Pump Creatures
 *
 * Creatures with power/toughness modifying abilities.
 * Includes pump-self, buff-others, and debuff abilities.
 */

import { registerAbilities, registerBulk } from '../../registry';
import {
  createPumpSelf,
  createFirebreathing,
  createTapToBuffOther,
  createTapToDebuff,
} from '../../templates';
import { sourceExistsCheck, countAvailableMana } from '../../templates';
import type { ActivatedAbility } from '../../types';
import type { GameState } from '../../../../state/GameState';
import type { PlayerId } from '../../../../state/Zone';

// =============================================================================
// FIREBREATHING ({R}: +1/+0)
// =============================================================================

// Flame Spirit, Wall of Fire
// "{R}: Gets +1/+0 until end of turn."
registerBulk(['Flame Spirit', 'Wall of Fire'], (card) => [createFirebreathing(card)]);

// =============================================================================
// GENERIC PUMP SELF
// =============================================================================

// Dragon Engine
// "{2}: Dragon Engine gets +1/+0 until end of turn."
registerAbilities('Dragon Engine', (card) => [createPumpSelf(card, 1, 0, '{2}')]);

// Pearl Dragon
// "{1}{W}: Pearl Dragon gets +0/+1 until end of turn."
registerAbilities('Pearl Dragon', (card) => [createPumpSelf(card, 0, 1, '{1}{W}')]);

// Mesa Falcon
// "{1}{W}: Mesa Falcon gets +0/+1 until end of turn."
registerAbilities('Mesa Falcon', (card) => [createPumpSelf(card, 0, 1, '{1}{W}')]);

// Spitting Drake
// "{R}: Spitting Drake gets +1/+0 until end of turn. Activate only once each turn."
registerAbilities('Spitting Drake', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_pump`,
    name: '{R}: +1/+0 (once per turn)',
    cost: { mana: '{R}' },
    effect: {
      type: 'PUMP',
      powerChange: 1,
      toughnessChange: 0,
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      const source = state.players[controller].battlefield.find((c) => c.instanceId === sourceId);
      if (!source) return false;

      // Check if already activated this turn
      const alreadyActivated = source.temporaryModifications.some(
        (m) => m.source === card.instanceId && m.expiresAt === 'end_of_turn',
      );
      if (alreadyActivated) return false;

      // Check mana
      return countAvailableMana(state, controller, 'R') >= 1;
    },
  };
  return [ability];
});

// =============================================================================
// TAP TO BUFF OTHER
// =============================================================================

// Infantry Veteran
// "{T}: Target attacking creature gets +1/+1 until end of turn."
registerAbilities('Infantry Veteran', (card) => [
  createTapToBuffOther(card, 1, 1, {
    targetRestriction: 'attacking',
    name: '{T}: Attacking creature +1/+1',
  }),
]);

// Wyluli Wolf
// "{T}: Target creature gets +1/+1 until end of turn."
registerAbilities('Wyluli Wolf', (card) => [
  createTapToBuffOther(card, 1, 1, {
    name: '{T}: Creature +1/+1',
  }),
]);

// =============================================================================
// TAP TO DEBUFF
// =============================================================================

// Pradesh Gypsies
// "{1}{G}, {T}: Target creature gets -2/-0 until end of turn."
registerAbilities('Pradesh Gypsies', (card) => [createTapToDebuff(card, 2, 0, '{1}{G}')]);

// =============================================================================
// GRANT KEYWORD (Special)
// =============================================================================

// Patagia Golem
// "{3}: Patagia Golem gains flying until end of turn."
registerAbilities('Patagia Golem', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_gain_flying`,
    name: '{3}: Gains flying',
    cost: { mana: '{3}' },
    effect: {
      type: 'CUSTOM',
      custom: () => {
        // Grants flying - handled by runtime keyword system
      },
    },
    isManaAbility: false,
    canActivate: sourceExistsCheck,
  };
  return [ability];
});

// Harmattan Efreet
// "{1}{U}{U}: Target creature gains flying until end of turn."
registerAbilities('Harmattan Efreet', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_grant_flying`,
    name: '{1}{U}{U}: Target gains flying',
    cost: { mana: '{1}{U}{U}' },
    effect: {
      type: 'CUSTOM',
      custom: () => {
        // Grants flying via targeting
      },
    },
    isManaAbility: false,
    targetRequirements: [
      {
        id: 'target_0',
        count: 1,
        targetType: 'creature',
        zone: 'battlefield',
        restrictions: [],
        optional: false,
        description: 'target creature',
      },
    ],
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!sourceExistsCheck(state, sourceId, controller)) {
        return false;
      }
      // Check mana: {1}{U}{U}
      return countAvailableMana(state, controller, 'U') >= 2;
    },
  };
  return [ability];
});

// =============================================================================
// EXPORT COUNT
// =============================================================================

export const PUMPERS_COUNT = 11;
