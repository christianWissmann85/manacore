/**
 * Mana Ability Templates
 *
 * Factory functions for creating mana-producing abilities.
 * These cover the most common mana ability patterns:
 * - Tap for single color (Llanowar Elves)
 * - Tap for multiple colors (Birds of Paradise)
 * - Tap for multiple mana (Fyndhorn Elder)
 * - Sacrifice for mana (Blood Pet)
 */

import type { CardInstance } from '../../../state/CardInstance';
import type { ActivatedAbility, ManaColor } from '../types';
import { standardTapCheck, sourceExistsCheck, untappedCheck } from './common';

// =============================================================================
// TAP FOR MANA
// =============================================================================

/**
 * Create a tap-for-mana ability
 *
 * Used for: Llanowar Elves, Birds of Paradise, Fyndhorn Elder, etc.
 *
 * @param card The card instance
 * @param colors Array of mana colors that can be produced
 * @param options Additional configuration
 * @returns An activated mana ability
 *
 * @example
 * // Llanowar Elves: {T}: Add {G}
 * createTapForMana(card, ['G'])
 *
 * @example
 * // Birds of Paradise: {T}: Add one mana of any color
 * createTapForMana(card, ['W', 'U', 'B', 'R', 'G'], { name: 'Tap: Add one mana of any color' })
 *
 * @example
 * // Fyndhorn Elder: {T}: Add {G}{G}
 * createTapForMana(card, ['G'], { amount: 2 })
 */
export function createTapForMana(
  card: CardInstance,
  colors: ManaColor[],
  options: {
    /** Amount of mana to produce (default: 1) */
    amount?: number;
    /** Custom display name */
    name?: string;
  } = {},
): ActivatedAbility {
  const { amount = 1, name } = options;

  // Build display string
  const colorSymbols = colors.map((c) => `{${c}}`);
  let displayMana: string;

  if (colors.length === 5 && amount === 1) {
    // Birds of Paradise style
    displayMana = 'one mana of any color';
  } else if (amount > 1 && colors.length === 1 && colorSymbols[0]) {
    // Fyndhorn Elder style: {G}{G}
    displayMana = colorSymbols[0].repeat(amount);
  } else {
    displayMana = colorSymbols.join(' or ');
  }

  return {
    id: `${card.instanceId}_tap_mana`,
    name: name || `Tap: Add ${displayMana}`,
    cost: { tap: true },
    effect: {
      type: 'ADD_MANA',
      amount,
      manaColors: colors,
    },
    isManaAbility: true,
    canActivate: standardTapCheck,
  };
}

/**
 * Create a tap-for-single-color ability (shorthand)
 *
 * @param card The card instance
 * @param color Single mana color
 */
export function createTapForSingleMana(card: CardInstance, color: ManaColor): ActivatedAbility {
  return createTapForMana(card, [color]);
}

/**
 * Create a Birds of Paradise style any-color mana ability
 */
export function createTapForAnyColor(card: CardInstance): ActivatedAbility {
  return createTapForMana(card, ['W', 'U', 'B', 'R', 'G'], {
    name: 'Tap: Add one mana of any color',
  });
}

/**
 * Create a multi-mana ability (like Fyndhorn Elder)
 *
 * @param card The card instance
 * @param color Mana color
 * @param amount Number of mana to produce
 */
export function createTapForMultipleMana(
  card: CardInstance,
  color: ManaColor,
  amount: number,
): ActivatedAbility {
  return createTapForMana(card, [color], { amount });
}

// =============================================================================
// SACRIFICE FOR MANA
// =============================================================================

/**
 * Create a sacrifice-for-mana ability
 *
 * Used for: Blood Pet, etc.
 *
 * @param card The card instance
 * @param colors Mana colors to produce
 * @param options Additional configuration
 *
 * @example
 * // Blood Pet: Sacrifice Blood Pet: Add {B}
 * createSacrificeForMana(card, ['B'])
 */
export function createSacrificeForMana(
  card: CardInstance,
  colors: ManaColor[],
  options: {
    /** Amount of mana to produce (default: 1) */
    amount?: number;
    /** Custom display name */
    name?: string;
  } = {},
): ActivatedAbility {
  const { amount = 1, name } = options;
  const colorSymbols = colors.map((c) => `{${c}}`).join('');

  return {
    id: `${card.instanceId}_sac_mana`,
    name: name || `Sacrifice: Add ${colorSymbols}`,
    cost: {
      sacrifice: { type: 'self' },
    },
    effect: {
      type: 'ADD_MANA',
      amount,
      manaColors: colors,
    },
    isManaAbility: true,
    canActivate: sourceExistsCheck,
  };
}

// =============================================================================
// SPECIAL MANA ABILITIES
// =============================================================================

/**
 * Create a colorless mana ability (artifacts, etc.)
 */
export function createTapForColorless(card: CardInstance, amount: number = 1): ActivatedAbility {
  return createTapForMana(card, ['C'], { amount });
}

// =============================================================================
// PAIN LANDS
// =============================================================================

