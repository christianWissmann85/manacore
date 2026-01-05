/**
 * 6th Edition - Artifact Abilities
 *
 * Phase 1.5.6: Full artifact implementation
 *
 * Categories:
 * 1. Mana Rocks (Diamonds + Mana Prism) - 6 cards
 * 2. Simple Tap Abilities - damage, draw, life gain
 * 3. Sacrifice-Based Abilities - sac outlets
 * 4. Token Generation - The Hive, Snake Basket
 *
 * Deferred to Phase 1.6:
 * - Static effects (Howling Mine, Meekstone, Cursed Totem)
 * - Triggered abilities (Ankh of Mishra, color charms)
 * - Complex mechanics (Amber Prison, Grinning Totem)
 */

import { registerAbilities } from '../../registry';
import { standardTapCheck, countAvailableMana, hasSacrificeable } from '../../templates';
import type { ActivatedAbility, ManaColor } from '../../types';
import type { GameState } from '../../../../state/GameState';
import type { PlayerId } from '../../../../state/Zone';
import { CardLoader } from '../../../../cards/CardLoader';
import { isCreature } from '../../../../cards/CardTemplate';
import {
  drawCards,
  discardCards,
  gainLife,
  applyDamage,
} from '../../../effects';
import { createTokens } from '../../../tokens';

// =============================================================================
// HELPER: Create Diamond Mana Rock
// =============================================================================

/**
 * Create a diamond mana ability (simple tap for colored mana)
 * Note: Enters-tapped is handled in the reducer when the artifact ETBs
 */
function createDiamondAbility(card: { instanceId: string }, color: ManaColor): ActivatedAbility {
  return {
    id: `${card.instanceId}_tap_mana`,
    name: `Tap: Add {${color}}`,
    cost: { tap: true },
    effect: {
      type: 'ADD_MANA',
      amount: 1,
      manaColors: [color],
    },
    isManaAbility: true,
    canActivate: standardTapCheck,
  };
}

// =============================================================================
// DIAMONDS (Colored Mana Rocks)
// =============================================================================

// Charcoal Diamond
// "Charcoal Diamond enters the battlefield tapped."
// "{T}: Add {B}."
registerAbilities('Charcoal Diamond', (card) => [createDiamondAbility(card, 'B')]);

// Fire Diamond
// "Fire Diamond enters the battlefield tapped."
// "{T}: Add {R}."
registerAbilities('Fire Diamond', (card) => [createDiamondAbility(card, 'R')]);

// Marble Diamond
// "Marble Diamond enters the battlefield tapped."
// "{T}: Add {W}."
registerAbilities('Marble Diamond', (card) => [createDiamondAbility(card, 'W')]);

// Moss Diamond
// "Moss Diamond enters the battlefield tapped."
// "{T}: Add {G}."
registerAbilities('Moss Diamond', (card) => [createDiamondAbility(card, 'G')]);

// Sky Diamond
// "Sky Diamond enters the battlefield tapped."
// "{T}: Add {U}."
registerAbilities('Sky Diamond', (card) => [createDiamondAbility(card, 'U')]);

// =============================================================================
// MANA PRISM
// =============================================================================

