/**
 * Combat Ability Templates
 *
 * Factory functions for combat-related abilities.
 * These cover common patterns:
 * - Regeneration ({B}: Regenerate)
 * - Damage prevention (Samite Healer)
 * - Life payment regeneration (Mischievous Poltergeist)
 */

import type { GameState } from '../../../state/GameState';
import type { PlayerId } from '../../../state/Zone';
import type { CardInstance } from '../../../state/CardInstance';
import type { TargetRequirement } from '../../targeting';
import type { ActivatedAbility, ManaColor } from '../types';
import {
  sourceExistsCheck,
  countAvailableMana,
  standardTapCheck,
  hasLandTypeToSacrifice,
  canPaySimpleMana,
} from './common';

// =============================================================================
// REGENERATION
// =============================================================================

/**
 * Create a regeneration ability
 *
 * Used for: Drudge Skeletons, River Boa, Gorilla Chieftain, etc.
 *
 * @param card The card instance
 * @param manaCost Mana cost to regenerate
 * @param options Additional configuration
 *
 * @example
 * // Drudge Skeletons: {B}: Regenerate
 * createRegenerate(card, '{B}')
 *
 * @example
 * // Gorilla Chieftain: {1}{G}: Regenerate
 * createRegenerate(card, '{1}{G}')
 */
export function createRegenerate(
  card: CardInstance,
  manaCost: string,
  options: {
    /** Custom display name */
    name?: string;
  } = {},
): ActivatedAbility {
  const { name } = options;

  return {
    id: `${card.instanceId}_regenerate`,
    name: name || `${manaCost}: Regenerate`,
    cost: {
      mana: manaCost,
    },
    effect: {
      type: 'REGENERATE',
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      // Check source exists
      if (!sourceExistsCheck(state, sourceId, controller)) {
        return false;
      }

      // During declare_blockers step, disallow regenerate to prevent infinite loops
      // (In reality it should be allowed, but bots spam it infinitely)
      if (state.step === 'declare_blockers') {
        return false;
      }

      // Check mana availability
      if (!canPaySimpleMana(state, controller, manaCost)) {
        return false;
      }

      return true;
    },
  };
}

/**
 * Create a regeneration ability that costs life instead of mana
 *
 * Used for: Mischievous Poltergeist, Will-o'-the-Wisp (originally)
 *
 * @param card The card instance
 * @param lifeCost Life to pay
 */
export function createLifeRegenerate(card: CardInstance, lifeCost: number): ActivatedAbility {
  return {
    id: `${card.instanceId}_regenerate`,
    name: `Pay ${lifeCost} life: Regenerate`,
    cost: {
      life: lifeCost,
    },
    effect: {
      type: 'REGENERATE',
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      // Check source exists
      if (!sourceExistsCheck(state, sourceId, controller)) {
        return false;
      }

      // Check life availability
      const player = state.players[controller];
      return player.life >= lifeCost;
    },
  };
}

/**
 * Create a regeneration ability with land sacrifice cost
 *
 * Used for: Uktabi Wildcats
 *
 * @param card The card instance
 * @param manaCost Mana cost
 * @param landType Land type to sacrifice
 */
export function createLandSacrificeRegenerate(
  card: CardInstance,
  manaCost: string,
  landType: 'Plains' | 'Island' | 'Swamp' | 'Mountain' | 'Forest',
): ActivatedAbility {
  return {
    id: `${card.instanceId}_regenerate`,
    name: `${manaCost}, Sacrifice a ${landType}: Regenerate`,
    cost: {
      mana: manaCost,
      sacrifice: {
        type: 'land',
        landType,
        restriction: { notSelf: true },
      },
    },
    effect: {
      type: 'REGENERATE',
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      // Check source exists
      if (!sourceExistsCheck(state, sourceId, controller)) {
        return false;
      }

      // Check mana availability
      if (!canPaySimpleMana(state, controller, manaCost)) {
        return false;
      }

      // Check for land to sacrifice
      if (!hasLandTypeToSacrifice(state, controller, landType)) {
        return false;
      }

      return true;
    },
  };
}

// =============================================================================
// DAMAGE PREVENTION
// =============================================================================

/**
 * Create a tap-to-prevent-damage ability
 *
 * Used for: Samite Healer, Master Healer, etc.
 *
 * @param card The card instance
 * @param amount Amount of damage to prevent
 * @param options Additional configuration
 *
 * @example
 * // Samite Healer: {T}: Prevent the next 1 damage to any target
 * createTapToPrevent(card, 1)
 */
export function createTapToPrevent(
  card: CardInstance,
  amount: number,
  options: {
    /** Mana cost in addition to tap */
    manaCost?: string;
    /** Target type */
    targetType?: 'any' | 'creature' | 'player';
    /** Custom display name */
    name?: string;
  } = {},
): ActivatedAbility {
  const { manaCost, targetType = 'any', name } = options;

  // Build cost string
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
    id: `${card.instanceId}_tap_prevent`,
    name: name || `${costStr}: Prevent the next ${amount} damage to ${targetDesc}`,
    cost: {
      tap: true,
      ...(manaCost && { mana: manaCost }),
    },
    effect: {
      type: 'PREVENT_DAMAGE',
      amount,
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
      if (!standardTapCheck(state, sourceId, controller)) {
        return false;
      }

      if (manaCost) {
        if (!canPaySimpleMana(state, controller, manaCost)) {
          return false;
        }
      }

      return true;
    },
  };
}

/**
 * Create a life-payment damage prevention ability (for self)
 *
 * Used for: Ethereal Champion
 *
 * @param card The card instance
 * @param lifeCost Life to pay
 * @param preventAmount Amount of damage to prevent
 */
export function createLifeToPrevent(
  card: CardInstance,
  lifeCost: number,
  preventAmount: number,
): ActivatedAbility {
  return {
    id: `${card.instanceId}_prevent`,
    name: `Pay ${lifeCost} life: Prevent the next ${preventAmount} damage to this creature`,
    cost: {
      life: lifeCost,
    },
    effect: {
      type: 'PREVENT_DAMAGE',
      amount: preventAmount,
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!sourceExistsCheck(state, sourceId, controller)) {
        return false;
      }

      const player = state.players[controller];
      // Need at least lifeCost + 1 life (can't pay all life)
      return player.life > lifeCost;
    },
  };
}

/**
 * Create a sacrifice-to-prevent ability
 *
 * Used for: Resistance Fighter
 *
 * @param card The card instance
 * @param preventType Type of damage to prevent
 */
export function createSacrificeToPrevent(
  card: CardInstance,
  preventType: 'all_combat' | 'all' = 'all_combat',
): ActivatedAbility {
  const desc =
    preventType === 'all_combat'
      ? 'Prevent all combat damage target creature would deal this turn'
      : 'Prevent all damage target creature would deal this turn';

  return {
    id: `${card.instanceId}_sac_prevent`,
    name: `Sacrifice: ${desc}`,
    cost: {
      sacrifice: { type: 'self' },
    },
    effect: {
      type: 'PREVENT_DAMAGE',
      // Full prevention handled by the effect resolver
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
    canActivate: sourceExistsCheck,
  };
}
