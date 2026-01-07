/**
 * AI-Optimized Shuffle Tests
 *
 * Verifies that the AI-optimized shuffle ensures playable games:
 * 1. Opening hand (7 cards) has 2-3 lands
 * 2. Opening hand has at least one 1-drop or 2-drop
 * 3. Opening hand has at least 2 playable spells (CMC ≤ 3)
 * 4. Library has no more than 3 consecutive non-lands
 * 5. Library has no more than 2 consecutive lands
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  initializeGame,
  aiOptimizedShuffle,
  createGreenDeck,
  createRedDeck,
  createBlueDeck,
  createWhiteDeck,
  createBlackDeck,
  isLand,
  CardLoader,
  _resetInstanceCounter,
  _resetModificationCounter,
  _resetStackCounter,
} from '../src/index';
import type { CardTemplate, GameState } from '../src/index';

// Initialize CardLoader for tests
CardLoader.initialize();

/**
 * Count lands in a card array
 */
function countLands(cards: CardTemplate[]): number {
  return cards.filter((c) => isLand(c)).length;
}

/**
 * Count cards with CMC 1 or 2
 */
function countLowDrops(cards: CardTemplate[]): number {
  return cards.filter((c) => !isLand(c) && (c.cmc === 1 || c.cmc === 2)).length;
}

/**
 * Count playable spells (CMC ≤ 3)
 */
function countPlayableSpells(cards: CardTemplate[]): number {
  return cards.filter((c) => !isLand(c) && c.cmc <= 3).length;
}

/**
 * Get the opening hand from a shuffled deck
 * (Last 7 cards, since library.pop() draws from end)
 */
function getOpeningHand(shuffledDeck: CardTemplate[]): CardTemplate[] {
  return shuffledDeck.slice(-7);
}

/**
 * Get the library from a shuffled deck (after hand is drawn)
 */
function getLibrary(shuffledDeck: CardTemplate[]): CardTemplate[] {
  return shuffledDeck.slice(0, -7);
}

/**
 * Check if library has more than N consecutive lands
 */
function hasConsecutiveLands(library: CardTemplate[], maxConsecutive: number): boolean {
  let consecutive = 0;
  for (const card of library) {
    if (isLand(card)) {
      consecutive++;
      if (consecutive > maxConsecutive) return true;
    } else {
      consecutive = 0;
    }
  }
  return false;
}

/**
 * Check if library has more than N consecutive non-lands
 */
function hasConsecutiveNonLands(library: CardTemplate[], maxConsecutive: number): boolean {
  let consecutive = 0;
  for (const card of library) {
    if (!isLand(card)) {
      consecutive++;
      if (consecutive > maxConsecutive) return true;
    } else {
      consecutive = 0;
    }
  }
  return false;
}