// Mana Prism
// "{T}: Add {C}."
// "{1}, {T}: Add one mana of any color."
registerAbilities('Mana Prism', (card) => {
  const colorlessAbility: ActivatedAbility = {
    id: `${card.instanceId}_tap_colorless`,
    name: 'Tap: Add {C}',
    cost: { tap: true },
    effect: {
      type: 'ADD_MANA',
      amount: 1,
      manaColors: ['C'],
    },
    isManaAbility: true,
    canActivate: standardTapCheck,
  };

  const anyColorAbility: ActivatedAbility = {
    id: `${card.instanceId}_tap_any`,
    name: '{1}, Tap: Add one mana of any color',
    cost: { tap: true, mana: '{1}' },
    effect: {
      type: 'ADD_MANA',
      amount: 1,
      manaColors: ['W', 'U', 'B', 'R', 'G'],
    },
    isManaAbility: true,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      // Must be untapped
      if (!standardTapCheck(state, sourceId, controller)) return false;

      // Must have 1 mana available
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

  return [colorlessAbility, anyColorAbility];
});

// =============================================================================
// SIMPLE TAP ABILITIES - DAMAGE
// =============================================================================

// Rod of Ruin
// "{3}, {T}: Rod of Ruin deals 1 damage to any target."
registerAbilities('Rod of Ruin', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tap_damage`,
    name: '{3}, Tap: 1 damage to any target',
    cost: { tap: true, mana: '{3}' },
    effect: {
      type: 'DEAL_DAMAGE',
      amount: 1,
      requiresTarget: true,
    },
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 3;
    },
    resolve: (state: GameState, sourceId: string, controller: PlayerId, targets?: string[]) => {
      const target = targets?.[0];
      if (target) {
        applyDamage(state, target, 1);
      }
    },
  };
  return [ability];
});

// Aladdin's Ring
// "{8}, {T}: Aladdin's Ring deals 4 damage to any target."
registerAbilities("Aladdin's Ring", (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tap_damage`,
    name: '{8}, Tap: 4 damage to any target',
    cost: { tap: true, mana: '{8}' },
    effect: {
      type: 'DEAL_DAMAGE',
      amount: 4,
      requiresTarget: true,
    },
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 8;
    },
    resolve: (state: GameState, sourceId: string, controller: PlayerId, targets?: string[]) => {
      const target = targets?.[0];
      if (target) {
        applyDamage(state, target, 4);
      }
    },
  };
  return [ability];
});

// =============================================================================
// SIMPLE TAP ABILITIES - CARD DRAW
// =============================================================================

// Jayemdae Tome
// "{4}, {T}: Draw a card."
registerAbilities('Jayemdae Tome', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tap_draw`,
    name: '{4}, Tap: Draw a card',
    cost: { tap: true, mana: '{4}' },
    effect: {
      type: 'DRAW_CARDS',
      count: 1,
    },
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 4;
    },
    resolve: (state: GameState, _sourceId: string, controller: PlayerId) => {
      drawCards(state, controller, 1);
    },
  };
  return [ability];
});

// Jalum Tome
// "{2}, {T}: Draw a card, then discard a card."
registerAbilities('Jalum Tome', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tap_loot`,
    name: '{2}, Tap: Draw a card, then discard a card',
    cost: { tap: true, mana: '{2}' },
    effect: {
      type: 'DRAW_DISCARD',
      draw: 1,
      discard: 1,
    },
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 2;
    },
    resolve: (state: GameState, _sourceId: string, controller: PlayerId) => {
      drawCards(state, controller, 1);
      discardCards(state, controller, 1);
    },
  };
  return [ability];
});

// =============================================================================
// SIMPLE TAP ABILITIES - LIFE GAIN
// =============================================================================

// Fountain of Youth
// "{2}, {T}: You gain 1 life."
registerAbilities('Fountain of Youth', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tap_life`,
    name: '{2}, Tap: Gain 1 life',
    cost: { tap: true, mana: '{2}' },
    effect: {
      type: 'GAIN_LIFE',
      amount: 1,
    },
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 2;
    },
    resolve: (state: GameState, _sourceId: string, controller: PlayerId) => {
      gainLife(state, controller, 1);
    },
  };
  return [ability];
});

// =============================================================================
// SIMPLE TAP ABILITIES - MILL
// =============================================================================

// Millstone
// "{2}, {T}: Target player mills two cards."
registerAbilities('Millstone', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tap_mill`,
    name: '{2}, Tap: Target player mills 2 cards',
    cost: { tap: true, mana: '{2}' },
    effect: {
      type: 'MILL',
      count: 2,
      requiresTarget: true,
    },
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 2;
    },
    resolve: (state: GameState, _sourceId: string, _controller: PlayerId, targets?: string[]) => {
      const targetPlayer = (targets?.[0] as PlayerId) || 'opponent';
      const player = state.players[targetPlayer];
      // Mill 2 cards (move from library to graveyard)
      for (let i = 0; i < 2 && player.library.length > 0; i++) {
        const card = player.library.pop()!;
        card.zone = 'graveyard';
        player.graveyard.push(card);
      }
    },
  };
  return [ability];
});

