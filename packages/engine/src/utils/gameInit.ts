/**
 * Game initialization utilities
 */

import type { GameState, CardTemplate, PlayerId } from '../index';
import { createGameState, createCardInstance } from '../index';
import { CardLoader } from '../cards/CardLoader';

/**
 * Shuffle an array in place
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
 * Create a seeded random number generator
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Create a simple deck (for testing)
 */
export function createSimpleDeck(deckList: Array<{ name: string; count: number }>): CardTemplate[] {
  const cards: CardTemplate[] = [];

  for (const entry of deckList) {
    const template = CardLoader.getByName(entry.name);
    if (!template) {
      console.warn(`Card not found: ${entry.name}`);
      continue;
    }

    for (let i = 0; i < entry.count; i++) {
      cards.push(template);
    }
  }

  return cards;
}

/**
 * Initialize a game with two decks
 */
export function initializeGame(
  playerDeck: CardTemplate[],
  opponentDeck: CardTemplate[],
  seed?: number,
): GameState {
  // Shuffle decks
  const shuffledPlayerDeck = shuffle([...playerDeck], seed);
  const shuffledOpponentDeck = shuffle([...opponentDeck], seed ? seed + 1 : undefined);

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

/**
 * Create a vanilla creature deck for testing
 * Aggressive deck with low-cost creatures to ensure games finish quickly
 */
export function createVanillaDeck(): CardTemplate[] {
  return createSimpleDeck([
    { name: 'Forest', count: 20 },
    { name: 'Grizzly Bears', count: 40 }, // 2/2 for 1G - very aggressive
  ]);
}

// =============================================================================
// MONO-COLORED TEST DECKS (Week 11)
// =============================================================================

/**
 * White Test Deck
 * Control/defensive strategy with removal and flying threats
 */
export function createWhiteDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Plains', count: 24 },
    // Creatures (20)
    { name: 'Archangel', count: 20 }, // 5/5 Flying Vigilance - finisher
    // Spells (16)
    { name: 'Disenchant', count: 4 }, // Artifact/enchantment removal
    { name: 'Pacifism', count: 4 }, // Creature removal (aura)
    { name: 'Exile', count: 8 }, // Exile attacking creature + life gain
  ]);
}

/**
 * Blue Test Deck
 * Control strategy with counterspells and flyers
 */
export function createBlueDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Island', count: 24 },
    // Creatures (20)
    { name: 'Air Elemental', count: 10 }, // 4/4 Flying
    { name: 'Fog Elemental', count: 10 }, // 4/4 Flying
    // Spells (16)
    { name: 'Counterspell', count: 8 }, // Counter target spell
    { name: 'Unsummon', count: 8 }, // Bounce creature
  ]);
}

/**
 * Black Test Deck
 * Discard and removal with evasive threats
 */
export function createBlackDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Swamp', count: 24 },
    // Creatures (20)
    { name: 'Abyssal Specter', count: 10 }, // 2/3 Flying, damage -> discard
    { name: 'Gravedigger', count: 10 }, // 2/2 ETB return creature
    // Spells (16)
    { name: 'Terror', count: 8 }, // Destroy nonblack nonartifact creature
    { name: 'Coercion', count: 8 }, // Targeted discard
  ]);
}

/**
 * Red Test Deck
 * Aggressive burn strategy with direct damage
 */
export function createRedDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (22)
    { name: 'Mountain', count: 22 },
    // Creatures (18)
    { name: 'Balduvian Barbarians', count: 10 }, // 3/2 aggressive
    { name: 'Anaba Shaman', count: 8 }, // 2/2 with tap for damage
    // Spells (20)
    { name: 'Lightning Blast', count: 10 }, // 4 damage
    { name: 'Shock', count: 10 }, // 2 damage
  ]);
}

/**
 * Green Test Deck
 * Aggressive creature strategy with mana acceleration
 */
export function createGreenDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (20)
    { name: 'Forest', count: 20 },
    // Creatures (32)
    { name: 'Llanowar Elves', count: 8 }, // Mana acceleration
    { name: 'Birds of Paradise', count: 8 }, // Mana acceleration (any color)
    { name: 'Grizzly Bears', count: 16 }, // 2/2 for 1G
    // Spells (8)
    { name: 'Giant Growth', count: 8 }, // +3/+3 combat trick
  ]);
}

/**
 * All available test decks
 */
export type DeckColor = 'white' | 'blue' | 'black' | 'red' | 'green';

export const TEST_DECKS: Record<DeckColor, () => CardTemplate[]> = {
  white: createWhiteDeck,
  blue: createBlueDeck,
  black: createBlackDeck,
  red: createRedDeck,
  green: createGreenDeck,
};

/**
 * Get a random test deck
 */
export function getRandomTestDeck(): CardTemplate[] {
  const colors: DeckColor[] = ['white', 'blue', 'black', 'red', 'green'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)]!;
  return TEST_DECKS[randomColor]();
}

/**
 * Get a specific test deck by color
 */
export function getTestDeck(color: DeckColor): CardTemplate[] {
  return TEST_DECKS[color]();
}
