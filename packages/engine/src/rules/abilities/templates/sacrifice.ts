/**
 * Sacrifice Ability Templates
 *
 * Factory functions for sacrifice-based abilities.
 * These cover common patterns:
 * - Sacrifice creature for pump (Fallen Angel)
 * - Sacrifice creature for effect (Skull Catapult)
 * - Sacrifice self to destroy (Daraja Griffin)
 * - Sacrifice creature for mana (Ashnod's Altar)
 */

import type { GameState } from '../../../state/GameState';
import type { PlayerId } from '../../../state/Zone';
import type { CardInstance } from '../../../state/CardInstance';
import type { TargetRequirement } from '../../targeting';
import type { ActivatedAbility, ManaColor, SacrificeCost } from '../types';
import {
  sourceExistsCheck,
  standardTapCheck,
  countAvailableMana,
  hasSacrificeable,
  canPaySimpleMana,
} from './common';
import { CardLoader } from '../../../cards/CardLoader';

// =============================================================================
// SACRIFICE FOR PUMP
// =============================================================================

/**
 * Create a sacrifice-creature-for-pump ability
 *
 * Used for: Fallen Angel, Phyrexian Ghoul, etc.
 *
 * @param card The card instance
 * @param power Power boost per sacrifice
 * @param toughness Toughness boost per sacrifice
 * @param options Additional configuration
 *
 * @example
 * // Fallen Angel: Sacrifice a creature: +2/+1 until end of turn
 * createSacrificeForPump(card, 2, 1)
 */
export function createSacrificeForPump(
  card: CardInstance,
  power: number,
  toughness: number,
  options: {
    /** Custom display name */
    name?: string;
  } = {},
): ActivatedAbility {
  const { name } = options;
  const boostStr = `+${power}/+${toughness}`;

  return {
    id: `${card.instanceId}_sac_pump`,
    name: name || `Sacrifice creature: ${boostStr}`,
    cost: {
      sacrifice: {
        type: 'creature',
        restriction: { notSelf: true },
      },
    },
    effect: {
      type: 'PUMP',
      powerChange: power,
      toughnessChange: toughness,
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      // Check source exists
      if (!sourceExistsCheck(state, sourceId, controller)) {
        return false;
      }

      // Check if player has another creature to sacrifice
      const player = state.players[controller];
      const hasOtherCreature = player.battlefield.some((c) => {
        if (c.instanceId === sourceId) return false;
        const t = CardLoader.getById(c.scryfallId);
        return t && t.type_line?.toLowerCase().includes('creature');
      });

      return hasOtherCreature;
    },
  };
}

// =============================================================================
// SACRIFICE SELF FOR EFFECT
// =============================================================================

/**
 * Create a sacrifice-self-to-destroy ability
 *
 * Used for: Daraja Griffin, etc.
 *
 * @param card The card instance
 * @param targetRestriction Restriction on target (e.g., 'black', 'white')
 * @param options Additional configuration
 *
 * @example
 * // Daraja Griffin: Sacrifice: Destroy target black creature
 * createSacrificeToDestroy(card, { color: 'B' })
 */
export function createSacrificeToDestroy(
  card: CardInstance,
  targetRestriction: {
    color?: 'W' | 'U' | 'B' | 'R' | 'G';
    subtype?: string;
  },
  options: {
    /** Custom display name */
    name?: string;
  } = {},
): ActivatedAbility {
  const { name } = options;

  // Build restriction array
  const restrictions: TargetRequirement['restrictions'] = [];
  let targetDesc = 'target creature';

  if (targetRestriction.color) {
    const colorNames: Record<string, string> = {
      W: 'white',
      U: 'blue',
      B: 'black',
      R: 'red',
      G: 'green',
    };
    const colorName = colorNames[targetRestriction.color] || targetRestriction.color;
    restrictions.push({ type: 'color', color: targetRestriction.color, negated: false });
    targetDesc = `target ${colorName} creature`;
  }

  if (targetRestriction.subtype) {
    restrictions.push({ type: 'subtype', subtype: targetRestriction.subtype });
    targetDesc = `target ${targetRestriction.subtype}`;
  }

  return {
    id: `${card.instanceId}_sac_destroy`,
    name: name || `Sacrifice: Destroy ${targetDesc}`,
    cost: {
      sacrifice: { type: 'self' },
    },
    effect: {
      type: 'DESTROY',
    },
    isManaAbility: false,
    targetRequirements: [
      {
        id: 'target_0',
        count: 1,
        targetType: 'creature',
        zone: 'battlefield',
        restrictions,
        optional: false,
        description: targetDesc,
      },
    ],
    canActivate: sourceExistsCheck,
  };
}

