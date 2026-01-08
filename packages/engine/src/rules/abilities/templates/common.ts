/**
 * Common utility functions for ability templates
 *
 * These functions are shared across multiple template files to reduce
 * code duplication, especially for canActivate checks.
 */

import type { GameState } from '../../../state/GameState';
import type { PlayerId } from '../../../state/Zone';
import { CardLoader } from '../../../cards/CardLoader';
import { isLand } from '../../../cards/CardTemplate';
import type { ManaColor } from '../types';

// =============================================================================
// ACTIVATION CHECKS
// =============================================================================

/**
 * Standard tap ability activation check
 *
 * Validates that:
 * - Source exists on battlefield
 * - Source is not tapped
 * - Source does not have summoning sickness (for creatures with tap abilities)
 *
 * Used by: Most tap abilities (mana dorks, pingers, etc.)
 */
export function standardTapCheck(
  state: GameState,
  sourceId: string,
  controller: PlayerId,
): boolean {
  const source = state.players[controller].battlefield.find((c) => c.instanceId === sourceId);
  if (!source) return false;
  if (source.tapped) return false;
  if (source.summoningSick) return false;
  return true;
}

/**
 * Check if source exists on battlefield (for sacrifice abilities)
 *
 * Used by abilities that don't require the source to be untapped,
 * like sacrifice-for-mana abilities (Blood Pet, etc.)
 */
export function sourceExistsCheck(
  state: GameState,
  sourceId: string,
  controller: PlayerId,
): boolean {
  const source = state.players[controller].battlefield.find((c) => c.instanceId === sourceId);
  return source !== undefined;
}

/**
 * Check if source exists and is not tapped (but ignores summoning sickness)
 *
 * Used by artifacts and lands that have tap abilities but aren't creatures
 */
export function untappedCheck(state: GameState, sourceId: string, controller: PlayerId): boolean {
  const source = state.players[controller].battlefield.find((c) => c.instanceId === sourceId);
  if (!source) return false;
  if (source.tapped) return false;
  return true;
}

// =============================================================================
// MANA AVAILABILITY
// =============================================================================

/**
 * Count available mana of a specific color
 *
 * Includes:
 * - Mana currently in pool
 * - Potential mana from untapped lands/creatures
 *
 * @param state Game state
 * @param controller Player to check
 * @param color Mana color to count
 */
export function countAvailableMana(
  state: GameState,
  controller: PlayerId,
  color: ManaColor,
): number {
  const player = state.players[controller];
  let total = 0;

  // Count mana currently in pool
  switch (color) {
    case 'W':
      total += player.manaPool.white;
      break;
    case 'U':
      total += player.manaPool.blue;
      break;
    case 'B':
      total += player.manaPool.black;
      break;
    case 'R':
      total += player.manaPool.red;
      break;
    case 'G':
      total += player.manaPool.green;
      break;
    case 'C':
      total += player.manaPool.colorless;
      break;
  }

  // Count untapped lands that can produce this color
  for (const permanent of player.battlefield) {
    if (permanent.tapped) continue;

    const template = CardLoader.getById(permanent.scryfallId);
    if (!template || !isLand(template)) continue;

    // Check if land produces the required color
    const landColors = getLandManaColors(template.name);
    if (landColors.includes(color)) {
      total++;
    }
  }

  return total;
}

/**
 * Get mana colors a land can produce based on its name
 */
export function getLandManaColors(landName: string): ManaColor[] {
  const colorMap: Record<string, ManaColor[]> = {
    Plains: ['W'],
    Island: ['U'],
    Swamp: ['B'],
    Mountain: ['R'],
    Forest: ['G'],
    // Pain lands
    'Adarkar Wastes': ['W', 'U'],
    'Underground River': ['U', 'B'],
    'Sulfurous Springs': ['B', 'R'],
    'Karplusan Forest': ['R', 'G'],
    Brushland: ['G', 'W'],
    // City of Brass
    'City of Brass': ['W', 'U', 'B', 'R', 'G'],
  };

  return colorMap[landName] || [];
}

