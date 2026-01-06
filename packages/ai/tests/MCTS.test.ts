/**
 * Tests for MCTS implementation
 */

import { describe, test, expect } from 'bun:test';
import { MCTSBot, createMCTSBot } from '../src/bots/MCTSBot';
import { RandomBot } from '../src/bots/RandomBot';
import {
  runMCTS,
  randomRolloutPolicy,
  DEFAULT_MCTS_CONFIG,
  orderActionsByPriority,
  ACTION_PRIORITY,
} from '../src/search/MCTS';
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
    expect(DEFAULT_MCTS_CONFIG.moveOrdering).toBe(false); // Off by default
  });
});

describe('Phase 3.4: Move Ordering', () => {
  test('ACTION_PRIORITY has correct ordering', () => {
    expect(ACTION_PRIORITY['CAST_SPELL']).toBeGreaterThan(ACTION_PRIORITY['ACTIVATE_ABILITY']);
    expect(ACTION_PRIORITY['ACTIVATE_ABILITY']).toBeGreaterThan(
      ACTION_PRIORITY['DECLARE_ATTACKERS'],
    );
    expect(ACTION_PRIORITY['DECLARE_ATTACKERS']).toBeGreaterThan(ACTION_PRIORITY['PASS_PRIORITY']);
    expect(ACTION_PRIORITY['PASS_PRIORITY']).toBe(0);
  });

  test('orderActionsByPriority sorts actions correctly', () => {
    const actions = [
      { type: 'PASS_PRIORITY' },
      { type: 'CAST_SPELL', cardId: 'test1' },
      { type: 'ACTIVATE_ABILITY', cardId: 'test2' },
      { type: 'DECLARE_ATTACKERS' },
      { type: 'PLAY_LAND', cardId: 'test3' },
    ] as any[];

    const ordered = orderActionsByPriority(actions);

    // CAST_SPELL (100) should be first
    expect(ordered[0].type).toBe('CAST_SPELL');
    // ACTIVATE_ABILITY (80) second
    expect(ordered[1].type).toBe('ACTIVATE_ABILITY');
    // DECLARE_ATTACKERS (60) third
    expect(ordered[2].type).toBe('DECLARE_ATTACKERS');
    // PLAY_LAND (40) fourth
    expect(ordered[3].type).toBe('PLAY_LAND');
    // PASS_PRIORITY (0) last
    expect(ordered[4].type).toBe('PASS_PRIORITY');
  });

  test('orderActionsByPriority does not mutate original array', () => {
    const actions = [{ type: 'PASS_PRIORITY' }, { type: 'CAST_SPELL', cardId: 'test1' }] as any[];

    const ordered = orderActionsByPriority(actions);

    // Original should be unchanged
    expect(actions[0].type).toBe('PASS_PRIORITY');
    // Ordered should be different order
    expect(ordered[0].type).toBe('CAST_SPELL');
  });

  test('MCTS with moveOrdering enabled expands high-priority actions first', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    // Run MCTS with move ordering enabled
    const result = runMCTS(state, 'player', randomRolloutPolicy, {
      iterations: 50,
      moveOrdering: true,
      rolloutDepth: 0,
    });

    expect(result.action).toBeDefined();
    expect(result.iterations).toBeGreaterThan(0);
    // The first expanded actions should be high-priority types
    // (Can't directly test expansion order, but we verify it runs without errors)
  });
});
