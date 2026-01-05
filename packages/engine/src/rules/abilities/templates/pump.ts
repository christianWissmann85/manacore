/**
 * Pump Ability Templates
 *
 * Factory functions for creating power/toughness modifying abilities.
 * These cover common patterns:
 * - Firebreathing ({R}: +1/+0)
 * - Shade abilities ({B}: +1/+1)
 * - Generic pump self
 * - Pump other creatures
 */

import type { GameState } from '../../../state/GameState';
import type { PlayerId } from '../../../state/Zone';
import type { CardInstance } from '../../../state/CardInstance';
import type { TargetRequirement } from '../../targeting';
import type { ActivatedAbility, ManaColor } from '../types';
import { sourceExistsCheck, countAvailableMana, standardTapCheck } from './common';

// =============================================================================
// PUMP SELF
// =============================================================================

/**
 * Create a pump-self ability
 *
 * Used for: Frozen Shade, Shivan Dragon, firebreathing creatures, etc.
 *
 * @param card The card instance
 * @param power Power boost
 * @param toughness Toughness boost
 * @param manaCost Mana cost to activate
 * @param options Additional configuration
 *
 * @example
 * // Firebreathing: {R}: +1/+0 until end of turn
 * createPumpSelf(card, 1, 0, '{R}')
 *
 * @example
 * // Shade ability: {B}: +1/+1 until end of turn
 * createPumpSelf(card, 1, 1, '{B}')
 */
export function createPumpSelf(
  card: CardInstance,
  power: number,
  toughness: number,
  manaCost: string,
  options: {
    /** Custom display name */
    name?: string;
    /** Unique ID suffix (for cards with multiple pump abilities) */
    idSuffix?: string;
  } = {},
): ActivatedAbility {
  const { name, idSuffix = '' } = options;

  // Build display string
  const boostStr = `+${power}/+${toughness}`;

  return {
    id: `${card.instanceId}_pump_self${idSuffix}`,
    name: name || `${manaCost}: ${boostStr} until end of turn`,
    cost: {
      mana: manaCost,
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

      // During declare_blockers step, disallow pump abilities to prevent infinite loops
      // (In reality they should be allowed, but bots spam them infinitely)
      if (state.step === 'declare_blockers') {
        return false;
      }

      // Check mana availability
      const colorMatches = manaCost.matchAll(/\{([WUBRGC])\}/g);
      for (const match of colorMatches) {
        const color = match[1] as ManaColor;
        if (countAvailableMana(state, controller, color) < 1) {
          return false;
        }
      }

      return true;
    },
  };
}

/**
 * Create a Firebreathing ability ({R}: +1/+0)
 */
export function createFirebreathing(card: CardInstance): ActivatedAbility {
  return createPumpSelf(card, 1, 0, '{R}', {
    name: '{R}: +1/+0 until end of turn',
  });
}

/**
 * Create a Shade ability ({B}: +1/+1)
 */
export function createShadeAbility(card: CardInstance): ActivatedAbility {
  return createPumpSelf(card, 1, 1, '{B}', {
    name: '{B}: +1/+1 until end of turn',
  });
}

// =============================================================================
// PUMP OTHER
// =============================================================================

/**
 * Create a tap-to-buff-other-creature ability
 *
 * Used for: Infantry Veteran, Wyluli Wolf, etc.
 *
 * @param card The card instance
 * @param power Power boost
 * @param toughness Toughness boost
 * @param options Additional configuration
 *
 * @example
 * // Infantry Veteran: {T}: Target attacking creature gets +1/+1 until EOT
 * createTapToBuffOther(card, 1, 1, { targetRestriction: 'attacking' })
 */
export function createTapToBuffOther(
  card: CardInstance,
  power: number,
  toughness: number,
  options: {
    /** Mana cost in addition to tap */
    manaCost?: string;
    /** Target restriction */
    targetRestriction?: 'attacking' | 'blocking' | 'creature';
    /** Custom display name */
    name?: string;
  } = {},
): ActivatedAbility {
  const { manaCost, targetRestriction = 'creature', name } = options;

  // Build cost string
  const costParts: string[] = [];
  if (manaCost) costParts.push(manaCost);
  costParts.push('{T}');
  const costStr = costParts.join(', ');

  // Build target description
  const targetDesc =
    targetRestriction === 'attacking'
      ? 'target attacking creature'
      : targetRestriction === 'blocking'
        ? 'target blocking creature'
        : 'target creature';

  const boostStr = `+${power}/+${toughness}`;

  // Build target restrictions
  const restrictions: TargetRequirement['restrictions'] = [];
  if (targetRestriction === 'attacking') {
    restrictions.push({ type: 'combat', status: 'attacking' });
  } else if (targetRestriction === 'blocking') {
    restrictions.push({ type: 'combat', status: 'blocking' });
  }

  return {
    id: `${card.instanceId}_tap_buff`,
    name: name || `${costStr}: ${targetDesc} gets ${boostStr} until end of turn`,
    cost: {
      tap: true,
      ...(manaCost && { mana: manaCost }),
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
        restrictions,
        optional: false,
        description: targetDesc,
      },
    ],
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) {
        return false;
      }

      if (manaCost) {
        const colorMatches = manaCost.matchAll(/\{([WUBRGC])\}/g);
        for (const match of colorMatches) {
          const color = match[1] as ManaColor;
          if (countAvailableMana(state, controller, color) < 1) {
            return false;
          }
        }
      }

      return true;
    },
  };
}

/**
 * Create a tap-to-debuff ability
 *
 * Used for: Pradesh Gypsies, etc.
 *
 * @param card The card instance
 * @param power Power reduction
 * @param toughness Toughness reduction
 * @param manaCost Mana cost
 */
export function createTapToDebuff(
  card: CardInstance,
  power: number,
  toughness: number,
  manaCost: string,
): ActivatedAbility {
  // Build cost string
  const costStr = `${manaCost}, {T}`;
  const boostStr = `-${power}/-${toughness}`;

  return {
    id: `${card.instanceId}_tap_debuff`,
    name: `${costStr}: Target creature gets ${boostStr} until end of turn`,
    cost: {
      tap: true,
      mana: manaCost,
    },
    effect: {
      type: 'PUMP',
      powerChange: -power,
      toughnessChange: -toughness,
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

      const colorMatches = manaCost.matchAll(/\{([WUBRGC])\}/g);
      for (const match of colorMatches) {
        const color = match[1] as ManaColor;
        if (countAvailableMana(state, controller, color) < 1) {
          return false;
        }
      }

      return true;
    },
  };
}
