/**
 * Game initialization utilities
 */

import type { GameState, CardTemplate, PlayerId } from '../index';
import { createGameState, createCardInstance } from '../index';

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
  createVanillaDeck,
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
  // Types
  type DeckColor,
  type TwoColorDeck,
  type CompetitiveDeck,
  type SpecialDeck,
  type AllDeckTypes,
} from '../decks';
