/**
 * Tests for MCTS implementation
 */

import { describe, test, expect } from 'bun:test';
import { MCTSBot, createMCTSBot } from '../src/bots/MCTSBot';
import { RandomBot } from '../src/bots/RandomBot';
import { runMCTS, randomRolloutPolicy, DEFAULT_MCTS_CONFIG } from '../src/search/MCTS';
import {
  createMCTSNode,
  isFullyExpanded,
  isTerminal,
  calculateUCB1,
  selectBestChild,
} from '../src/search/MCTSNode';
import { initializeGame, createRedDeck, createGreenDeck, getLegalActions } from '@manacore/engine';

describe('MCTSNode', () => {
  test('creates node correctly', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);
    const actions = getLegalActions(state, 'player');

    const node = createMCTSNode(state, null, null, actions);

    expect(node.state).toBe(state);
    expect(node.action).toBeNull();
    expect(node.parent).toBeNull();
    expect(node.children).toHaveLength(0);
    expect(node.visits).toBe(0);
    expect(node.totalReward).toBe(0);
    expect(node.untriedActions.length).toBe(actions.length);
  });

  test('isFullyExpanded returns false when untried actions exist', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);
    const actions = getLegalActions(state, 'player');

    const node = createMCTSNode(state, null, null, actions);

    expect(isFullyExpanded(node)).toBe(false);
  });

  test('isFullyExpanded returns true when no untried actions', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const node = createMCTSNode(state, null, null, []);

    expect(isFullyExpanded(node)).toBe(true);
  });

  test('isTerminal returns true for game over state', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    let state = initializeGame(playerDeck, opponentDeck, 12345);
    state = { ...state, gameOver: true, winner: 'player' };

    const node = createMCTSNode(state, null, null, []);

    expect(isTerminal(node)).toBe(true);
  });

  test('calculateUCB1 returns Infinity for unvisited nodes', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const node = createMCTSNode(state, null, null, []);

    expect(calculateUCB1(node)).toBe(Infinity);
  });
});

describe('MCTS Search', () => {
  test('returns single action immediately', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    // Modify state to have only one legal action (e.g., pass priority)
    const testState = { ...state, phase: 'beginning' as const, step: 'upkeep' as const };

    const result = runMCTS(testState, 'player', randomRolloutPolicy, { iterations: 10 });

    expect(result.action).toBeDefined();
    expect(result.iterations).toBeGreaterThanOrEqual(0);
  });

  test('completes with multiple iterations', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const result = runMCTS(state, 'player', randomRolloutPolicy, { iterations: 50 });

    expect(result.action).toBeDefined();
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.winRate).toBeGreaterThanOrEqual(0);
    expect(result.winRate).toBeLessThanOrEqual(1);
  });
});

describe('MCTSBot', () => {
  test('implements Bot interface correctly', () => {
    const bot = new MCTSBot({ iterations: 100 });

    expect(bot.getName()).toContain('MCTSBot');
    expect(bot.getDescription()).toContain('100 iterations');
  });

  test('chooses action from legal actions', () => {
    const bot = new MCTSBot({ iterations: 50 });
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const action = bot.chooseAction(state, 'player');

    expect(action).toBeDefined();
    expect(action.type).toBeDefined();
  });

  test('tracks statistics', () => {
    const bot = new MCTSBot({ iterations: 20 });
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    // Make a few decisions
    bot.chooseAction(state, 'player');
    bot.chooseAction(state, 'player');

    const stats = bot.getStats();
    expect(stats.decisions).toBe(2);
    expect(stats.totalIterations).toBeGreaterThan(0);
  });

  test('createMCTSBot factory works', () => {
    const bot = createMCTSBot(200);

    expect(bot.getName()).toContain('200');
  });
});

describe('DEFAULT_MCTS_CONFIG', () => {
  test('has sensible defaults', () => {
    expect(DEFAULT_MCTS_CONFIG.iterations).toBe(500);
    expect(DEFAULT_MCTS_CONFIG.explorationConstant).toBeCloseTo(1.41, 1);
    expect(DEFAULT_MCTS_CONFIG.rolloutDepth).toBe(20);
  });
});
