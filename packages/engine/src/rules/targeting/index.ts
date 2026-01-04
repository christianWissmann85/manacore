/**
 * Targeting System
 *
 * Modular targeting system for spells and abilities.
 *
 * Modules:
 * - types: Type definitions
 * - parser: Oracle text parsing
 * - validation: Target validation and protection checks
 * - generation: Legal target generation
 * - resolution: Fizzle checks
 *
 * This barrel file exports the public API.
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  TargetType,
  MtgColor,
  TargetRestriction,
  TargetRequirement,
  ResolvedTarget,
} from './types';

export { COLOR_NAMES } from './types';

// =============================================================================
// PROTECTION LOGIC (Phase 2)
// =============================================================================

export {
  hasHexproof,
  hasShroud,
  hasProtectionFrom,
  hasProtectionFromAllColors,
  getSourceColors,
  hasProtectionFromSource,
} from './validation/protection';

// =============================================================================
// PARSER (Phase 3)
// =============================================================================

export {
  parseTargetRequirements,
  requiresTargets,
  getRequiredTargetCount,
  getMaxTargetCount,
  matchTargetPattern,
  getAllMatchingPatterns,
  TARGET_PATTERNS,
} from './parser';

export type { TargetPattern } from './parser';

// =============================================================================
// VALIDATION (Phase 4)
// =============================================================================

export {
  validateTargets,
  validateSingleTarget,
  validateRestriction,
  validateColorRestriction,
  validateControllerRestriction,
  validateCombatRestriction,
  validateTappedRestriction,
  validateUntappedRestriction,
  validateNonartifactRestriction,
  validateNonlandRestriction,
  validateKeywordRestriction,
  validateSubtypeRestriction,
  RESTRICTION_VALIDATORS,
} from './validation';

export type { RestrictionValidator } from './validation';

// =============================================================================
// GENERATION (Phase 5)
// =============================================================================

export {
  getLegalTargets,
  getPlayerTargets,
  getStackTargets,
  getBattlefieldTargets,
  getGraveyardTargets,
  matchesTargetType,
  canBeTargeted,
  getAllLegalTargetCombinations,
  generateCombinations,
  countLegalTargetCombinations,
  hasLegalTargets,
} from './generation';

// =============================================================================
// RESOLUTION (Phase 6)
// =============================================================================

export {
  checkTargetsStillLegal,
  shouldSpellFizzle,
  getLegalTargetsAtResolution,
} from './resolution';

export type { TargetLegalityResult } from './resolution';
