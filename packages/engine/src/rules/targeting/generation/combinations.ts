/**
 * Target Combination Generation
 *
 * Generates all valid target combinations for a set of requirements.
 * Used by AI and action generation to enumerate possible spell casts.
 */

import type { GameState } from '../../../state/GameState';
import type { CardInstance } from '../../../state/CardInstance';
import type { PlayerId } from '../../../state/Zone';
import type { TargetRequirement } from '../types';
import { CardLoader } from '../../../cards/CardLoader';
import { validateSingleTarget } from '../validation';

// =============================================================================
// LOCAL getLegalTargets IMPLEMENTATION
// =============================================================================

/**
 * Get all legal targets for a requirement (local implementation)
 *
 * This is a local copy to avoid circular dependency with index.ts.
 * The main getLegalTargets is exported from index.ts.
 *
 * @internal
 */
function getLegalTargetsInternal(
  state: GameState,
  requirement: TargetRequirement,
  controller: PlayerId,
  sourceCard?: CardInstance,
): string[] {
  const validTargets: string[] = [];

  // === Player Targets ===
  if (
    requirement.targetType === 'any' ||
    requirement.targetType === 'player' ||
    requirement.targetType === 'opponent'
  ) {
    if (requirement.targetType === 'opponent') {
      validTargets.push(controller === 'player' ? 'opponent' : 'player');
    } else {
      validTargets.push('player', 'opponent');
    }
  }

  // === Stack Targets ===
  if (
    requirement.zone === 'stack' ||
    requirement.targetType === 'spell' ||
    requirement.targetType === 'creature_spell'
  ) {
    for (const stackObj of state.stack) {
      if (sourceCard && stackObj.card.instanceId === sourceCard.instanceId) {
        continue;
      }
      if (requirement.targetType === 'creature_spell') {
        const template = CardLoader.getById(stackObj.card.scryfallId);
        if (!template || !template.type_line.includes('Creature')) {
          continue;
        }
      }
      validTargets.push(stackObj.id);
    }
    if (requirement.zone === 'stack') {
      return validTargets;
    }
  }

  // === Battlefield Targets ===
  if (requirement.zone === 'battlefield' || requirement.zone === 'any') {
    for (const playerId of ['player', 'opponent'] as const) {
      const player = state.players[playerId];
      for (const card of player.battlefield) {
        const errors = validateSingleTarget(
          state,
          card.instanceId,
          requirement,
          controller,
          sourceCard,
        );
        if (errors.length === 0) {
          validTargets.push(card.instanceId);
        }
      }
    }
  }

  // === Graveyard Targets ===
  if (requirement.zone === 'graveyard') {
    for (const playerId of ['player', 'opponent'] as const) {
      const player = state.players[playerId];
      for (const card of player.graveyard) {
        const errors = validateSingleTarget(
          state,
          card.instanceId,
          requirement,
          controller,
          sourceCard,
        );
        if (errors.length === 0) {
          validTargets.push(card.instanceId);
        }
      }
    }
  }

  return validTargets;
}

// =============================================================================
// MAIN COMBINATION GENERATOR
// =============================================================================

/**
 * Generate all valid target combinations for a set of requirements
 *
 * Handles multiple requirements by generating the cartesian product of all
 * valid targets, filtering out duplicates (same target can't be chosen twice).
 *
 * Special cases:
 * - 0 requirements: Returns [[]] (empty target array is valid)
 * - 1 requirement: Returns array of single-element arrays
 * - 2 requirements: Optimized inline implementation
 * - 3+ requirements: Uses recursive combination generation
 *
 * @param state - Current game state
 * @param requirements - Array of target requirements
 * @param controller - Player who controls the spell/ability
 * @param sourceCard - Optional source card
 * @returns Array of valid target combinations (each is an array of target IDs)
 *
 * @example
 * // Single target spell (Lightning Bolt)
 * getAllLegalTargetCombinations(state, [{ targetType: 'any', ... }], 'player')
 * // Returns: [['creature_1'], ['creature_2'], ['player'], ['opponent']]
 *
 * @example
 * // Two target spell
 * getAllLegalTargetCombinations(state, [req1, req2], 'player')
 * // Returns: [['creature_1', 'creature_2'], ['creature_1', 'player'], ...]
 */
export function getAllLegalTargetCombinations(
  state: GameState,
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance,
): string[][] {
  // Case: No targets needed
  if (requirements.length === 0) {
    return [[]];
  }

  // Get legal targets for each requirement
  const targetsPerRequirement: string[][] = requirements.map((req) =>
    getLegalTargetsInternal(state, req, controller, sourceCard),
  );

  // Check if any required target has no valid options
  for (let i = 0; i < requirements.length; i++) {
    const req = requirements[i]!;
    const targets = targetsPerRequirement[i]!;

    // If a required (non-optional) target has no valid options, spell can't be cast
    if (!req.optional && targets.length === 0) {
      return [];
    }
  }

  // Case: Single requirement (most common)
  if (requirements.length === 1) {
    return targetsPerRequirement[0]!.map((t) => [t]);
  }

  // Case: Two requirements (optimized common case)
  if (requirements.length === 2) {
    return generateTwoTargetCombinations(
      targetsPerRequirement[0]!,
      targetsPerRequirement[1]!,
      requirements[0]!.optional,
      requirements[1]!.optional,
    );
  }

  // Case: 3+ requirements (recursive)
  return generateCombinationsRecursive(targetsPerRequirement, requirements, 0, []);
}

// =============================================================================
// TWO-TARGET OPTIMIZATION
// =============================================================================

