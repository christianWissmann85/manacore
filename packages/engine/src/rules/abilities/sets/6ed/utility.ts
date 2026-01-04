/**
 * 6th Edition - Utility Abilities
 *
 * Miscellaneous activated abilities that don't fit other categories.
 * Includes damage prevention, counters, tapping/untapping, and complex abilities.
 */

import { registerAbilities } from '../../registry';
import { createTapToPrevent, createLifeToPrevent } from '../../templates';
import { standardTapCheck, sourceExistsCheck, countAvailableMana } from '../../templates';
import type { ActivatedAbility } from '../../types';
import type { GameState } from '../../../../state/GameState';
import type { PlayerId } from '../../../../state/Zone';
import { CardLoader } from '../../../../cards/CardLoader';

// =============================================================================
// DAMAGE PREVENTION
// =============================================================================

// Samite Healer
// "{T}: Prevent the next 1 damage that would be dealt to any target this turn."
registerAbilities('Samite Healer', (card) => [createTapToPrevent(card, 1)]);

// Ethereal Champion
// "Pay 1 life: Prevent the next 1 damage that would be dealt to Ethereal Champion this turn."
registerAbilities('Ethereal Champion', (card) => [createLifeToPrevent(card, 1, 1)]);

// =============================================================================
// TAP TO COUNTER (Color-specific)
// =============================================================================

// Order of the Sacred Torch
// "{T}, Pay 1 life: Counter target black spell."
registerAbilities('Order of the Sacred Torch', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_counter_black`,
    name: '{T}, Pay 1 life: Counter black spell',
    cost: { tap: true, life: 1 },
    effect: {
      type: 'CUSTOM',
      custom: (state: GameState) => {
        if (state.stack.length > 0) {
          const topSpell = state.stack[state.stack.length - 1];
          if (topSpell) {
            const template = CardLoader.getById(topSpell.card.scryfallId);
            if (template && template.colors?.includes('B')) {
              topSpell.countered = true;
            }
          }
        }
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) {
        return false;
      }
      const player = state.players[controller];
      if (player.life <= 1) return false;
      // Check for black spell on stack
      return state.stack.some((s) => {
        const t = CardLoader.getById(s.card.scryfallId);
        return t && t.colors?.includes('B');
      });
    },
  };
  return [ability];
});

// Stromgald Cabal
// "{T}, Pay 1 life: Counter target white spell."
registerAbilities('Stromgald Cabal', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_counter_white`,
    name: '{T}, Pay 1 life: Counter white spell',
    cost: { tap: true, life: 1 },
    effect: {
      type: 'CUSTOM',
      custom: (state: GameState) => {
        if (state.stack.length > 0) {
          const topSpell = state.stack[state.stack.length - 1];
          if (topSpell) {
            const template = CardLoader.getById(topSpell.card.scryfallId);
            if (template && template.colors?.includes('W')) {
              topSpell.countered = true;
            }
          }
        }
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) {
        return false;
      }
      const player = state.players[controller];
      if (player.life <= 1) return false;
      return state.stack.some((s) => {
        const t = CardLoader.getById(s.card.scryfallId);
        return t && t.colors?.includes('W');
      });
    },
  };
  return [ability];
});

// =============================================================================
// TAP/UNTAP CONTROL
// =============================================================================

// Elder Druid
// "{3}{G}, {T}: You may tap or untap target artifact, creature, or land."
registerAbilities('Elder Druid', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tap_control`,
    name: '{3}{G}, {T}: Tap/untap permanent',
    cost: { tap: true, mana: '{3}{G}' },
    effect: {
      type: 'CUSTOM',
      custom: () => {
        // Tap or untap effect via targeting
      },
    },
    isManaAbility: false,
    targetRequirements: [
      {
        id: 'target_0',
        count: 1,
        targetType: 'permanent',
        zone: 'battlefield',
        restrictions: [],
        optional: false,
        description: 'target artifact, creature, or land',
      },
    ],
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) {
        return false;
      }
      return countAvailableMana(state, controller, 'G') >= 1;
    },
  };
  return [ability];
});

// Fyndhorn Brownie
// "{2}{G}, {T}: Untap target creature."
registerAbilities('Fyndhorn Brownie', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tap_untap`,
    name: '{2}{G}, {T}: Untap creature',
    cost: { tap: true, mana: '{2}{G}' },
    effect: {
      type: 'CUSTOM',
      custom: () => {
        // Untap effect via targeting
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
      if (!standardTapCheck(state, sourceId, controller)) {
        return false;
      }
      return countAvailableMana(state, controller, 'G') >= 1;
    },
  };
  return [ability];
});

