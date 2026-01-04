/**
 * Target Resolution
 *
 * Handles target legality checks at resolution time.
 * Determines if spells fizzle (all targets became illegal).
 *
 * Key concepts:
 * - A spell fizzles ONLY if ALL its targets became illegal
 * - If some targets are still legal, the spell resolves with just those targets
 * - Targets can become illegal by leaving the battlefield, gaining protection, etc.
 */

import type { GameState } from '../../../state/GameState';
import type { CardInstance } from '../../../state/CardInstance';
import type { PlayerId } from '../../../state/Zone';
import type { TargetRequirement } from '../types';
import { validateSingleTarget } from '../validation';

// =============================================================================
// RESULT TYPES
// =============================================================================

/**
 * Result of checking target legality at resolution time
 */
export interface TargetLegalityResult {
  /** True if ALL targets became illegal (spell should fizzle) */
  allIllegal: boolean;
  /** Targets that are still legal */
  legalTargets: string[];
  /** Targets that became illegal */
  illegalTargets: string[];
}

// =============================================================================
// TARGET LEGALITY CHECKS
// =============================================================================

/**
 * Check if targets are still legal when a spell/ability resolves
 *
 * Called when resolving a spell or ability from the stack to determine:
 * 1. Which targets are still valid
 * 2. Whether the spell should fizzle (all targets illegal)
 *
 * Targets can become illegal by:
 * - Leaving the battlefield (destroyed, bounced, exiled)
 * - Gaining hexproof or shroud
 * - Gaining protection from the source's color
 * - Changing zones (for zone-specific targets)
 * - Combat status changing (for "target attacking creature", etc.)
 *
 * @param state - Current game state at resolution time
 * @param targets - Array of target IDs chosen when spell was cast
 * @param requirements - Target requirements from the spell/ability
 * @param controller - Player who controls the spell/ability
 * @param sourceCard - Optional source card (for protection checks)
 * @returns Object with allIllegal flag and lists of legal/illegal targets
 *
 * @example
 * // Lightning Bolt targeting a creature that was destroyed
 * const result = checkTargetsStillLegal(state, ['creature_123'], requirements, 'player');
 * // result.allIllegal = true (creature no longer exists)
 * // result.legalTargets = []
 * // result.illegalTargets = ['creature_123']
 *
 * @example
 * // Multi-target spell where one target is still valid
 * const result = checkTargetsStillLegal(state, ['creature_1', 'creature_2'], requirements, 'player');
 * // result.allIllegal = false (at least one target valid)
 * // result.legalTargets = ['creature_2']
 * // result.illegalTargets = ['creature_1']
 */
export function checkTargetsStillLegal(
  state: GameState,
  targets: string[],
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance,
): TargetLegalityResult {
  const legalTargets: string[] = [];
  const illegalTargets: string[] = [];

  // Iterate through targets, matching them to their requirements
  let targetIndex = 0;
  for (const req of requirements) {
    for (let i = 0; i < req.count && targetIndex < targets.length; i++) {
      const targetId = targets[targetIndex]!;

      // Re-validate the target against its requirement
      const errors = validateSingleTarget(state, targetId, req, controller, sourceCard);

      if (errors.length === 0) {
        legalTargets.push(targetId);
      } else {
        illegalTargets.push(targetId);
      }
      targetIndex++;
    }
  }

  return {
    allIllegal: legalTargets.length === 0 && targets.length > 0,
    legalTargets,
    illegalTargets,
  };
}

/**
 * Check if a spell should fizzle (all targets became illegal)
 *
 * Per MTG rules (CR 608.2b), a spell or ability with targets is countered
 * if all its targets are illegal when it tries to resolve.
 *
 * Important: A spell WITHOUT targets cannot fizzle. This function returns
 * false for spells with no targets or no target requirements.
 *
 * @param state - Current game state at resolution time
 * @param targets - Array of target IDs chosen when spell was cast
 * @param requirements - Target requirements from the spell/ability
 * @param controller - Player who controls the spell/ability
 * @param sourceCard - Optional source card (for protection checks)
 * @returns True if the spell should fizzle, false otherwise
 *
 * @example
 * // Spell with target that was destroyed
 * shouldSpellFizzle(state, ['creature_123'], requirements, 'player')
 * // Returns true - creature no longer exists
 *
 * @example
 * // Spell with no targets (like Wrath of God)
 * shouldSpellFizzle(state, [], [], 'player')
 * // Returns false - spells without targets don't fizzle
 *
 * @example
 * // Multi-target spell with one valid target remaining
 * shouldSpellFizzle(state, ['creature_1', 'creature_2'], requirements, 'player')
 * // Returns false if at least one target is still valid
 */
export function shouldSpellFizzle(
  state: GameState,
  targets: string[],
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance,
): boolean {
  // Spells without targets cannot fizzle
  if (targets.length === 0 || requirements.length === 0) {
    return false;
  }

  const { allIllegal } = checkTargetsStillLegal(
    state,
    targets,
    requirements,
    controller,
    sourceCard,
  );

  return allIllegal;
}

/**
 * Get only the legal targets from a list (filtering out illegal ones)
 *
 * Useful when a spell resolves and you need to know which targets
 * to actually apply the effect to.
 *
 * @param state - Current game state at resolution time
 * @param targets - Array of target IDs chosen when spell was cast
 * @param requirements - Target requirements from the spell/ability
 * @param controller - Player who controls the spell/ability
 * @param sourceCard - Optional source card (for protection checks)
 * @returns Array of target IDs that are still legal
 *
 * @example
 * // Get valid targets for damage spell
 * const validTargets = getLegalTargetsAtResolution(state, targets, requirements, 'player');
 * for (const targetId of validTargets) {
 *   applyDamage(state, targetId, 3);
 * }
 */
export function getLegalTargetsAtResolution(
  state: GameState,
  targets: string[],
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance,
): string[] {
  const { legalTargets } = checkTargetsStillLegal(
    state,
    targets,
    requirements,
    controller,
    sourceCard,
  );

  return legalTargets;
}
