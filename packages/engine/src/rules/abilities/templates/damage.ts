/**
 * Damage Ability Templates
 *
 * Factory functions for creating damage-dealing abilities.
 * These cover common patterns:
 * - Tap to deal damage (Prodigal Sorcerer "Tim")
 * - Tap + mana to deal damage (Anaba Shaman)
 * - Tap to deal variable damage (Heavy Ballista)
 */

import type { GameState } from '../../../state/GameState';
import type { PlayerId } from '../../../state/Zone';
import type { CardInstance } from '../../../state/CardInstance';
import type { TargetRequirement } from '../../targeting';
import type { ActivatedAbility, ManaColor } from '../types';
import { standardTapCheck, countAvailableMana } from './common';

// =============================================================================
// TAP FOR DAMAGE (PINGERS)
// =============================================================================

/**
 * Create a tap-to-deal-damage ability ("pinger")
 *
 * Used for: Prodigal Sorcerer, Anaba Shaman, Suq'Ata Firewalker, etc.
 *
 * @param card The card instance
 * @param damage Amount of damage to deal
 * @param options Additional configuration
 *
 * @example
 * // Prodigal Sorcerer: {T}: Deal 1 damage to any target
 * createTapForDamage(card, 1)
 *
 * @example
 * // Anaba Shaman: {R}, {T}: Deal 1 damage to any target
 * createTapForDamage(card, 1, { manaCost: '{R}' })
 *
 * @example
 * // Suq'Ata Firewalker: {T}: Deal 1 damage to any target. Can't target white creatures.
 * createTapForDamage(card, 1, {
 *   targetRestrictions: [{ type: 'color', color: 'white', negate: true }]
 * })
 */
export function createTapForDamage(
  card: CardInstance,
  damage: number,
  options: {
    /** Mana cost in addition to tap (e.g., '{R}') */
    manaCost?: string;
    /** Target type: 'any' (creature or player), 'creature', or 'player' */
    targetType?: 'any' | 'creature' | 'player';
    /** Additional target restrictions */
    targetRestrictions?: TargetRequirement['restrictions'];
    /** Custom display name */
    name?: string;
  } = {},
): ActivatedAbility {
  const { manaCost, targetType = 'any', targetRestrictions = [], name } = options;

  // Build cost string for display
  const costParts: string[] = [];
  if (manaCost) costParts.push(manaCost);
  costParts.push('{T}');
  const costStr = costParts.join(', ');

  // Build target description
  const targetDesc =
    targetType === 'any'
      ? 'any target'
      : targetType === 'creature'
        ? 'target creature'
        : 'target player';

  return {
    id: `${card.instanceId}_tap_damage`,
    name: name || `${costStr}: Deal ${damage} damage to ${targetDesc}`,
    cost: {
      tap: true,
      ...(manaCost && { mana: manaCost }),
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
        restrictions: targetRestrictions,
        optional: false,
        description: targetDesc,
      },
    ],
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      // Standard tap check (untapped, no summoning sickness)
      if (!standardTapCheck(state, sourceId, controller)) {
        return false;
      }

      // Check mana if required
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
 * Create a Prodigal Sorcerer style ability (classic "Tim")
 * {T}: Deal 1 damage to any target
 */
export function createTimAbility(card: CardInstance): ActivatedAbility {
  return createTapForDamage(card, 1, {
    name: '{T}: Deal 1 damage to any target',
  });
}

/**
 * Create an Anaba Shaman style ability (paid Tim)
 * {R}, {T}: Deal 1 damage to any target
 *
 * @param card The card instance
 * @param damage Amount of damage
 * @param manaCost Mana cost string
 */
export function createPaidTimAbility(
  card: CardInstance,
  damage: number,
  manaCost: string,
): ActivatedAbility {
  return createTapForDamage(card, damage, { manaCost });
}

/**
 * Create a Heavy Ballista style ability (tap + X mana for X damage)
 *
 * @param card The card instance
 * @param manaCost Mana per damage (e.g., '{1}' for 1 colorless per damage)
 */
export function createScalableDamageAbility(
  card: CardInstance,
  manaCost: string,
): ActivatedAbility {
  return {
    id: `${card.instanceId}_tap_damage`,
    name: `{X}${manaCost}, {T}: Deal X damage to target creature`,
    cost: {
      tap: true,
      mana: '{X}', // X will be determined at activation
    },
    effect: {
      type: 'DAMAGE',
      // Amount is variable, determined by X
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
}

// =============================================================================
// DAMAGE TO SELF (DRAWBACK ABILITIES)
// =============================================================================

/**
 * Create a damage ability that also damages the controller
 *
 * Used for: Orcish Artillery
 *
 * @param card The card instance
 * @param targetDamage Damage to target
 * @param selfDamage Damage to controller
 */
export function createDamageWithSelfDamage(
  card: CardInstance,
  targetDamage: number,
  selfDamage: number,
  options: {
    manaCost?: string;
    name?: string;
  } = {},
): ActivatedAbility {
  const { manaCost, name } = options;

  return {
    id: `${card.instanceId}_tap_damage`,
    name:
      name || `{T}: Deal ${targetDamage} damage to any target. Deals ${selfDamage} damage to you.`,
    cost: {
      tap: true,
      ...(manaCost && { mana: manaCost }),
    },
    effect: {
      type: 'DAMAGE',
      amount: targetDamage,
      // Note: self-damage is handled by the effect resolver
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