/**
 * Create a tap + sacrifice self to counter spell ability
 *
 * Used for: Daring Apprentice
 *
 * @param card The card instance
 */
export function createSacrificeToCounter(
  card: CardInstance,
  options: {
    /** Whether tap is also required */
    requireTap?: boolean;
    /** Spell restriction (e.g., only counter colored spells) */
    spellRestriction?: 'colored' | 'instant' | 'sorcery' | 'creature';
    /** Custom display name */
    name?: string;
  } = {},
): ActivatedAbility {
  const { requireTap = true, spellRestriction, name } = options;

  const costStr = requireTap ? '{T}, Sacrifice' : 'Sacrifice';
  let targetDesc = 'target spell';

  if (spellRestriction) {
    targetDesc = `target ${spellRestriction} spell`;
  }

  return {
    id: `${card.instanceId}_sac_counter`,
    name: name || `${costStr}: Counter ${targetDesc}`,
    cost: {
      ...(requireTap && { tap: true }),
      sacrifice: { type: 'self' },
    },
    effect: {
      type: 'CUSTOM',
      // Counter effect handled by resolver
    },
    isManaAbility: false,
    targetRequirements: [
      {
        id: 'target_0',
        count: 1,
        targetType: 'spell' as 'creature', // Need to extend targetType
        zone: 'stack' as 'battlefield', // Stack zone
        restrictions: [],
        optional: false,
        description: targetDesc,
      },
    ],
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      // Check source exists
      if (!sourceExistsCheck(state, sourceId, controller)) {
        return false;
      }

      // Check tap if required
      if (requireTap) {
        const source = state.players[controller].battlefield.find((c) => c.instanceId === sourceId);
        if (!source || source.tapped || source.summoningSick) {
          return false;
        }
      }

      // Check if there's a spell on the stack to counter
      return state.stack.length > 0;
    },
  };
}

// =============================================================================
// SACRIFICE CREATURE FOR EFFECT
// =============================================================================

/**
 * Create a sacrifice-creature-for-damage ability
 *
 * Used for: Skull Catapult, etc.
 *
 * @param card The card instance
 * @param damage Amount of damage
 * @param options Additional configuration
 */
export function createSacrificeCreatureForDamage(
  card: CardInstance,
  damage: number,
  options: {
    /** Mana cost in addition to sacrifice */
    manaCost?: string;
    /** Whether tap is also required */
    requireTap?: boolean;
    /** Target type */
    targetType?: 'any' | 'creature' | 'player';
    /** Custom display name */
    name?: string;
  } = {},
): ActivatedAbility {
  const { manaCost, requireTap = false, targetType = 'any', name } = options;

  // Build cost string
  const costParts: string[] = [];
  if (manaCost) costParts.push(manaCost);
  if (requireTap) costParts.push('{T}');
  costParts.push('Sacrifice creature');
  const costStr = costParts.join(', ');

  // Build target description
  const targetDesc =
    targetType === 'any'
      ? 'any target'
      : targetType === 'creature'
        ? 'target creature'
        : 'target player';

  return {
    id: `${card.instanceId}_sac_damage`,
    name: name || `${costStr}: ${damage} damage to ${targetDesc}`,
    cost: {
      ...(requireTap && { tap: true }),
      ...(manaCost && { mana: manaCost }),
      sacrifice: { type: 'creature' },
    },
    effect: {
      type: 'DAMAGE',
      amount: damage,
    },
    isManaAbility: false,
    targetRequirements: [
      {
        id: 'target_0',
        count: 1,
        targetType,
        zone: 'battlefield',
        restrictions: [],
        optional: false,
        description: targetDesc,
      },
    ],
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      // Check tap if required
      if (requireTap) {
        if (!standardTapCheck(state, sourceId, controller)) {
          return false;
        }
      } else {
        if (!sourceExistsCheck(state, sourceId, controller)) {
          return false;
        }
      }

      // Check mana if required
      if (manaCost) {
        if (!canPaySimpleMana(state, controller, manaCost)) {
          return false;
        }
      }

      // Check if player has a creature to sacrifice
      return hasSacrificeable(state, controller, 'creature');
    },
  };
}