/**
 * Check if player can pay a mana cost
 *
 * Handles both colored mana ({R}, {U}) and generic mana ({1}, {2}).
 *
 * @param state Game state
 * @param controller Player to check
 * @param manaCost Mana cost string (e.g., '{R}', '{2}{G}', '{3}')
 */
export function canPaySimpleMana(
  state: GameState,
  controller: PlayerId,
  manaCost: string,
): boolean {
  // 1. Parse Cost
  const costs: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, Generic: 0 };
  let totalNeeded = 0;

  // Generic mana (e.g. {2})
  const genericMatches = manaCost.match(/\{(\d+)\}/);
  if (genericMatches && genericMatches[1]) {
    const amount = parseInt(genericMatches[1], 10);
    costs.Generic = amount;
    totalNeeded += amount;
  }

  // Colored mana
  const colorMatches = manaCost.matchAll(/\{([WUBRGC])\}/g);
  for (const match of colorMatches) {
    const color = match[1];
    if (color) {
      costs[color] = (costs[color] || 0) + 1;
      totalNeeded++;
    }
  }

  // 2. Check Total Available Mana
  const player = state.players[controller];
  let totalAvailable = 0;

  // Pool
  totalAvailable +=
    player.manaPool.white +
    player.manaPool.blue +
    player.manaPool.black +
    player.manaPool.red +
    player.manaPool.green +
    player.manaPool.colorless;

  // Lands (untapped)
  for (const permanent of player.battlefield) {
    if (permanent.tapped) continue;
    const template = CardLoader.getById(permanent.scryfallId);
    if (template && isLand(template)) {
      totalAvailable++; // Assuming 1 mana per land for now
    }
  }

  if (totalAvailable < totalNeeded) {
    return false;
  }

  // 3. Check Specific Color Requirements
  // Note: This is a heuristic. It checks if there is enough mana of each color individually.
  const colors = ['W', 'U', 'B', 'R', 'G', 'C'] as const;
  for (const color of colors) {
    const cost = costs[color];
    if (cost !== undefined && cost > 0) {
      if (countAvailableMana(state, controller, color) < cost) {
        return false;
      }
    }
  }

  return true;
}

// =============================================================================
// SACRIFICE HELPERS
// =============================================================================

/**
 * Check if player has a permanent they can sacrifice
 *
 * @param state Game state
 * @param controller Player to check
 * @param type Type of permanent to sacrifice
 * @param excludeSourceId Optional: exclude this permanent (for 'other creature' effects)
 */
export function hasSacrificeable(
  state: GameState,
  controller: PlayerId,
  type: 'creature' | 'land' | 'artifact' | 'permanent',
  excludeSourceId?: string,
): boolean {
  const player = state.players[controller];

  return player.battlefield.some((permanent) => {
    if (excludeSourceId && permanent.instanceId === excludeSourceId) {
      return false;
    }

    const template = CardLoader.getById(permanent.scryfallId);
    if (!template) return false;

    switch (type) {
      case 'creature':
        return template.type_line?.toLowerCase().includes('creature');
      case 'land':
        return template.type_line?.toLowerCase().includes('land');
      case 'artifact':
        return template.type_line?.toLowerCase().includes('artifact');
      case 'permanent':
        return true; // Any permanent
    }
  });
}

/**
 * Check if player has a specific land type to sacrifice
 *
 * @param state Game state
 * @param controller Player to check
 * @param landType Specific land type (e.g., 'Swamp')
 */
export function hasLandTypeToSacrifice(
  state: GameState,
  controller: PlayerId,
  landType: string,
): boolean {
  const player = state.players[controller];

  return player.battlefield.some((permanent) => {
    const template = CardLoader.getById(permanent.scryfallId);
    return template?.name === landType;
  });
}
