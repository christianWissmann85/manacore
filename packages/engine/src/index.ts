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
  // Phase 1.5.3: New keywords
  hasDefender,
  hasFear,
  hasIntimidate,
  hasMenace,
  hasSwampwalk,
  hasIslandwalk,
  hasForestwalk,
  hasMountainwalk,
  hasPlainswalk,
  getLandwalkTypes,
} from './cards/CardTemplate';

// Token exports (Phase 1.5.1)
export type { TokenDefinition } from './tokens/TokenRegistry';
export {
  TOKEN_REGISTRY,
  getTokenDefinition,
  isTokenCard,
  isTokenType,
  createToken,
  createTokens,
  putTokensOntoBattlefield,
  removeAllTokensOfType,
  removeTokensCreatedBy,
} from './tokens/TokenRegistry';

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
  ActivateAbilityAction,
  SacrificePermanentAction,
} from './actions/Action';

export {
  isPlayLandAction,
  isCastSpellAction,
  isDeclareAttackersAction,
  isDeclareBlockersAction,
  isSacrificePermanentAction,
} from './actions/Action';

export { validateAction } from './actions/validators';
export { applyAction } from './actions/reducer';
export { getLegalActions, describeAction } from './actions/getLegalActions';

// Rules exports
export type { ActivatedAbility, AbilityCost, AbilityEffect, SacrificeCost } from './rules/activatedAbilities';
export { getActivatedAbilities, payCosts } from './rules/activatedAbilities';

// Lords system (Week 1.5.4)
export {
  getLordBonuses,
  getEffectivePowerWithLords,
  getEffectiveToughnessWithLords,
  hasKeywordWithLords,
  getAllKeywords,
  getCreatureSubtypes,
  hasCreatureSubtype,
  // Variable P/T (Phase 1.5.4)
  calculateVariablePT,
} from './rules/lords';

// Effect helpers (Week 1.5.2)
export {
  // Mass destruction
  destroyAllMatching,
  destroyAllCreatures,
  destroyAllLands,
  destroyAllArtifacts,
  destroyAllEnchantments,
  destroyAllCreaturesOfColor,
  destroyAllLandsOfType,
  destroyAllNonEnchantments,
  // Untap/tap effects
  untapAllMatching,
  untapAllLands,
  untapAllCreatures,
  tapAllMatching,
  tapAllNonFlyingCreatures,
  // Library search (tutors)
  searchLibrary,
  shuffleLibrary,
  // Graveyard recursion
  returnFromGraveyard,
  returnCreatureFromGraveyard,
  returnSpellFromGraveyard,
  // Team pump
  applyTeamPump,
  // Mass damage
  dealDamageToAll,
  dealDamageToNonFlyers,
  // Card manipulation
  putCardsOnTopOfLibrary,
  discardThenDraw,
  drawThenPutBack,
  // Life manipulation
  drainLife,
  drawCardsPayLife,
  // Conditional destruction
  destroyCreatureIf,
  destroyIfDamaged,
  destroyIfPowerFourOrGreater,
} from './rules/effects';

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
