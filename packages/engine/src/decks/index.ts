import { CardTemplate } from '../cards/CardTemplate';
import {
  DeckColor,
  MONO_DECKS,
  createWhiteDeck,
  createBlueDeck,
  createBlackDeck,
  createRedDeck,
  createGreenDeck,
} from './mono';
import {
  TwoColorDeck,
  TWO_COLOR_DECKS,
  createAzoriusDeck,
  createOrzhovDeck,
  createBorosDeck,
  createSelesnyaDeck,
  createDimirDeck,
  createIzzetDeck,
  createSimicDeck,
  createRakdosDeck,
  createGolgariDeck,
  createGruulDeck,
} from './dual';
import {
  CompetitiveDeck,
  COMPETITIVE_DECKS,
  createWhiteWeenie,
  createBlueControl,
  createBlackAggro,
  createRedBurn,
  createGreenMidrange,
} from './competitive';
import {
  SpecialDeck,
  SPECIAL_DECKS,
  createArtifactDeck,
  createColorHateDeck,
  createArtifactsDeck2,
  createSpellsDeck,
  createCreaturesDeck,
  createUncoveredDeck,
} from './special';

// Re-export specific deck creators
export { createSimpleDeck } from './utils';
export {
  createWhiteDeck,
  createBlueDeck,
  createBlackDeck,
  createRedDeck,
  createGreenDeck,
  createAzoriusDeck,
  createOrzhovDeck,
  createBorosDeck,
  createSelesnyaDeck,
  createDimirDeck,
  createIzzetDeck,
  createSimicDeck,
  createRakdosDeck,
  createGolgariDeck,
  createGruulDeck,
  createWhiteWeenie,
  createBlueControl,
  createBlackAggro,
  createRedBurn,
  createGreenMidrange,
  createArtifactDeck,
  createColorHateDeck,
  createArtifactsDeck2,
  createSpellsDeck,
  createCreaturesDeck,
  createUncoveredDeck,
};

// Re-export types
export type { DeckColor, TwoColorDeck, CompetitiveDeck, SpecialDeck };
export { MONO_DECKS, TWO_COLOR_DECKS, COMPETITIVE_DECKS, SPECIAL_DECKS };

/**
 * All test decks combined
 */
export type AllDeckTypes = DeckColor | TwoColorDeck | SpecialDeck | CompetitiveDeck;

export const ALL_TEST_DECKS: Record<AllDeckTypes, () => CardTemplate[]> = {
  ...MONO_DECKS,
  ...TWO_COLOR_DECKS,
  ...SPECIAL_DECKS,
  ...COMPETITIVE_DECKS,
};

/**
 * Legacy alias for backwards compatibility
 */
export const TEST_DECKS = MONO_DECKS;

/**
 * Get a random test deck from ALL decks (full coverage)
 */
export function getRandomTestDeck(): CardTemplate[] {
  const allDeckNames = Object.keys(ALL_TEST_DECKS) as AllDeckTypes[];
  const randomDeck = allDeckNames[Math.floor(Math.random() * allDeckNames.length)]!;
  return ALL_TEST_DECKS[randomDeck]();
}

/**
 * Get a random mono-color deck only
 */
export function getRandomMonoDeck(): CardTemplate[] {
  const colors: DeckColor[] = ['white', 'blue', 'black', 'red', 'green'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)]!;
  return MONO_DECKS[randomColor]();
}

/**
 * Get a specific test deck by name
 */
export function getTestDeck(deckName: AllDeckTypes): CardTemplate[] {
  return ALL_TEST_DECKS[deckName]();
}

// =============================================================================
// WEIGHTED DECK SELECTION (AI Training)
// =============================================================================

/**
 * Deck tier weights for MCTS training
 * Balances diversity vs. complexity for generalist bot training
 */
export interface DeckTierWeights {
  mono: number; // 5 decks - simple, fast games
  twoColor: number; // 10 decks - more strategic variety
  competitive: number; // 5 decks - optimized archetypes
  special: number; // 6 decks - edge cases, card coverage
}

/**
 * Default weights for generalist MCTS training
 */
export const DEFAULT_MCTS_WEIGHTS: DeckTierWeights = {
  mono: 0.25,
  twoColor: 0.35,
  competitive: 0.25,
  special: 0.15,
};

/**
 * Weights emphasizing simpler games (early training / curriculum start)
 */
export const SIMPLE_WEIGHTS: DeckTierWeights = {
  mono: 0.6,
  twoColor: 0.25,
  competitive: 0.1,
  special: 0.05,
};

/**
 * Weights emphasizing complex games (late training / curriculum end)
 */
export const COMPLEX_WEIGHTS: DeckTierWeights = {
  mono: 0.1,
  twoColor: 0.3,
  competitive: 0.4,
  special: 0.2,
};

/**
 * Get deck tier for a given deck name
 */
export function getDeckTier(
  deckName: AllDeckTypes,
): 'mono' | 'twoColor' | 'competitive' | 'special' {
  if (deckName in MONO_DECKS) return 'mono';
  if (deckName in TWO_COLOR_DECKS) return 'twoColor';
  if (deckName in COMPETITIVE_DECKS) return 'competitive';
  return 'special';
}

/**
 * Get a random deck using tier-based weighting
 * First selects a tier based on weights, then picks uniformly within that tier
 */
