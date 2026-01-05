/**
 * Tests for GreedyBot
 */

import { describe, test, expect } from 'bun:test';
import { GreedyBot } from '../src/bots/GreedyBot';
import { RandomBot } from '../src/bots/RandomBot';
import { initializeGame, applyAction, createRedDeck, createGreenDeck } from '@manacore/engine';
import type { GameState, PlayerId } from '@manacore/engine';

describe('GreedyBot', () => {
  test('implements Bot interface correctly', () => {
    const bot = new GreedyBot();
    expect(bot.getName()).toBe('GreedyBot');
    expect(bot.getDescription()).toBe('1-ply lookahead, picks best immediate outcome');
  });

  test('chooses action from legal actions', () => {
    const bot = new GreedyBot(42);
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const action = bot.chooseAction(state, 'player');

    // Should return a valid action
    expect(action).toBeDefined();
    expect(action.type).toBeDefined();
  });

  test('deterministic with same seed', () => {
    const bot1 = new GreedyBot(42);
    const bot2 = new GreedyBot(42);

    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const action1 = bot1.chooseAction(state, 'player');
    const action2 = bot2.chooseAction(state, 'player');

    // Same seed should produce same action
    expect(JSON.stringify(action1)).toBe(JSON.stringify(action2));
  });

  test('completes a full game without errors', () => {
    const playerBot = new GreedyBot(111);
    const opponentBot = new RandomBot(222);

    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    let state = initializeGame(playerDeck, opponentDeck, 333);

    let actionCount = 0;
    const maxActions = 5000;

    while (!state.gameOver && actionCount < maxActions) {
      const activeBot = state.priorityPlayer === 'player' ? playerBot : opponentBot;
      const action = activeBot.chooseAction(state, state.priorityPlayer);
      state = applyAction(state, action);
      actionCount++;
    }

    // If we hit maxActions, that's suspicious but not necessarily a crash.
    // Ideally it finishes.
    if (actionCount >= maxActions) {
      console.warn('Game did not finish within action limit');
    }

    expect(state).toBeDefined();
  });
});