/**
 * Generate combinations for exactly two requirements
 *
 * Optimized inline implementation for the common case of spells with two targets.
 * Avoids the overhead of recursive calls.
 *
 * @param targets1 - Valid targets for first requirement
 * @param targets2 - Valid targets for second requirement
 * @param _optional1 - Whether first requirement is optional (reserved for future use)
 * @param _optional2 - Whether second requirement is optional (reserved for future use)
 * @returns Array of valid [target1, target2] combinations
 */
function generateTwoTargetCombinations(
  targets1: string[],
  targets2: string[],
  _optional1: boolean,
  _optional2: boolean,
): string[][] {
  const combinations: string[][] = [];

  // Standard case: Both targets required
  for (const t1 of targets1) {
    for (const t2 of targets2) {
      // Avoid duplicate targets (most spells can't target same thing twice)
      if (t1 !== t2) {
        combinations.push([t1, t2]);
      }
    }
  }

  // Note: Optional target handling can be added here for "up to X targets" spells
  // For now, we require all targets to be filled

  return combinations;
}

// =============================================================================
// RECURSIVE COMBINATION GENERATOR
// =============================================================================

/**
 * Recursively generate target combinations for 3+ requirements
 *
 * Uses a depth-first approach to build up combinations one target at a time.
 * Ensures no duplicate targets are selected across requirements.
 *
 * @param targetsPerReq - Legal targets for each requirement
 * @param requirements - The target requirements (for optional checks)
 * @param index - Current requirement index being processed
 * @param current - Current partial combination being built
 * @returns Array of complete valid combinations
 */
function generateCombinationsRecursive(
  targetsPerReq: string[][],
  requirements: TargetRequirement[],
  index: number,
  current: string[],
): string[][] {
  // Base case: All requirements processed
  if (index >= targetsPerReq.length) {
    return [current];
  }

  const combinations: string[][] = [];
  const currentTargets = targetsPerReq[index]!;

  // Try each valid target for this requirement
  for (const target of currentTargets) {
    // Avoid duplicate targets across requirements
    if (!current.includes(target)) {
      const newCurrent = [...current, target];
      const subCombinations = generateCombinationsRecursive(
        targetsPerReq,
        requirements,
        index + 1,
        newCurrent,
      );
      combinations.push(...subCombinations);
    }
  }

  return combinations;
}

/**
 * Public recursive combination generator
 *
 * This is exported for cases where you already have the targets per requirement
 * and just need to generate combinations.
 *
 * @param targetsPerReq - Legal targets for each requirement
 * @param index - Current requirement index being processed
 * @param current - Current partial combination being built
 * @returns Array of complete valid combinations
 */
export function generateCombinations(
  targetsPerReq: string[][],
  index: number,
  current: string[],
): string[][] {
  // Base case: All requirements processed
  if (index >= targetsPerReq.length) {
    return [current];
  }

  const combinations: string[][] = [];
  const currentTargets = targetsPerReq[index]!;

  // Try each valid target for this requirement
  for (const target of currentTargets) {
    // Avoid duplicate targets across requirements
    if (!current.includes(target)) {
      const newCurrent = [...current, target];
      const subCombinations = generateCombinations(targetsPerReq, index + 1, newCurrent);
      combinations.push(...subCombinations);
    }
  }

  return combinations;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Count the total number of valid target combinations
 *
 * Useful for AI to quickly determine if a spell can be cast
 * without generating all combinations.
 *
 * @param state - Current game state
 * @param requirements - Array of target requirements
 * @param controller - Player who controls the spell/ability
 * @param sourceCard - Optional source card
 * @returns Number of valid combinations (0 if spell can't be cast)
 */
export function countLegalTargetCombinations(
  state: GameState,
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance,
): number {
  // No targets needed = exactly 1 valid "combination" (empty)
  if (requirements.length === 0) {
    return 1;
  }

  // Get counts for each requirement
  const targetsPerReq: string[][] = requirements.map((req) =>
    getLegalTargetsInternal(state, req, controller, sourceCard),
  );

  // Check if any required target has no valid options
  for (let i = 0; i < requirements.length; i++) {
    if (!requirements[i]!.optional && targetsPerReq[i]!.length === 0) {
      return 0;
    }
  }

  // For single target, count is just the number of valid targets
  if (requirements.length === 1) {
    return targetsPerReq[0]!.length;
  }

  // For multiple targets, we need to account for no-duplicates rule
  // Generate all combinations to get precise count
  return getAllLegalTargetCombinations(state, requirements, controller, sourceCard).length;
}

/**
 * Check if any valid target combinations exist
 *
 * More efficient than generating all combinations when you just
 * need to know if a spell can be cast.
 *
 * @param state - Current game state
 * @param requirements - Array of target requirements
 * @param controller - Player who controls the spell/ability
 * @param sourceCard - Optional source card
 * @returns true if at least one valid combination exists
 */
export function hasLegalTargets(
  state: GameState,
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance,
): boolean {
  // No targets needed = can always be cast
  if (requirements.length === 0) {
    return true;
  }

  // Check each requirement has at least one valid target
  for (const req of requirements) {
    const targets = getLegalTargetsInternal(state, req, controller, sourceCard);
    if (!req.optional && targets.length === 0) {
      return false;
    }
  }

  // For single requirement, having targets is sufficient
  if (requirements.length === 1) {
    return true;
  }

  // For multiple requirements, we need to ensure non-overlapping targets exist
  // Quick check: if combined unique targets >= requirement count, likely valid
  const allTargets = new Set<string>();
  for (const req of requirements) {
    const targets = getLegalTargetsInternal(state, req, controller, sourceCard);
    for (const t of targets) {
      allTargets.add(t);
    }
  }

  if (allTargets.size >= requirements.length) {
    // Likely valid, but edge cases might fail
    // For certainty, we need to check actual combinations
    return getAllLegalTargetCombinations(state, requirements, controller, sourceCard).length > 0;
  }

  return false;
}