/**
 * Create a sacrifice-creature-for-draw ability
 *
 * Used for: Phyrexian Vault, etc.
 *
 * @param card The card instance
 * @param drawCount Number of cards to draw
 */
export function createSacrificeCreatureForDraw(
  card: CardInstance,
  drawCount: number = 1,
  options: {
    /** Mana cost in addition to sacrifice */
    manaCost?: string;
    /** Whether tap is also required */
    requireTap?: boolean;
    /** Custom display name */
    name?: string;
  } = {},
): ActivatedAbility {
  const { manaCost, requireTap = false, name } = options;

  // Build cost string
  const costParts: string[] = [];
  if (manaCost) costParts.push(manaCost);
  if (requireTap) costParts.push('{T}');
  costParts.push('Sacrifice creature');
  const costStr = costParts.join(', ');

  const drawStr = drawCount === 1 ? 'Draw a card' : `Draw ${drawCount} cards`;

  return {
    id: `${card.instanceId}_sac_draw`,
    name: name || `${costStr}: ${drawStr}`,
    cost: {
      ...(requireTap && { tap: true }),
      ...(manaCost && { mana: manaCost }),
      sacrifice: { type: 'creature' },
    },
    effect: {
      type: 'CUSTOM',
      // Draw effect handled by resolver
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (requireTap) {
        if (!standardTapCheck(state, sourceId, controller)) {
          return false;
        }
      } else {
        if (!sourceExistsCheck(state, sourceId, controller)) {
          return false;
        }
      }

      if (manaCost) {
        if (!canPaySimpleMana(state, controller, manaCost)) {
          return false;
        }
      }

      return hasSacrificeable(state, controller, 'creature');
    },
  };
}

// =============================================================================
// SACRIFICE LAND FOR EFFECT
// =============================================================================

/**
 * Create a sacrifice-land-for-buff ability
 *
 * Used for: Blighted Shaman
 *
 * @param card The card instance
 * @param landType Specific land type required
 * @param power Power boost
 * @param toughness Toughness boost
 */
export function createSacrificeLandForBuff(
  card: CardInstance,
  landType: 'Plains' | 'Island' | 'Swamp' | 'Mountain' | 'Forest',
  power: number,
  toughness: number,
  options: {
    /** Whether tap is also required */
    requireTap?: boolean;
    /** Custom display name */
    name?: string;
  } = {},
): ActivatedAbility {
  const { requireTap = true, name } = options;

  const costStr = requireTap ? `{T}, Sacrifice a ${landType}` : `Sacrifice a ${landType}`;
  const boostStr = `+${power}/+${toughness}`;

  return {
    id: `${card.instanceId}_sac_buff`,
    name: name || `${costStr}: Target creature gets ${boostStr} until end of turn`,
    cost: {
      ...(requireTap && { tap: true }),
      sacrifice: {
        type: 'land',
        landType,
      },
    },
    effect: {
      type: 'PUMP',
      powerChange: power,
      toughnessChange: toughness,
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
      if (requireTap) {
        if (!standardTapCheck(state, sourceId, controller)) {
          return false;
        }
      } else {
        if (!sourceExistsCheck(state, sourceId, controller)) {
          return false;
        }
      }

      // Check for specific land type
      const player = state.players[controller];
      const hasLand = player.battlefield.some((p) => {
        const t = CardLoader.getById(p.scryfallId);
        return t && t.name === landType;
      });

      return hasLand;
    },
  };
}
