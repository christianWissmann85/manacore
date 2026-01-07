/**
 * Seed Determinism Tests
 *
 * Verifies that games are fully reproducible when using the same seed.
 * This is critical for:
 * 1. Replay functionality
 * 2. AI debugging
 * 3. Bug reproduction
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  initializeGame,
  applyAction,
  getLegalActions,
  createRedDeck,
  createGreenDeck,
  createBlueDeck,
  createWhiteDeck,
  _resetInstanceCounter,
  _resetModificationCounter,
  _resetStackCounter,
} from '../src/index';
import type { GameState, Action } from '../src/index';

/**
 * Simple seeded RNG (same as used in RandomBot)
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Play a complete game with seeded random decisions
 * Returns the final state and action history
 */
function playSeededGame(
  playerDeck: ReturnType<typeof createRedDeck>,
  opponentDeck: ReturnType<typeof createRedDeck>,
  gameSeed: number,
  botSeed: number,
  maxTurns: number = 100,
): { finalState: GameState; actions: Action[]; turnCount: number } {
  let state = initializeGame(playerDeck, opponentDeck, gameSeed);
  const rng = createSeededRandom(botSeed);
  const actions: Action[] = [];

  while (!state.gameOver && state.turnCount <= maxTurns) {
    const currentPlayer = state.priorityPlayer;
    const legalActions = getLegalActions(state, currentPlayer);

    if (legalActions.length === 0) {
      throw new Error(`No legal actions for ${currentPlayer}`);
    }

    // Pick action deterministically based on seed
    const index = Math.floor(rng() * legalActions.length);
    const action = legalActions[index]!;

    actions.push(action);
    state = applyAction(state, action);
  }

  return { finalState: state, actions, turnCount: state.turnCount };
}

/**
 * Compare two game states for equality (ignoring action history length)
 */
function statesAreEqual(state1: GameState, state2: GameState): boolean {
  // Compare key state properties
  if (state1.turnCount !== state2.turnCount) return false;
  if (state1.phase !== state2.phase) return false;
  if (state1.step !== state2.step) return false;
  if (state1.gameOver !== state2.gameOver) return false;
  if (state1.winner !== state2.winner) return false;
  if (state1.activePlayer !== state2.activePlayer) return false;
  if (state1.priorityPlayer !== state2.priorityPlayer) return false;

  // Compare player states
  for (const playerId of ['player', 'opponent'] as const) {
    const p1 = state1.players[playerId];
    const p2 = state2.players[playerId];

    if (p1.life !== p2.life) return false;
    if (p1.hand.length !== p2.hand.length) return false;
    if (p1.library.length !== p2.library.length) return false;
    if (p1.battlefield.length !== p2.battlefield.length) return false;
    if (p1.graveyard.length !== p2.graveyard.length) return false;

    // Compare card IDs in each zone
    for (let i = 0; i < p1.hand.length; i++) {
      if (p1.hand[i]?.cardId !== p2.hand[i]?.cardId) return false;
    }
    for (let i = 0; i < p1.battlefield.length; i++) {
      if (p1.battlefield[i]?.cardId !== p2.battlefield[i]?.cardId) return false;
    }
  }

  return true;
}

