/**
 * Game initialization utilities
 *
 * AI-Optimized Shuffle (default):
 * - Opening hand (7 cards) always has 2-3 lands, at least one 1-2 drop, and playable spells
 * - Library is mana-weaved: no more than 3 consecutive non-lands, no more than 2 consecutive lands
 * - This eliminates mana screw/flood for AI training, ensuring every turn has meaningful decisions
 */

import type { GameState, CardTemplate, PlayerId } from '../index';
import { createGameState, createCardInstance, isLand } from '../index';

/**
 * Shuffle an array in place using Fisher-Yates algorithm
 */
export function shuffle<T>(array: T[], seed?: number): T[] {
  const rng = seed !== undefined ? createSeededRandom(seed) : Math.random;

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }

  return array;
}

/**
 * Create a seeded random number generator (Linear Congruential Generator)
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * AI-Optimized Shuffle
 *
 * Ensures playable games by:
 * 1. Guaranteeing 2-3 lands in opening hand
 * 2. Guaranteeing at least one 1-drop or 2-drop in opening hand
 * 3. Guaranteeing at least 2 playable spells (CMC ≤ 3) in opening hand
 * 4. Mana weaving the library (no more than 3 non-lands or 2 lands in a row)
 *
 * Note: library.pop() draws from the END of the array, so the last 7 elements become the hand.
 *
 * IMPORTANT: Deck cards may share object references (e.g., 20 Forests all point to the same
 * CardTemplate), so we track by index rather than object identity.
 */
export function aiOptimizedShuffle(deck: CardTemplate[], seed?: number): CardTemplate[] {
  const rng = seed !== undefined ? createSeededRandom(seed) : Math.random;

  // Create index arrays for lands and non-lands
  const landIndices: number[] = [];
  const nonLandIndices: number[] = [];

  for (let i = 0; i < deck.length; i++) {
    if (isLand(deck[i]!)) {
      landIndices.push(i);
    } else {
      nonLandIndices.push(i);
    }
  }

  // Shuffle index arrays
  shuffleIndices(landIndices, rng);
  shuffleIndices(nonLandIndices, rng);

  // Build the opening hand (7 cards) by selecting indices
  const { handIndices, remainingLandIndices, remainingNonLandIndices } = buildOpeningHandIndices(
    deck,
    landIndices,
    nonLandIndices,
    rng,
  );

  // Mana weave the library indices
  const libraryIndices = manaWeaveLibraryIndices(
    deck,
    remainingLandIndices,
    remainingNonLandIndices,
    rng,
  );

  // Build the final deck: library first, then hand (since pop() draws from end)
  const result: CardTemplate[] = [];
  for (const idx of libraryIndices) {
    result.push(deck[idx]!);
  }
  for (const idx of handIndices) {
    result.push(deck[idx]!);
  }

  return result;
}

/**
 * Shuffle an array of indices in place
 */
function shuffleIndices(indices: number[], rng: () => number): void {
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
}

/**
 * Build a guaranteed playable opening hand using indices
 *
 * Requirements:
 * - 2-3 lands
 * - At least one 1-drop or 2-drop
 * - At least 2 playable spells (CMC ≤ 3)
 * - 7 cards total
 */