// =============================================================================
// SIMPLE TAP ABILITIES - DISCARD
// =============================================================================

// Disrupting Scepter
// "{3}, {T}: Target player discards a card. Activate only during your turn."
registerAbilities('Disrupting Scepter', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tap_discard`,
    name: '{3}, Tap: Target player discards a card',
    cost: { tap: true, mana: '{3}' },
    effect: {
      type: 'DISCARD',
      count: 1,
      requiresTarget: true,
    },
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      // Must be your turn
      if (state.activePlayer !== controller) return false;
      if (!standardTapCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 3;
    },
    resolve: (state: GameState, _sourceId: string, _controller: PlayerId, targets?: string[]) => {
      const targetPlayer = (targets?.[0] as PlayerId) || 'opponent';
      discardCards(state, targetPlayer, 1);
    },
  };
  return [ability];
});

// =============================================================================
// TOKEN GENERATION
// =============================================================================

// The Hive
// "{5}, {T}: Create a 1/1 colorless Insect artifact creature token with flying named Wasp."
registerAbilities('The Hive', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tap_token`,
    name: '{5}, Tap: Create a 1/1 Wasp token with flying',
    cost: { tap: true, mana: '{5}' },
    effect: {
      type: 'CREATE_TOKEN',
      tokenType: 'Wasp',
    },
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 5;
    },
    resolve: (state: GameState, sourceId: string, controller: PlayerId) => {
      createTokens(state, controller, 'Wasp', 1, sourceId);
    },
  };
  return [ability];
});

// =============================================================================
// SACRIFICE-BASED ABILITIES
// =============================================================================

// Ashnod's Altar
// "Sacrifice a creature: Add {C}{C}."
registerAbilities("Ashnod's Altar", (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_sac_mana`,
    name: 'Sacrifice a creature: Add {C}{C}',
    cost: { sacrifice: 'creature' },
    effect: {
      type: 'ADD_MANA',
      amount: 2,
      manaColors: ['C', 'C'],
    },
    isManaAbility: true,
    canActivate: (state: GameState, _sourceId: string, controller: PlayerId) => {
      return hasSacrificeable(state, controller, 'creature');
    },
  };
  return [ability];
});

// Skull Catapult
// "{1}, {T}, Sacrifice a creature: Skull Catapult deals 2 damage to any target."
registerAbilities('Skull Catapult', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_sac_damage`,
    name: '{1}, Tap, Sacrifice a creature: 2 damage to any target',
    cost: { tap: true, mana: '{1}', sacrifice: 'creature' },
    effect: {
      type: 'DEAL_DAMAGE',
      amount: 2,
      requiresTarget: true,
    },
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) return false;
      if (!hasSacrificeable(state, controller, 'creature')) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 1;
    },
    resolve: (state: GameState, _sourceId: string, _controller: PlayerId, targets?: string[]) => {
      const target = targets?.[0];
      if (target) {
        applyDamage(state, target, 2);
      }
    },
  };
  return [ability];
});

// Phyrexian Vault
// "{2}, {T}, Sacrifice a creature: Draw a card."
registerAbilities('Phyrexian Vault', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_sac_draw`,
    name: '{2}, Tap, Sacrifice a creature: Draw a card',
    cost: { tap: true, mana: '{2}', sacrifice: 'creature' },
    effect: {
      type: 'DRAW_CARDS',
      count: 1,
    },
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) return false;
      if (!hasSacrificeable(state, controller, 'creature')) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 2;
    },
    resolve: (state: GameState, _sourceId: string, controller: PlayerId) => {
      drawCards(state, controller, 1);
    },
  };
  return [ability];
});

// =============================================================================
// GRANT ABILITY ARTIFACTS
// =============================================================================

// Flying Carpet
// "{2}, {T}: Target creature gains flying until end of turn."
registerAbilities('Flying Carpet', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tap_flying`,
    name: '{2}, Tap: Target creature gains flying until EOT',
    cost: { tap: true, mana: '{2}' },
    effect: {
      type: 'GRANT_KEYWORD',
      keyword: 'Flying',
      duration: 'end_of_turn',
      requiresTarget: true,
    },
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 2;
    },
    resolve: (state: GameState, _sourceId: string, _controller: PlayerId, targets?: string[]) => {
      const target = targets?.[0];
      if (!target) return;

      // Find the creature and grant it flying
      for (const playerId of ['player', 'opponent'] as const) {
        const creature = state.players[playerId].battlefield.find(
          (c) => c.instanceId === target
        );
        if (creature) {
          // Add temporary flying keyword
          if (!creature.temporaryKeywords) {
            creature.temporaryKeywords = [];
          }
          creature.temporaryKeywords.push({
            keyword: 'Flying',
            until: 'end_of_turn',
          });
          break;
        }
      }
    },
  };
  return [ability];
});

