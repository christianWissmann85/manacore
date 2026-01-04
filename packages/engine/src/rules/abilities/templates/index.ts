/**
 * Ability Templates - Barrel Export
 *
 * Re-exports all template functions for easy importing.
 * Templates are factory functions that create ActivatedAbility objects
 * for common ability patterns.
 */

// =============================================================================
// COMMON UTILITIES
// =============================================================================

export {
  standardTapCheck,
  sourceExistsCheck,
  untappedCheck,
  countAvailableMana,
  canPaySimpleMana,
  hasSacrificeable,
  hasLandTypeToSacrifice,
  getLandManaColors,
} from './common';

// =============================================================================
// MANA TEMPLATES
// =============================================================================

export {
  createTapForMana,
  createTapForSingleMana,
  createTapForAnyColor,
  createTapForMultipleMana,
  createSacrificeForMana,
  createTapForColorless,
  // Land templates
  createPainLandAbilities,
  createSacrificeLandAbilities,
  createCrystalVeinAbilities,
  createCityOfBrassAbility,
} from './mana';

// =============================================================================
// DAMAGE TEMPLATES
// =============================================================================

export {
  createTapForDamage,
  createTimAbility,
  createPaidTimAbility,
  createScalableDamageAbility,
  createDamageWithSelfDamage,
} from './damage';

// =============================================================================
// PUMP TEMPLATES
// =============================================================================

export {
  createPumpSelf,
  createFirebreathing,
  createShadeAbility,
  createTapToBuffOther,
  createTapToDebuff,
} from './pump';

// =============================================================================
// COMBAT TEMPLATES (Regeneration, Damage Prevention)
// =============================================================================

export {
  createRegenerate,
  createLifeRegenerate,
  createLandSacrificeRegenerate,
  createTapToPrevent,
  createLifeToPrevent,
  createSacrificeToPrevent,
} from './combat';

// =============================================================================
// SACRIFICE TEMPLATES
// =============================================================================

export {
  createSacrificeForPump,
  createSacrificeToDestroy,
  createSacrificeToCounter,
  createSacrificeCreatureForDamage,
  createSacrificeCreatureForDraw,
  createSacrificeLandForBuff,
} from './sacrifice';