function buildOpeningHandIndices(
  deck: CardTemplate[],
  landIndices: number[],
  nonLandIndices: number[],
  rng: () => number,
): {
  handIndices: number[];
  remainingLandIndices: number[];
  remainingNonLandIndices: number[];
} {
  const handIndices: number[] = [];
  const usedLandCount = { value: 0 };
  const usedNonLandCount = { value: 0 };

  // Helper to pick the next available index from a list
  const pickNextIndex = (
    indices: number[],
    usedCount: { value: number },
    filter?: (card: CardTemplate) => boolean,
  ): number | null => {
    for (let i = usedCount.value; i < indices.length; i++) {
      const idx = indices[i]!;
      if (!filter || filter(deck[idx]!)) {
        // Swap to the front of unused section
        [indices[usedCount.value], indices[i]] = [indices[i]!, indices[usedCount.value]!];
        usedCount.value++;
        return indices[usedCount.value - 1]!;
      }
    }
    return null;
  };

  // Step 1: Add 2-3 lands (decide randomly, bias toward 3 for smoother play)
  const targetLands = rng() < 0.6 ? 3 : 2;
  for (let i = 0; i < targetLands; i++) {
    const idx = pickNextIndex(landIndices, usedLandCount);
    if (idx !== null) {
      handIndices.push(idx);
    }
  }

  // Step 2: Add at least one 1-drop or 2-drop (CMC 1 or 2)
  const lowDropIdx = pickNextIndex(
    nonLandIndices,
    usedNonLandCount,
    (c) => c.cmc === 1 || c.cmc === 2,
  );
  if (lowDropIdx !== null) {
    handIndices.push(lowDropIdx);
  }

  // Step 3: Add another playable spell (CMC ≤ 3) to ensure at least 2 playable spells
  const playableIdx = pickNextIndex(nonLandIndices, usedNonLandCount, (c) => c.cmc <= 3);
  if (playableIdx !== null) {
    handIndices.push(playableIdx);
  }

  // Step 4: Fill remaining slots (up to 7) with random non-lands, then lands if needed
  while (handIndices.length < 7) {
    let idx = pickNextIndex(nonLandIndices, usedNonLandCount);
    if (idx === null) {
      // Fallback: use remaining lands
      idx = pickNextIndex(landIndices, usedLandCount);
    }
    if (idx !== null) {
      handIndices.push(idx);
    } else {
      break; // Deck is too small
    }
  }

  // Shuffle the hand indices so the order isn't predictable
  shuffleIndices(handIndices, rng);

  return {
    handIndices,
    remainingLandIndices: landIndices.slice(usedLandCount.value),
    remainingNonLandIndices: nonLandIndices.slice(usedNonLandCount.value),
  };
}

/**
 * Mana weave the library indices to prevent mana screw/flood
 *
 * Constraints:
 * - No more than 3 consecutive non-lands
 * - No more than 2 consecutive lands
 *
 * This ensures players always have land drops and always have spells to cast.
 *
 * Algorithm: We use a slot-based approach where lands are evenly distributed
 * among non-lands. Each "slot" gets 1-3 non-lands followed by 1-2 lands.
 * The distribution is calculated to ensure lands last until the end.
 */
function manaWeaveLibraryIndices(
  _deck: CardTemplate[],
  landIndices: number[],
  nonLandIndices: number[],
  rng: () => number,
): number[] {
  const lands = [...landIndices];
  const nonLands = [...nonLandIndices];

  // Shuffle both piles for randomness
  shuffleIndices(lands, rng);
  shuffleIndices(nonLands, rng);

  // If no lands or no non-lands, just return what we have
  if (lands.length === 0) return nonLands;
  if (nonLands.length === 0) return lands;

  // Calculate how to distribute:
  // We want to spread L lands among N non-lands
  // Pattern: some non-lands, then a land (or two), repeat
  // Max 3 consecutive non-lands, max 2 consecutive lands

  const result: number[] = [];
  let landPtr = 0;
  let nonLandPtr = 0;

  while (nonLandPtr < nonLands.length || landPtr < lands.length) {
    const nonLandsRemaining = nonLands.length - nonLandPtr;
    const landsRemaining = lands.length - landPtr;

    if (nonLandsRemaining > 0) {
      // Calculate how many non-lands to place in this group
      // We want to use up non-lands evenly across remaining lands
      const groupsRemaining = landsRemaining > 0 ? landsRemaining : 1;
      const idealNonLandsPerGroup = Math.ceil(nonLandsRemaining / groupsRemaining);
      const nonLandsInThisGroup = Math.min(3, idealNonLandsPerGroup, nonLandsRemaining);

      // Place the non-lands
      for (let i = 0; i < nonLandsInThisGroup; i++) {
        result.push(nonLands[nonLandPtr++]!);
      }
    }

    // Place 1-2 lands (if we have any)
    if (landsRemaining > 0) {
      const nonLandsStillRemaining = nonLands.length - nonLandPtr;
      // Calculate if we can afford to place 2 lands
      // We need enough lands for future groups
      const futureGroups = Math.ceil(nonLandsStillRemaining / 3);
      const canPlace2 = landsRemaining > futureGroups && rng() < 0.3; // 30% chance if affordable

      const landsInThisGroup = canPlace2 ? 2 : 1;
      for (let i = 0; i < Math.min(landsInThisGroup, landsRemaining); i++) {
        result.push(lands[landPtr++]!);
      }
    }

    // Safety: if we've placed all non-lands but still have lands, add them
    if (nonLandPtr >= nonLands.length && landPtr < lands.length) {
      while (landPtr < lands.length) {
        result.push(lands[landPtr++]!);
      }
      break;
    }
  }

  return result;
}