// =============================================================================
// KEYWORD REMOVAL
// =============================================================================

// Radjan Spirit
// "{T}: Target creature loses flying until end of turn."
registerAbilities('Radjan Spirit', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tap_remove_flying`,
    name: '{T}: Target loses flying',
    cost: { tap: true },
    effect: {
      type: 'CUSTOM',
      custom: () => {
        // Remove flying via targeting
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
    canActivate: standardTapCheck,
  };
  return [ability];
});

// =============================================================================
// COMPLEX ABILITIES (Custom implementations)
// =============================================================================

// Abyssal Hunter
// "{B}, {T}: Tap target creature. Abyssal Hunter deals damage equal to its power to that creature."
registerAbilities('Abyssal Hunter', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tap_damage`,
    name: '{B}, {T}: Tap creature + deal damage',
    cost: { tap: true, mana: '{B}' },
    effect: {
      type: 'CUSTOM',
      custom: () => {
        // Tap target and deal damage equal to power
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
      if (!standardTapCheck(state, sourceId, controller)) {
        return false;
      }
      return countAvailableMana(state, controller, 'B') >= 1;
    },
  };
  return [ability];
});

// Kjeldoran Royal Guard
// "{T}: All combat damage that would be dealt to you by unblocked creatures this turn
//  is dealt to Kjeldoran Royal Guard instead."
registerAbilities('Kjeldoran Royal Guard', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_redirect`,
    name: '{T}: Redirect unblocked damage to self',
    cost: { tap: true },
    effect: {
      type: 'CUSTOM',
      custom: () => {
        // Damage redirection effect
      },
    },
    isManaAbility: false,
    canActivate: standardTapCheck,
  };
  return [ability];
});

// Rag Man
// "{B}{B}{B}, {T}: Target opponent reveals their hand and discards a creature card at random.
//  Activate only during your turn."
registerAbilities('Rag Man', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_discard`,
    name: '{B}{B}{B}, {T}: Opponent discards creature',
    cost: { tap: true, mana: '{B}{B}{B}' },
    effect: {
      type: 'CUSTOM',
      custom: () => {
        // Random creature discard
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) {
        return false;
      }
      // Only during your turn
      if (state.activePlayer !== controller) {
        return false;
      }
      return countAvailableMana(state, controller, 'B') >= 3;
    },
  };
  return [ability];
});

// Soldevi Sage
// "{T}, Sacrifice two lands: Draw three cards, then discard one of them."
registerAbilities('Soldevi Sage', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_sac_draw`,
    name: '{T}, Sacrifice 2 lands: Draw 3, discard 1',
    cost: {
      tap: true,
      sacrifice: { type: 'land', count: 2 },
    },
    effect: {
      type: 'CUSTOM',
      custom: () => {
        // Draw 3, discard 1
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) {
        return false;
      }
      // Check for 2 lands to sacrifice
      const player = state.players[controller];
      const landCount = player.battlefield.filter((p) => {
        const t = CardLoader.getById(p.scryfallId);
        return t && t.type_line?.toLowerCase().includes('land');
      }).length;
      return landCount >= 2;
    },
  };
  return [ability];
});

// Ashnod's Altar (artifact)
// "Sacrifice a creature: Add {C}{C}."
registerAbilities("Ashnod's Altar", (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_sac_creature_mana`,
    name: 'Sacrifice creature: Add {C}{C}',
    cost: { sacrifice: { type: 'creature' } },
    effect: {
      type: 'ADD_MANA',
      amount: 2,
      manaColors: ['C'],
    },
    isManaAbility: true,
    canActivate: (state: GameState, _sourceId: string, controller: PlayerId) => {
      // Check if player has any creatures to sacrifice
      const player = state.players[controller];
      return player.battlefield.some((c) => {
        const t = CardLoader.getById(c.scryfallId);
        return t && t.type_line?.toLowerCase().includes('creature');
      });
    },
  };
  return [ability];
});

// =============================================================================
// EXPORT COUNT
// =============================================================================

export const UTILITY_COUNT = 12;
