/**
 * @manacore/engine - Pure game logic package
 *
 * This package contains:
 * - Game state management
 * - Action system and reducers
 * - Game rules (combat, stack, state-based actions)
 * - Card loading from Scryfall data
 *
 * IMPORTANT: This package has ZERO dependencies on UI libraries.
 * It can run headless at 1000+ games/second for AI simulations.
 */

export const ENGINE_VERSION = "0.0.1";

// State exports
export type { GameState, StackObject } from './state/GameState';
export type { PlayerState, ManaPool } from './state/PlayerState';
export type { CardInstance } from './state/CardInstance';
export type { Zone, PlayerId, GamePhase, GameStep, CounterType } from './state/Zone';

export {
  createGameState,
  getPlayer,
  getOpponent,
  findCard,
} from './state/GameState';

export {
  createPlayerState,
  createEmptyManaPool,
} from './state/PlayerState';

export type { TemporaryModification } from './state/CardInstance';
export {
  createCardInstance,
  getEffectivePower,
  getEffectiveToughness,
  addTemporaryModification,
  clearTemporaryModifications,
} from './state/CardInstance';

// Card exports
export type { CardTemplate } from './cards/CardTemplate';
export { CardLoader } from './cards/CardLoader';
export {
  isCreature,
  isLand,
  isInstant,
  isSorcery,
  isEnchantment,
  isAura,
  isArtifact,
  hasKeyword,
  hasFlying,
  hasFirstStrike,
  hasDoubleStrike,
  hasTrample,
  hasVigilance,
  hasReach,
  hasHaste,
  hasHexproof as hasHexproofTemplate,
  hasShroud as hasShroudTemplate,
  hasProtectionFromColor,
} from './cards/CardTemplate';

// Action exports
export type {
  Action,
  GameAction,
  PlayLandAction,
  CastSpellAction,
  DeclareAttackersAction,
  DeclareBlockersAction,
  PassPriorityAction,
  EndTurnAction,
  DrawCardAction,
  UntapAction,
} from './actions/Action';

export {
  isPlayLandAction,
  isCastSpellAction,
  isDeclareAttackersAction,
  isDeclareBlockersAction,
} from './actions/Action';

export { validateAction } from './actions/validators';
export { applyAction } from './actions/reducer';
export { getLegalActions, describeAction } from './actions/getLegalActions';

// Rules exports
export type { ActivatedAbility, AbilityCost, AbilityEffect } from './rules/activatedAbilities';
export { getActivatedAbilities } from './rules/activatedAbilities';

// Targeting exports
export type {
  TargetType,
  TargetRestriction,
  TargetRequirement,
  ResolvedTarget,
  MtgColor,
} from './rules/targeting';

export {
  parseTargetRequirements,
  requiresTargets,
  getRequiredTargetCount,
  getMaxTargetCount,
  validateTargets,
  getLegalTargets,
  getAllLegalTargetCombinations,
  shouldSpellFizzle,
  hasHexproof,
  hasShroud,
  hasProtectionFrom,
} from './rules/targeting';

// Utilities
export {
  shuffle,
  createSimpleDeck,
  initializeGame,
  createVanillaDeck,
  // Week 11: Mono-colored test decks
  createWhiteDeck,
  createBlueDeck,
  createBlackDeck,
  createRedDeck,
  createGreenDeck,
  getRandomTestDeck,
  getTestDeck,
  TEST_DECKS,
  type DeckColor,
} from './utils/gameInit';

// Mana utilities
export type { ManaCost, ManaColor } from './utils/manaCosts';
export {
  parseManaCost,
  canPayManaCost,
  payManaCost,
  addManaToPool,
  emptyManaPool,
  formatManaPool,
  formatManaCost,
  getLandManaColors,
  hasXInCost,
  getTotalMana,
  getConvertedManaCost,
} from './utils/manaCosts';

// Validator utilities
export { calculateAvailableMana } from './actions/validators';

console.log(`✅ @manacore/engine v${ENGINE_VERSION} loaded`);