/**
 * Initialize a game with two decks
 *
 * Uses AI-optimized shuffle by default to ensure playable games:
 * - 2-3 lands in opening hand
 * - At least one 1-drop or 2-drop
 * - Mana-weaved library (no mana screw/flood)
 */
export function initializeGame(
  playerDeck: CardTemplate[],
  opponentDeck: CardTemplate[],
  seed?: number,
): GameState {
  // Use AI-optimized shuffle for playable games (prevents mana screw/flood)
  const shuffledPlayerDeck = aiOptimizedShuffle([...playerDeck], seed);
  const shuffledOpponentDeck = aiOptimizedShuffle([...opponentDeck], seed ? seed + 1 : undefined);

  // Create card instances
  const playerLibrary = shuffledPlayerDeck.map((card) =>
    createCardInstance(card.id, 'player', 'library'),
  );

  const opponentLibrary = shuffledOpponentDeck.map((card) =>
    createCardInstance(card.id, 'opponent', 'library'),
  );

  // Create game state
  const state = createGameState(playerLibrary, opponentLibrary, seed);

  // Draw opening hands (7 cards)
  for (let i = 0; i < 7; i++) {
    drawCard(state, 'player');
    drawCard(state, 'opponent');
  }

  // Set to main phase (skip untap/draw for turn 1)
  state.phase = 'main1';
  state.step = 'main';

  return state;
}

/**
 * Draw a card from library to hand
 */
function drawCard(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId];
  const card = player.library.pop();

  if (card) {
    card.zone = 'hand';
    player.hand.push(card);
  }
}

// =============================================================================
// DECK EXPORTS (Moved to ../decks/)
// =============================================================================

export {
  createSimpleDeck,
  // Mono-colored test decks
  createWhiteDeck,
  createBlueDeck,
  createBlackDeck,
  createRedDeck,
  createGreenDeck,
  // Phase 1.5: Two-color test decks
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
  // Phase 1.5: Special coverage decks
  createArtifactDeck,
  createColorHateDeck,
  createArtifactsDeck2,
  createSpellsDeck,
  createCreaturesDeck,
  createUncoveredDeck,
  // Competitive decks
  createWhiteWeenie,
  createBlueControl,
  createBlackAggro,
  createRedBurn,
  createGreenMidrange,
  // Registries
  MONO_DECKS,
  TWO_COLOR_DECKS,
  COMPETITIVE_DECKS,
  SPECIAL_DECKS,
  ALL_TEST_DECKS,
  TEST_DECKS,
  // Helpers
  getRandomTestDeck,
  getRandomMonoDeck,
  getTestDeck,
  getDeckDisplayName,
  // Weighted deck selection (AI Training)
  getWeightedRandomDeck,
  getSpecialistRandomDeck,
  getDeckTier,
  DEFAULT_MCTS_WEIGHTS,
  SIMPLE_WEIGHTS,
  COMPLEX_WEIGHTS,
  type DeckTierWeights,
  // Types
  type DeckColor,
  type TwoColorDeck,
  type CompetitiveDeck,
  type SpecialDeck,
  type AllDeckTypes,
} from '../decks';