export function getWeightedRandomDeck(
  weights: DeckTierWeights = DEFAULT_MCTS_WEIGHTS,
): CardTemplate[] {
  const roll = Math.random();
  let cumulative = 0;

  // Select tier based on weights
  cumulative += weights.mono;
  if (roll < cumulative) {
    return getRandomMonoDeck();
  }

  cumulative += weights.twoColor;
  if (roll < cumulative) {
    const twoColorNames = Object.keys(TWO_COLOR_DECKS) as TwoColorDeck[];
    const randomName = twoColorNames[Math.floor(Math.random() * twoColorNames.length)]!;
    return TWO_COLOR_DECKS[randomName]();
  }

  cumulative += weights.competitive;
  if (roll < cumulative) {
    const competitiveNames = Object.keys(COMPETITIVE_DECKS) as CompetitiveDeck[];
    const randomName = competitiveNames[Math.floor(Math.random() * competitiveNames.length)]!;
    return COMPETITIVE_DECKS[randomName]();
  }

  // Special decks (fallback)
  const specialNames = Object.keys(SPECIAL_DECKS) as SpecialDeck[];
  const randomName = specialNames[Math.floor(Math.random() * specialNames.length)]!;
  return SPECIAL_DECKS[randomName]();
}

/**
 * Get a random deck weighted toward a specific deck (for specialist training)
 * @param targetDeck - The deck to favor
 * @param targetWeight - Weight for target deck (0-1), remainder split among others
 */
export function getSpecialistRandomDeck(
  targetDeck: AllDeckTypes,
  targetWeight: number = 0.7,
): CardTemplate[] {
  if (Math.random() < targetWeight) {
    return ALL_TEST_DECKS[targetDeck]();
  }
  // Pick from all other decks uniformly
  const allDeckNames = Object.keys(ALL_TEST_DECKS) as AllDeckTypes[];
  const otherDecks = allDeckNames.filter((name) => name !== targetDeck);
  const randomDeck = otherDecks[Math.floor(Math.random() * otherDecks.length)]!;
  return ALL_TEST_DECKS[randomDeck]();
}

/**
 * Get deck name for display (used in simulation output)
 */
export function getDeckDisplayName(deck: CardTemplate[]): string {
  // Check for specific competitive decks by card composition
  const cardNames = deck.map((c) => c.name);

  // White Weenie signature: Tundra Wolves + Samite Healer + Longbow Archer
  if (
    cardNames.includes('Tundra Wolves') &&
    cardNames.includes('Samite Healer') &&
    cardNames.includes('Longbow Archer')
  ) {
    return 'white_weenie';
  }

  // Blue Control signature: Counterspell + Power Sink + Air Elemental
  if (
    cardNames.includes('Counterspell') &&
    cardNames.includes('Power Sink') &&
    cardNames.includes('Air Elemental')
  ) {
    return 'blue_control';
  }

  // Black Aggro signature: Bog Rats + Python + Regeneration (aura)
  if (
    cardNames.includes('Bog Rats') &&
    cardNames.includes('Python') &&
    cardNames.includes('Regeneration')
  ) {
    return 'black_aggro';
  }

  // Red Burn signature: Shock + Hammer of Bogardan + Stone Rain
  if (
    cardNames.includes('Shock') &&
    cardNames.includes('Hammer of Bogardan') &&
    cardNames.includes('Stone Rain')
  ) {
    return 'red_burn';
  }

  // Green Midrange signature: River Boa + Gorilla Chieftain + Hurricane
  if (
    cardNames.includes('River Boa') &&
    cardNames.includes('Gorilla Chieftain') &&
    cardNames.includes('Hurricane')
  ) {
    return 'green_midrange';
  }

  // Identify deck based on land types
  const lands = deck.filter((c) => c.type_line?.includes('Land'));

  // Check for color combinations based on lands
  const hasPlains = lands.some(
    (l) => l.name === 'Plains' || l.name?.includes('Wastes') || l.name?.includes('Brushland'),
  );
  const hasIsland = lands.some(
    (l) => l.name === 'Island' || l.name?.includes('River') || l.name?.includes('Wastes'),
  );
  const hasSwamp = lands.some(
    (l) => l.name === 'Swamp' || l.name?.includes('River') || l.name?.includes('Stronghold'),
  );
  const hasMountain = lands.some(
    (l) => l.name === 'Mountain' || l.name?.includes('Springs') || l.name?.includes('Ruins'),
  );
  const hasForest = lands.some(
    (l) => l.name === 'Forest' || l.name?.includes('Brushland') || l.name?.includes('Battleground'),
  );

  const colorCount = [hasPlains, hasIsland, hasSwamp, hasMountain, hasForest].filter(
    Boolean,
  ).length;

  if (colorCount === 0 || lands.some((l) => l.name === 'Crystal Vein')) return 'artifact';
  if (colorCount >= 3) return 'multicolor';

  if (hasPlains && hasIsland) return 'azorius';
  if (hasPlains && hasSwamp) return 'orzhov';
  if (hasPlains && hasMountain) return 'boros';
  if (hasPlains && hasForest) return 'selesnya';
  if (hasIsland && hasSwamp) return 'dimir';
  if (hasIsland && hasMountain) return 'izzet';
  if (hasIsland && hasForest) return 'simic';
  if (hasSwamp && hasMountain) return 'rakdos';
  if (hasSwamp && hasForest) return 'golgari';
  if (hasMountain && hasForest) return 'gruul';

  if (hasPlains) return 'white';
  if (hasIsland) return 'blue';
  if (hasSwamp) return 'black';
  if (hasMountain) return 'red';
  if (hasForest) return 'green';

  return 'unknown';
}