describe('AI-Optimized Shuffle', () => {
  beforeEach(() => {
    _resetInstanceCounter();
    _resetModificationCounter();
    _resetStackCounter();
  });

  describe('Opening Hand Constraints', () => {
    test('opening hand has 2-3 lands (Green deck)', () => {
      const deck = createGreenDeck();

      // Run multiple trials to verify consistency
      for (let seed = 0; seed < 50; seed++) {
        const shuffled = aiOptimizedShuffle([...deck], seed);
        const hand = getOpeningHand(shuffled);
        const landCount = countLands(hand);

        expect(landCount).toBeGreaterThanOrEqual(2);
        expect(landCount).toBeLessThanOrEqual(3);
      }
    });

    test('opening hand has 2-3 lands (all deck types)', () => {
      const decks = [
        createGreenDeck(),
        createRedDeck(),
        createBlueDeck(),
        createWhiteDeck(),
        createBlackDeck(),
      ];

      for (const deck of decks) {
        for (let seed = 0; seed < 20; seed++) {
          const shuffled = aiOptimizedShuffle([...deck], seed);
          const hand = getOpeningHand(shuffled);
          const landCount = countLands(hand);

          expect(landCount).toBeGreaterThanOrEqual(2);
          expect(landCount).toBeLessThanOrEqual(3);
        }
      }
    });

    test('opening hand has at least one 1-drop or 2-drop', () => {
      const deck = createGreenDeck();

      for (let seed = 0; seed < 50; seed++) {
        const shuffled = aiOptimizedShuffle([...deck], seed);
        const hand = getOpeningHand(shuffled);
        const lowDropCount = countLowDrops(hand);

        // Green deck has Llanowar Elves (1 CMC) and Grizzly Bears (2 CMC)
        expect(lowDropCount).toBeGreaterThanOrEqual(1);
      }
    });

    test('opening hand has at least 2 playable spells (CMC ≤ 3)', () => {
      const deck = createRedDeck();

      for (let seed = 0; seed < 50; seed++) {
        const shuffled = aiOptimizedShuffle([...deck], seed);
        const hand = getOpeningHand(shuffled);
        const playableCount = countPlayableSpells(hand);

        expect(playableCount).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Library Mana Weaving Constraints', () => {
    test('library has no more than 3 consecutive non-lands', () => {
      const deck = createGreenDeck();

      for (let seed = 0; seed < 50; seed++) {
        const shuffled = aiOptimizedShuffle([...deck], seed);
        const library = getLibrary(shuffled);

        expect(hasConsecutiveNonLands(library, 3)).toBe(false);
      }
    });

    test('library has no more than 2 consecutive lands', () => {
      const deck = createGreenDeck();

      for (let seed = 0; seed < 50; seed++) {
        const shuffled = aiOptimizedShuffle([...deck], seed);
        const library = getLibrary(shuffled);

        expect(hasConsecutiveLands(library, 2)).toBe(false);
      }
    });

    test('mana weaving constraints hold for all deck types', () => {
      const decks = [
        createGreenDeck(),
        createRedDeck(),
        createBlueDeck(),
        createWhiteDeck(),
        createBlackDeck(),
      ];

      for (const deck of decks) {
        for (let seed = 0; seed < 20; seed++) {
          const shuffled = aiOptimizedShuffle([...deck], seed);
          const library = getLibrary(shuffled);

          expect(hasConsecutiveNonLands(library, 3)).toBe(false);
          expect(hasConsecutiveLands(library, 2)).toBe(false);
        }
      }
    });
  });

  describe('Deck Integrity', () => {
    test('shuffled deck has same cards as original', () => {
      const deck = createGreenDeck();
      const shuffled = aiOptimizedShuffle([...deck], 12345);

      expect(shuffled.length).toBe(deck.length);

      // Count each card by name
      const originalCounts = new Map<string, number>();
      const shuffledCounts = new Map<string, number>();

      for (const card of deck) {
        originalCounts.set(card.name, (originalCounts.get(card.name) || 0) + 1);
      }
      for (const card of shuffled) {
        shuffledCounts.set(card.name, (shuffledCounts.get(card.name) || 0) + 1);
      }

      expect(shuffledCounts).toEqual(originalCounts);
    });

    test('shuffled deck length is 60 cards', () => {
      const decks = [createGreenDeck(), createRedDeck(), createBlueDeck(), createWhiteDeck()];

      for (const deck of decks) {
        const shuffled = aiOptimizedShuffle([...deck], 999);
        expect(shuffled.length).toBe(60);
      }
    });
  });

  describe('Determinism', () => {
    test('same seed produces identical shuffle', () => {
      const deck = createGreenDeck();
      const seed = 42;

      const shuffled1 = aiOptimizedShuffle([...deck], seed);
      const shuffled2 = aiOptimizedShuffle([...deck], seed);

      expect(shuffled1.length).toBe(shuffled2.length);
      for (let i = 0; i < shuffled1.length; i++) {
        expect(shuffled1[i]!.id).toBe(shuffled2[i]!.id);
      }
    });

    test('different seeds produce different shuffles', () => {
      const deck = createGreenDeck();

      const shuffled1 = aiOptimizedShuffle([...deck], 100);
      const shuffled2 = aiOptimizedShuffle([...deck], 200);

      // At least one card should be in a different position
      let hasDifference = false;
      for (let i = 0; i < shuffled1.length; i++) {
        if (shuffled1[i]!.id !== shuffled2[i]!.id) {
          hasDifference = true;
          break;
        }
      }
      expect(hasDifference).toBe(true);
    });
  });

  describe('Game Integration', () => {
    test('initializeGame uses AI-optimized shuffle by default', () => {
      const playerDeck = createGreenDeck();
      const opponentDeck = createRedDeck();

      for (let seed = 0; seed < 20; seed++) {
        _resetInstanceCounter();
        _resetModificationCounter();

        const state = initializeGame(playerDeck, opponentDeck, seed);

        // Check player hand
        const playerHand = state.players.player.hand;
        const playerLands = playerHand.filter((c) => {
          const template = CardLoader.getById(c.scryfallId);
          return template && isLand(template);
        }).length;

        expect(playerLands).toBeGreaterThanOrEqual(2);
        expect(playerLands).toBeLessThanOrEqual(3);

        // Check opponent hand
        const opponentHand = state.players.opponent.hand;
        const opponentLands = opponentHand.filter((c) => {
          const template = CardLoader.getById(c.scryfallId);
          return template && isLand(template);
        }).length;

        expect(opponentLands).toBeGreaterThanOrEqual(2);
        expect(opponentLands).toBeLessThanOrEqual(3);
      }
    });

    test('both players get 7 cards in opening hand', () => {
      const state = initializeGame(createGreenDeck(), createRedDeck(), 12345);

      expect(state.players.player.hand.length).toBe(7);
      expect(state.players.opponent.hand.length).toBe(7);
    });

    test('libraries have 53 cards after opening hand', () => {
      const state = initializeGame(createGreenDeck(), createRedDeck(), 12345);

      expect(state.players.player.library.length).toBe(53);
      expect(state.players.opponent.library.length).toBe(53);
    });
  });

  describe('Statistical Distribution', () => {
    test('land distribution in opener is roughly 40% 2-land, 60% 3-land', () => {
      const deck = createGreenDeck();
      let twoLandCount = 0;
      let threeLandCount = 0;
      const trials = 1000;

      for (let seed = 0; seed < trials; seed++) {
        const shuffled = aiOptimizedShuffle([...deck], seed);
        const hand = getOpeningHand(shuffled);
        const landCount = countLands(hand);

        if (landCount === 2) twoLandCount++;
        else if (landCount === 3) threeLandCount++;
      }

      // Should be roughly 40% 2-land, 60% 3-land (with some tolerance)
      const twoLandPct = twoLandCount / trials;
      const threeLandPct = threeLandCount / trials;

      expect(twoLandPct).toBeGreaterThan(0.25); // At least 25% 2-land
      expect(twoLandPct).toBeLessThan(0.55); // At most 55% 2-land
      expect(threeLandPct).toBeGreaterThan(0.45); // At least 45% 3-land
      expect(threeLandPct).toBeLessThan(0.75); // At most 75% 3-land

      // Together they should account for all hands
      expect(twoLandCount + threeLandCount).toBe(trials);
    });
  });
});
