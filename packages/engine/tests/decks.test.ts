/**
 * Test Deck Validation
 *
 * Tests for the 5 mono-colored test decks created in Week 11.
 * Verifies that all decks:
 * - Have exactly 60 cards
 * - Contain only valid cards from the card pool
 * - Can be used in game initialization
 */

import { describe, test, expect } from 'bun:test';
import {
  CardLoader,
  createWhiteDeck,
  createBlueDeck,
  createBlackDeck,
  createRedDeck,
  createGreenDeck,
  getRandomTestDeck,
  getTestDeck,
  TEST_DECKS,
  initializeGame,
  type DeckColor,
} from '../src/index';

describe('Mono-Colored Test Decks', () => {
  describe('White Deck', () => {
    test('has exactly 60 cards', () => {
      const deck = createWhiteDeck();
      expect(deck.length).toBe(60);
    });

    test('contains only white cards and Plains', () => {
      const deck = createWhiteDeck();
      for (const card of deck) {
        // Should be white or colorless (Plains)
        expect(
          card.colors.includes('W') || card.colors.length === 0 || card.type_line.includes('Land'),
        ).toBe(true);
      }
    });

    test('contains expected cards', () => {
      const deck = createWhiteDeck();
      const cardNames = deck.map((c) => c.name);

      expect(cardNames.filter((n) => n === 'Plains').length).toBe(24);
      expect(cardNames.filter((n) => n === 'Tundra Wolves').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Infantry Veteran').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Longbow Archer').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Pacifism').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Exile').length).toBe(4);
    });
  });

  describe('Blue Deck', () => {
    test('has exactly 60 cards', () => {
      const deck = createBlueDeck();
      expect(deck.length).toBe(60);
    });

    test('contains only blue cards and Islands', () => {
      const deck = createBlueDeck();
      for (const card of deck) {
        expect(
          card.colors.includes('U') || card.colors.length === 0 || card.type_line.includes('Land'),
        ).toBe(true);
      }
    });

    test('contains expected cards', () => {
      const deck = createBlueDeck();
      const cardNames = deck.map((c) => c.name);

      expect(cardNames.filter((n) => n === 'Island').length).toBe(24);
      expect(cardNames.filter((n) => n === 'Merfolk of the Pearl Trident').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Sage Owl').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Phantom Warrior').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Air Elemental').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Counterspell').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Unsummon').length).toBe(4);
    });
  });

  describe('Black Deck', () => {
    test('has exactly 60 cards', () => {
      const deck = createBlackDeck();
      expect(deck.length).toBe(60);
    });

    test('contains only black cards and Swamps', () => {
      const deck = createBlackDeck();
      for (const card of deck) {
        expect(
          card.colors.includes('B') || card.colors.length === 0 || card.type_line.includes('Land'),
        ).toBe(true);
      }
    });

    test('contains expected cards', () => {
      const deck = createBlackDeck();
      const cardNames = deck.map((c) => c.name);

      expect(cardNames.filter((n) => n === 'Swamp').length).toBe(24);
      expect(cardNames.filter((n) => n === 'Bog Rats').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Drudge Skeletons').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Bog Imp').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Terror').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Dry Spell').length).toBe(4);
    });
  });

  describe('Red Deck', () => {
    test('has exactly 60 cards', () => {
      const deck = createRedDeck();
      expect(deck.length).toBe(60);
    });

    test('contains only red cards and Mountains', () => {
      const deck = createRedDeck();
      for (const card of deck) {
        expect(
          card.colors.includes('R') || card.colors.length === 0 || card.type_line.includes('Land'),
        ).toBe(true);
      }
    });

    test('contains expected cards', () => {
      const deck = createRedDeck();
      const cardNames = deck.map((c) => c.name);

      expect(cardNames.filter((n) => n === 'Mountain').length).toBe(22);
      expect(cardNames.filter((n) => n === 'Raging Goblin').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Balduvian Barbarians').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Anaba Shaman').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Lightning Blast').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Shock').length).toBe(4);
    });
  });

  describe('Green Deck', () => {
    test('has exactly 60 cards', () => {
      const deck = createGreenDeck();
      expect(deck.length).toBe(60);
    });

    test('contains only green cards and Forests', () => {
      const deck = createGreenDeck();
      for (const card of deck) {
        expect(
          card.colors.includes('G') || card.colors.length === 0 || card.type_line.includes('Land'),
        ).toBe(true);
      }
    });

    test('contains expected cards', () => {
      const deck = createGreenDeck();
      const cardNames = deck.map((c) => c.name);

      expect(cardNames.filter((n) => n === 'Forest').length).toBe(20);
      expect(cardNames.filter((n) => n === 'Llanowar Elves').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Birds of Paradise').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Grizzly Bears').length).toBe(4);
      expect(cardNames.filter((n) => n === 'Giant Growth').length).toBe(4);
    });
  });
});

describe('Deck Utilities', () => {
  test('getRandomTestDeck returns a valid 60-card deck', () => {
    // Run multiple times to ensure randomness works
    for (let i = 0; i < 10; i++) {
      const deck = getRandomTestDeck();
      expect(deck.length).toBe(60);
    }
  });

  test('getTestDeck returns correct deck for each color', () => {
    const colors: DeckColor[] = ['white', 'blue', 'black', 'red', 'green'];

    for (const color of colors) {
      const deck = getTestDeck(color);
      expect(deck.length).toBe(60);
    }
  });

  test('TEST_DECKS contains all 5 colors', () => {
    expect(Object.keys(TEST_DECKS)).toEqual(['white', 'blue', 'black', 'red', 'green']);
  });
});

describe('Deck Game Initialization', () => {
  test('White vs Blue game initializes correctly', () => {
    const whiteDeck = createWhiteDeck();
    const blueDeck = createBlueDeck();
    const state = initializeGame(whiteDeck, blueDeck);

    expect(state.players.player.hand.length).toBe(7);
    expect(state.players.opponent.hand.length).toBe(7);
    expect(state.players.player.library.length).toBe(53); // 60 - 7
    expect(state.players.opponent.library.length).toBe(53);
  });

  test('Black vs Red game initializes correctly', () => {
    const blackDeck = createBlackDeck();
    const redDeck = createRedDeck();
    const state = initializeGame(blackDeck, redDeck);

    expect(state.players.player.hand.length).toBe(7);
    expect(state.players.opponent.hand.length).toBe(7);
  });

  test('Green vs Green game initializes correctly', () => {
    const greenDeck = createGreenDeck();
    const state = initializeGame(greenDeck, greenDeck);

    expect(state.players.player.hand.length).toBe(7);
    expect(state.players.opponent.hand.length).toBe(7);
  });

  test('Random deck matchups initialize correctly', () => {
    // Test 10 random matchups
    for (let i = 0; i < 10; i++) {
      const deck1 = getRandomTestDeck();
      const deck2 = getRandomTestDeck();
      const state = initializeGame(deck1, deck2);

      expect(state.players.player.hand.length).toBe(7);
      expect(state.players.opponent.hand.length).toBe(7);
      expect(state.phase).toBe('main1');
    }
  });
});