describe('Seed Determinism', () => {
  // Reset counters before each test for isolation
  beforeEach(() => {
    _resetInstanceCounter();
    _resetModificationCounter();
    _resetStackCounter();
  });

  test('same seed produces identical game initialization', () => {
    const seed = 12345;
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();

    const state1 = initializeGame(playerDeck, opponentDeck, seed);

    // Reset counters for deterministic comparison
    _resetInstanceCounter();
    _resetModificationCounter();

    const state2 = initializeGame(playerDeck, opponentDeck, seed);

    // Seeds should be stored
    expect(state1.rngSeed).toBe(seed);
    expect(state2.rngSeed).toBe(seed);

    // Hands should be identical
    expect(state1.players.player.hand.length).toBe(7);
    expect(state2.players.player.hand.length).toBe(7);

    for (let i = 0; i < 7; i++) {
      expect(state1.players.player.hand[i]?.cardId).toBe(state2.players.player.hand[i]?.cardId);
      expect(state1.players.opponent.hand[i]?.cardId).toBe(state2.players.opponent.hand[i]?.cardId);
    }

    // Libraries should be identical
    expect(state1.players.player.library.length).toBe(state2.players.player.library.length);
    for (let i = 0; i < state1.players.player.library.length; i++) {
      expect(state1.players.player.library[i]?.cardId).toBe(
        state2.players.player.library[i]?.cardId,
      );
    }
  });

  test('same seed + same decisions produces identical game', () => {
    const gameSeed = 42;
    const botSeed = 99;
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();

    // Play the same game twice (reset counters between runs for determinism)
    const game1 = playSeededGame(playerDeck, opponentDeck, gameSeed, botSeed);

    _resetInstanceCounter();
    _resetModificationCounter();

    const game2 = playSeededGame(playerDeck, opponentDeck, gameSeed, botSeed);

    // Should produce identical results
    expect(game1.actions.length).toBe(game2.actions.length);
    expect(game1.turnCount).toBe(game2.turnCount);
    expect(game1.finalState.winner).toBe(game2.finalState.winner);
    expect(game1.finalState.gameOver).toBe(game2.finalState.gameOver);

    // All actions should be identical
    for (let i = 0; i < game1.actions.length; i++) {
      expect(JSON.stringify(game1.actions[i])).toBe(JSON.stringify(game2.actions[i]));
    }

    // Final states should be equal
    expect(statesAreEqual(game1.finalState, game2.finalState)).toBe(true);
  });

  test('different seeds produce different games', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();

    const game1 = playSeededGame(playerDeck, opponentDeck, 100, 200);
    const game2 = playSeededGame(playerDeck, opponentDeck, 101, 201);

    // Very unlikely to have identical games with different seeds
    // Check that at least some aspect differs
    const sameWinner = game1.finalState.winner === game2.finalState.winner;
    const sameTurns = game1.turnCount === game2.turnCount;
    const sameActions = game1.actions.length === game2.actions.length;

    // At least one should differ (statistically almost certain)
    // We don't require all to differ, but they shouldn't all be the same
    if (sameWinner && sameTurns && sameActions && game1.actions.length > 10) {
      // If everything looks the same, check action content
      let allActionsSame = true;
      for (let i = 0; i < Math.min(game1.actions.length, 10); i++) {
        if (JSON.stringify(game1.actions[i]) !== JSON.stringify(game2.actions[i])) {
          allActionsSame = false;
          break;
        }
      }
      expect(allActionsSame).toBe(false);
    }
  });

  test('action history is recorded correctly', () => {
    const gameSeed = 777;
    const botSeed = 888;
    const playerDeck = createBlueDeck();
    const opponentDeck = createWhiteDeck();

    const { finalState, actions } = playSeededGame(playerDeck, opponentDeck, gameSeed, botSeed, 10);

    // Action history should match our tracked actions
    expect(finalState.actionHistory.length).toBe(actions.length);

    // Each recorded action should parse back to the original
    for (let i = 0; i < actions.length; i++) {
      const recorded = JSON.parse(finalState.actionHistory[i]!);
      expect(recorded.type).toBe(actions[i]!.type);
    }
  });

  test('can replay game from action history', () => {
    const gameSeed = 555;
    const botSeed = 666;
    const playerDeck = createRedDeck();
    const opponentDeck = createBlueDeck();

    // Play original game
    const { finalState: originalFinal, actions } = playSeededGame(
      playerDeck,
      opponentDeck,
      gameSeed,
      botSeed,
      20,
    );

    // Reset counters before replay so card IDs match
    _resetInstanceCounter();
    _resetModificationCounter();
    _resetStackCounter();

    // Replay: Initialize with same seed and apply same actions
    let replayState = initializeGame(playerDeck, opponentDeck, gameSeed);

    for (const action of actions) {
      replayState = applyAction(replayState, action);
    }

    // Replayed game should match original
    expect(replayState.turnCount).toBe(originalFinal.turnCount);
    expect(replayState.winner).toBe(originalFinal.winner);
    expect(replayState.gameOver).toBe(originalFinal.gameOver);
    expect(replayState.players.player.life).toBe(originalFinal.players.player.life);
    expect(replayState.players.opponent.life).toBe(originalFinal.players.opponent.life);

    // States should be equal
    expect(statesAreEqual(replayState, originalFinal)).toBe(true);
  });

  test('multiple consecutive games with sequential seeds are deterministic', () => {
    const baseSeed = 1000;
    const playerDeck = createGreenDeck();
    const opponentDeck = createWhiteDeck();

    // Run 5 games, each with seed = baseSeed + gameIndex
    const results1: { winner: string | null; turns: number }[] = [];
    const results2: { winner: string | null; turns: number }[] = [];

    for (let i = 0; i < 5; i++) {
      const game1 = playSeededGame(playerDeck, opponentDeck, baseSeed + i, baseSeed + i + 100, 50);
      results1.push({ winner: game1.finalState.winner, turns: game1.turnCount });
    }

    // Reset counters before second batch for determinism
    _resetInstanceCounter();
    _resetModificationCounter();

    // Run the same 5 games again
    for (let i = 0; i < 5; i++) {
      const game2 = playSeededGame(playerDeck, opponentDeck, baseSeed + i, baseSeed + i + 100, 50);
      results2.push({ winner: game2.finalState.winner, turns: game2.turnCount });
    }

    // All results should match
    for (let i = 0; i < 5; i++) {
      expect(results1[i]!.winner).toBe(results2[i]!.winner);
      expect(results1[i]!.turns).toBe(results2[i]!.turns);
    }
  });
});