/**
 * Create pain land abilities (tap for colorless OR colored + 1 damage)
 *
 * Pain lands have two abilities:
 * 1. {T}: Add {C} (no damage)
 * 2. {T}: Add one of two colors. This land deals 1 damage to you.
 *
 * Used for: Adarkar Wastes, Brushland, Karplusan Forest, etc.
 *
 * @param card The card instance
 * @param colors Array of two mana colors (e.g., ['W', 'U'] for Adarkar Wastes)
 *
 * @example
 * // Adarkar Wastes: {T}: Add {C} or {W}/{U} (1 damage)
 * createPainLandAbilities(card, ['W', 'U'])
 */
export function createPainLandAbilities(
  card: CardInstance,
  colors: [ManaColor, ManaColor],
): ActivatedAbility[] {
  return [
    // Ability 1: Tap for colorless (no pain)
    {
      id: `${card.instanceId}_tap_colorless`,
      name: 'Tap: Add {C}',
      cost: { tap: true },
      effect: {
        type: 'ADD_MANA',
        amount: 1,
        manaColors: ['C'],
      },
      isManaAbility: true,
      canActivate: untappedCheck,
    },
    // Ability 2: Tap for colored + 1 damage (using life cost)
    {
      id: `${card.instanceId}_tap_colored`,
      name: `Tap: Add {${colors[0]}} or {${colors[1]}} (1 damage)`,
      cost: { tap: true, life: 1 },
      effect: {
        type: 'ADD_MANA',
        amount: 1,
        manaColors: colors,
      },
      isManaAbility: true,
      canActivate: untappedCheck,
    },
  ];
}

// =============================================================================
// SACRIFICE LANDS
// =============================================================================

/**
 * Create sacrifice land abilities (tap for single mana OR sacrifice for double)
 *
 * Sacrifice lands enter tapped (handled in reducer) and have two abilities:
 * 1. {T}: Add {color}
 * 2. {T}, Sacrifice: Add {color}{color}
 *
 * Used for: Dwarven Ruins, Ebon Stronghold, etc.
 *
 * @param card The card instance
 * @param color Mana color this land produces
 *
 * @example
 * // Dwarven Ruins: {T}: Add {R} or sacrifice for {R}{R}
 * createSacrificeLandAbilities(card, 'R')
 */
export function createSacrificeLandAbilities(
  card: CardInstance,
  color: ManaColor,
): ActivatedAbility[] {
  return [
    // Ability 1: Tap for single mana
    {
      id: `${card.instanceId}_tap_mana`,
      name: `Tap: Add {${color}}`,
      cost: { tap: true },
      effect: {
        type: 'ADD_MANA',
        amount: 1,
        manaColors: [color],
      },
      isManaAbility: true,
      canActivate: untappedCheck,
    },
    // Ability 2: Tap + Sacrifice for double mana
    {
      id: `${card.instanceId}_sac_mana`,
      name: `Tap, Sacrifice: Add {${color}}{${color}}`,
      cost: { tap: true, sacrifice: { type: 'self' } },
      effect: {
        type: 'ADD_MANA',
        amount: 2,
        manaColors: [color],
      },
      isManaAbility: true,
      canActivate: untappedCheck,
    },
  ];
}

// =============================================================================
// CRYSTAL VEIN
// =============================================================================

/**
 * Create Crystal Vein abilities (colorless version of sacrifice land)
 *
 * Crystal Vein has:
 * 1. {T}: Add {C}
 * 2. {T}, Sacrifice: Add {C}{C}
 *
 * @param card The card instance
 */
export function createCrystalVeinAbilities(card: CardInstance): ActivatedAbility[] {
  return [
    {
      id: `${card.instanceId}_tap_mana`,
      name: 'Tap: Add {C}',
      cost: { tap: true },
      effect: {
        type: 'ADD_MANA',
        amount: 1,
        manaColors: ['C'],
      },
      isManaAbility: true,
      canActivate: untappedCheck,
    },
    {
      id: `${card.instanceId}_sac_mana`,
      name: 'Tap, Sacrifice: Add {C}{C}',
      cost: { tap: true, sacrifice: { type: 'self' } },
      effect: {
        type: 'ADD_MANA',
        amount: 2,
        manaColors: ['C'],
      },
      isManaAbility: true,
      canActivate: untappedCheck,
    },
  ];
}

// =============================================================================
// CITY OF BRASS
// =============================================================================

/**
 * Create City of Brass ability (any color, triggers damage on tap)
 *
 * City of Brass has:
 * - {T}: Add one mana of any color
 * - Whenever this land becomes tapped, it deals 1 damage to you (trigger, not part of cost)
 *
 * Note: The damage trigger is handled in triggers.ts
 *
 * @param card The card instance
 */
export function createCityOfBrassAbility(card: CardInstance): ActivatedAbility {
  return {
    id: `${card.instanceId}_tap_mana`,
    name: 'Tap: Add any color',
    cost: { tap: true },
    effect: {
      type: 'ADD_MANA',
      amount: 1,
      manaColors: ['W', 'U', 'B', 'R', 'G'],
    },
    isManaAbility: true,
    canActivate: untappedCheck,
  };
}
