/**
 * Tests for ISMCTS (Information Set Monte Carlo Tree Search)
 */

import { describe, test, expect } from 'bun:test';
import { ISMCTSBot, createISMCTSBot, ISMCTSBotPresets } from '../src/bots/ISMCTSBot';
import { runISMCTS, DEFAULT_ISMCTS_CONFIG } from '../src/search/ISMCTS';
import { randomRolloutPolicy, determinize } from '../src/search/MCTS';
import { initializeGame, createRedDeck, createGreenDeck, getLegalActions } from '@manacore/engine';

describe('ISMCTS Search', () => {
  test('returns single action immediately without iterations', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    // Modify state to have only one legal action (e.g., pass priority)
    const testState = { ...state, phase: 'beginning' as const, step: 'upkeep' as const };

    const result = runISMCTS(testState, 'player', randomRolloutPolicy, {
      determinizations: 5,
      iterations: 50,
    });

    expect(result.action).toBeDefined();
    // Should return immediately without running determinizations
    expect(result.determinizations).toBe(0);
    expect(result.totalIterations).toBe(0);
  });

  test('completes with multiple determinizations', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const result = runISMCTS(state, 'player', randomRolloutPolicy, {
      determinizations: 5,
      iterations: 100, // 5 dets x 20 iters each
    });

    expect(result.action).toBeDefined();
    expect(result.determinizations).toBe(5);
    expect(result.totalIterations).toBeGreaterThan(0);
    expect(result.winRate).toBeGreaterThanOrEqual(0);
    expect(result.winRate).toBeLessThanOrEqual(1);
    expect(result.topActions.length).toBeGreaterThan(0);
  });

  test('aggregates statistics across determinizations', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 42);

    const result = runISMCTS(state, 'player', randomRolloutPolicy, {
      determinizations: 3,
      iterations: 60, // 3 dets x 20 iters each
    });

    // Should have top actions with aggregated stats
    expect(result.topActions.length).toBeGreaterThan(0);

    // Each top action should have valid stats
    for (const ta of result.topActions) {
      expect(ta.visits).toBeGreaterThanOrEqual(0);
      expect(ta.avgReward).toBeGreaterThanOrEqual(0);
      expect(ta.avgReward).toBeLessThanOrEqual(1);
      expect(ta.occurrences).toBeGreaterThanOrEqual(0);
      expect(ta.occurrences).toBeLessThanOrEqual(3); // Max 3 determinizations
    }
  });

  test('respects iteration budget per determinization', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const result = runISMCTS(state, 'player', randomRolloutPolicy, {
      determinizations: 10,
      iterations: 100, // 10 dets x 10 iters each (minimum 10)
    });

    expect(result.determinizations).toBe(10);
    // Total iterations should be at least 10 * 10 = 100
    expect(result.totalIterations).toBeGreaterThanOrEqual(100);
  });
});

describe('ISMCTSBot', () => {
  test('implements Bot interface correctly', () => {
    const bot = new ISMCTSBot({ determinizations: 5, iterations: 100 });

    expect(bot.getName()).toContain('ISMCTSBot');
    expect(bot.getName()).toContain('5x20'); // 5 dets x 20 iters each
    expect(bot.getDescription()).toContain('5 determinizations');
    expect(bot.getDescription()).toContain('100 total iterations');
  });

  test('chooses action from legal actions', () => {
    const bot = new ISMCTSBot({ determinizations: 3, iterations: 30 });
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const action = bot.chooseAction(state, 'player');

    expect(action).toBeDefined();
    expect(action.type).toBeDefined();
  });

  test('tracks statistics', () => {
    const bot = new ISMCTSBot({ determinizations: 2, iterations: 20 });
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    // Make a few decisions
    bot.chooseAction(state, 'player');
    bot.chooseAction(state, 'player');

    const stats = bot.getStats();
    expect(stats.decisions).toBe(2);
    expect(stats.totalDeterminizations).toBeGreaterThan(0);
    expect(stats.totalIterations).toBeGreaterThan(0);
    expect(stats.avgTimeMs).toBeGreaterThan(0);
  });

  test('resets statistics', () => {
    const bot = new ISMCTSBot({ determinizations: 2, iterations: 20 });
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    bot.chooseAction(state, 'player');
    expect(bot.getStats().decisions).toBe(1);

    bot.resetStats();
    expect(bot.getStats().decisions).toBe(0);
    expect(bot.getStats().totalIterations).toBe(0);
  });

  test('createISMCTSBot factory works', () => {
    const bot = createISMCTSBot(10, 50);

    expect(bot.getName()).toContain('ISMCTSBot');
    expect(bot.getName()).toContain('10x50');
  });
});

