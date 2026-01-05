/**
 * Tests for evaluation function
 */

import { describe, test, expect } from 'bun:test';
import { evaluate, quickEvaluate, DEFAULT_WEIGHTS } from '../src/evaluation/evaluate';
import { initializeGame, createRedDeck, createGreenDeck, applyAction } from '@manacore/engine';
import type { GameState } from '@manacore/engine';

describe('evaluate', () => {
  test('returns 0.5 for balanced initial state', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const score = evaluate(state, 'player');

    // Initial state should be roughly balanced (both players at 20 life, 7 cards)
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThan(0.6);
  });

  test('returns 1.0 for winning state', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    let state = initializeGame(playerDeck, opponentDeck, 12345);

    // Manually set opponent to 0 life
    state = {
      ...state,
      gameOver: true,
      winner: 'player',
    };

    const score = evaluate(state, 'player');
    expect(score).toBe(1.0);
  });

  test('returns 0.0 for losing state', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    let state = initializeGame(playerDeck, opponentDeck, 12345);

    // Manually set game as lost
    state = {
      ...state,
      gameOver: true,
      winner: 'opponent',
    };

    const score = evaluate(state, 'player');
    expect(score).toBe(0.0);
  });

  test('higher life gives better score', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state1 = initializeGame(playerDeck, opponentDeck, 12345);

    // Create state with player at higher life
    const state2: GameState = {
      ...state1,
      players: {
        ...state1.players,
        player: { ...state1.players.player, life: 30 },
        opponent: { ...state1.players.opponent, life: 10 },
      },
    };

    const score1 = evaluate(state1, 'player');
    const score2 = evaluate(state2, 'player');

    expect(score2).toBeGreaterThan(score1);
  });
});

describe('quickEvaluate', () => {
  test('returns positive for winning state', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    let state = initializeGame(playerDeck, opponentDeck, 12345);

    state = {
      ...state,
      gameOver: true,
      winner: 'player',
    };

    const score = quickEvaluate(state, 'player');
    expect(score).toBe(1000);
  });

  test('returns negative for losing state', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    let state = initializeGame(playerDeck, opponentDeck, 12345);

    state = {
      ...state,
      gameOver: true,
      winner: 'opponent',
    };

    const score = quickEvaluate(state, 'player');
    expect(score).toBe(-1000);
  });
});

describe('DEFAULT_WEIGHTS', () => {
  test('weights sum to 1.0', () => {
    const sum =
      DEFAULT_WEIGHTS.life +
      DEFAULT_WEIGHTS.board +
      DEFAULT_WEIGHTS.cards +
      DEFAULT_WEIGHTS.mana +
      DEFAULT_WEIGHTS.tempo;
    expect(sum).toBe(1.0);
  });
});