// =============================================================================
// PREVENTION ARTIFACTS
// =============================================================================

// Pentagram of the Ages
// "{4}, {T}: The next time a source of your choice would deal damage to you this turn, prevent that damage."
registerAbilities('Pentagram of the Ages', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_tap_prevent`,
    name: '{4}, Tap: Prevent next damage to you',
    cost: { tap: true, mana: '{4}' },
    effect: {
      type: 'PREVENT_DAMAGE',
      amount: 'next',
      target: 'controller',
    },
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) return false;
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 4;
    },
    resolve: (state: GameState, _sourceId: string, controller: PlayerId) => {
      // Set a prevention shield on the player
      if (!state.players[controller].preventionShields) {
        state.players[controller].preventionShields = [];
      }
      state.players[controller].preventionShields.push({
        type: 'next_damage',
        until: 'end_of_turn',
      });
    },
  };
  return [ability];
});

// =============================================================================
// X-COST TOKEN GENERATION
// =============================================================================

// Snake Basket
// "{X}, Sacrifice Snake Basket: Create X 1/1 green Snake creature tokens. X can't be 0."
registerAbilities('Snake Basket', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_sac_tokens`,
    name: '{X}, Sacrifice: Create X 1/1 Snake tokens',
    cost: { mana: '{X}', sacrifice: 'self' },
    effect: {
      type: 'CREATE_TOKEN',
      tokenType: 'Snake',
      countFromX: true,
    },
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      // Find the source on the battlefield
      const player = state.players[controller];
      const source = player.battlefield.find((p) => p.instanceId === sourceId);
      if (!source) return false;

      // Need at least 1 mana for X (X can't be 0)
      const totalMana =
        countAvailableMana(state, controller, 'W') +
        countAvailableMana(state, controller, 'U') +
        countAvailableMana(state, controller, 'B') +
        countAvailableMana(state, controller, 'R') +
        countAvailableMana(state, controller, 'G') +
        countAvailableMana(state, controller, 'C');
      return totalMana >= 1;
    },
    resolve: (state: GameState, sourceId: string, controller: PlayerId, _targets?: string[], xValue?: number) => {
      // X can't be 0
      const x = xValue || 1;
      if (x > 0) {
        createTokens(state, controller, 'Snake', x, sourceId);
      }
    },
  };
  return [ability];
});

// =============================================================================
// SIMPLE TAP ABILITIES - INFORMATION
// =============================================================================

// Glasses of Urza
// "{T}: Look at target player's hand."
// Note: In AI simulation, this is informational only (AI has perfect information)
registerAbilities('Glasses of Urza', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_glasses_look`,
    name: '{T}: Look at hand',
    cost: { tap: true },
    effect: {
      type: 'CUSTOM',
      custom: () => {
        // Effect is informational only - reveals target player's hand
        // In AI simulation mode, both players have full information
        // The effect is implemented by the UI layer if needed
      },
    },
    isManaAbility: false,
    canActivate: standardTapCheck,
  };
  return [ability];
});

// =============================================================================
// EXPORT COUNT
// =============================================================================

export const ARTIFACTS_COUNT = 20; // 6 mana rocks + 14 new artifacts