describe('ISMCTSBotPresets', () => {
  test('fast preset creates valid bot', () => {
    const bot = ISMCTSBotPresets.fast();
    expect(bot.getName()).toContain('ISMCTSBot');
    expect(bot.getName()).toContain('5x20');
  });

  test('standard preset creates valid bot', () => {
    const bot = ISMCTSBotPresets.standard();
    expect(bot.getName()).toContain('ISMCTSBot');
    expect(bot.getName()).toContain('10x50');
  });

  test('strong preset creates valid bot', () => {
    const bot = ISMCTSBotPresets.strong();
    expect(bot.getName()).toContain('ISMCTSBot');
    expect(bot.getName()).toContain('10x100');
  });

  test('expert preset creates valid bot', () => {
    const bot = ISMCTSBotPresets.expert();
    expect(bot.getName()).toContain('ISMCTSBot');
    expect(bot.getName()).toContain('20x100');
  });
});

describe('DEFAULT_ISMCTS_CONFIG', () => {
  test('has sensible defaults', () => {
    expect(DEFAULT_ISMCTS_CONFIG.determinizations).toBe(10);
    expect(DEFAULT_ISMCTS_CONFIG.aggregation).toBe('sum');
    expect(DEFAULT_ISMCTS_CONFIG.ismctsDebug).toBe(false);
    expect(DEFAULT_ISMCTS_CONFIG.iterations).toBe(1000);
    expect(DEFAULT_ISMCTS_CONFIG.rolloutDepth).toBe(0); // Use evaluation function
    expect(DEFAULT_ISMCTS_CONFIG.moveOrdering).toBe(true); // Enabled by default for ISMCTS
  });
});

describe('Determinization', () => {
  test('determinize shuffles opponent hand', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    // Get original opponent hand IDs
    const originalHandIds = state.players.opponent.hand.map((c) => c.instanceId);

    // Run multiple determinizations and check that opponent hand gets shuffled
    let foundDifferentOrder = false;
    for (let i = 0; i < 10; i++) {
      const detState = determinize(state, 'player');
      const detHandIds = detState.players.opponent.hand.map((c) => c.instanceId);

      // The hand should have the same cards but potentially different order
      // Or different cards from library (if shuffled from library)
      if (JSON.stringify(originalHandIds) !== JSON.stringify(detHandIds)) {
        foundDifferentOrder = true;
        break;
      }
    }

    // Over 10 shuffles, we should find at least one different arrangement
    // (though this is probabilistic and could rarely fail)
    expect(foundDifferentOrder).toBe(true);
  });

  test('determinize preserves our own hand', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    // Get original player hand
    const originalHandIds = state.players.player.hand.map((c) => c.instanceId);

    const detState = determinize(state, 'player');
    const detHandIds = detState.players.player.hand.map((c) => c.instanceId);

    // Our hand should be exactly the same
    expect(detHandIds).toEqual(originalHandIds);
  });

  test('determinize creates independent state', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    // Store original turn number
    const originalTurnNumber = state.turnNumber;

    const detState = determinize(state, 'player');

    // Modifying determinized state should not affect original
    detState.turnNumber = 999;

    expect(state.turnNumber).toBe(originalTurnNumber);
    expect(detState.turnNumber).toBe(999);
    expect(state.turnNumber).not.toBe(999);
  });
});
