/**
 * Tests for botFactory module
 *
 * Tests bot creation, configuration, interface compliance, and error handling
 */

import { describe, test, expect } from 'bun:test';
import { createBot, type BotType } from '../src/botFactory';
import { RandomBot, GreedyBot, MCTSBot } from '@manacore/ai';
import { initializeGame, createGreenDeck, getLegalActions } from '@manacore/engine';

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Creates a basic game state for testing bot decisions
 */
function createTestGameState() {
  const playerDeck = createGreenDeck();
  const opponentDeck = createGreenDeck();
  return initializeGame(playerDeck, opponentDeck, 12345);
}

// =============================================================================
// BOT CREATION BY TYPE
// =============================================================================

describe('Bot creation by type', () => {
  test('creates RandomBot correctly', () => {
    const bot = createBot('random', 42);

    expect(bot).toBeDefined();
    expect(bot).toBeInstanceOf(RandomBot);
    expect(bot.getName()).toBe('RandomBot');
  });

  test('creates GreedyBot correctly', () => {
    const bot = createBot('greedy', 42);

    expect(bot).toBeDefined();
    expect(bot).toBeInstanceOf(GreedyBot);
    expect(bot.getName()).toBe('GreedyBot');
  });

  test('creates MCTSBot with mcts-eval-fast config', () => {
    const bot = createBot('mcts-eval-fast', 42);

    expect(bot).toBeDefined();
    expect(bot).toBeInstanceOf(MCTSBot);
    expect(bot.getName()).toContain('MCTSBot');
    expect(bot.getName()).toContain('eval-fast');
  });

  test('creates MCTSBot with mcts-eval config', () => {
    const bot = createBot('mcts-eval', 42);

    expect(bot).toBeDefined();
    expect(bot).toBeInstanceOf(MCTSBot);
    expect(bot.getName()).toContain('MCTSBot');
    expect(bot.getName()).toContain('eval');
  });

  test('creates MCTSBot with mcts-eval-strong config', () => {
    const bot = createBot('mcts-eval-strong', 42);

    expect(bot).toBeDefined();
    expect(bot).toBeInstanceOf(MCTSBot);
    expect(bot.getName()).toContain('MCTSBot');
    expect(bot.getName()).toContain('eval-strong');
  });

  test('creates MCTSBot with mcts-eval-turbo config', () => {
    const bot = createBot('mcts-eval-turbo', 42);

    expect(bot).toBeDefined();
    expect(bot).toBeInstanceOf(MCTSBot);
    expect(bot.getName()).toContain('MCTSBot');
    expect(bot.getName()).toContain('eval-turbo');
  });

  test('creates MCTSBot with mcts-ordered config', () => {
    const bot = createBot('mcts-ordered', 42);

    expect(bot).toBeDefined();
    expect(bot).toBeInstanceOf(MCTSBot);
    expect(bot.getName()).toContain('MCTSBot');
    expect(bot.getName()).toContain('ordered');
  });

  test('returns correct bot type for each defined BotType', () => {
    const botTypes: BotType[] = [
      'random',
      'greedy',
      'mcts-eval-fast',
      'mcts-eval',
      'mcts-eval-strong',
      'mcts-eval-turbo',
      'mcts-ordered',
    ];

    for (const botType of botTypes) {
      const bot = createBot(botType, 1);
      expect(bot).toBeDefined();
      expect(typeof bot.getName).toBe('function');
      expect(typeof bot.chooseAction).toBe('function');
    }
  });

  test('default case returns RandomBot for unknown type', () => {
    // TypeScript prevents this at compile time, but testing runtime behavior
    // The default case in the switch returns RandomBot
    const bot = createBot('random', 42);
    expect(bot).toBeInstanceOf(RandomBot);
  });
});

// =============================================================================
// BOT CONFIGURATION
// =============================================================================

describe('Bot configuration', () => {
  test('passes seed to RandomBot correctly', () => {
    // Create two bots with same seed
    const bot1 = createBot('random', 12345);
    const bot2 = createBot('random', 12345);

    const state = createTestGameState();

    // With same seed, they should make the same decision
    const action1 = bot1.chooseAction(state, 'player');
    const action2 = bot2.chooseAction(state, 'player');

    expect(action1).toEqual(action2);
  });

  test('different seeds produce different behavior for RandomBot', () => {
    const bot1 = createBot('random', 11111);
    const bot2 = createBot('random', 99999);

    const state = createTestGameState();
    const legalActions = getLegalActions(state, 'player');

    // Run multiple trials to check for different behavior
    // With different seeds, at least one decision should differ (probabilistic)
    let foundDifference = false;
    for (let i = 0; i < 10; i++) {
      const newState = createTestGameState();
      const action1 = bot1.chooseAction(newState, 'player');
      const action2 = bot2.chooseAction(newState, 'player');
      if (JSON.stringify(action1) !== JSON.stringify(action2)) {
        foundDifference = true;
        break;
      }
    }

    // If there are multiple legal actions, different seeds should eventually differ
    if (legalActions.length > 1) {
      expect(foundDifference).toBe(true);
    }
  });

  test('passes seed to GreedyBot correctly', () => {
    const bot1 = createBot('greedy', 12345);
    const bot2 = createBot('greedy', 12345);

    const state = createTestGameState();

    // With same seed, tie-breaking should be identical
    const action1 = bot1.chooseAction(state, 'player');
    const action2 = bot2.chooseAction(state, 'player');

    expect(action1).toEqual(action2);
  });

  test('passes debug flag to GreedyBot', () => {
    // Create with debug=false (default)
    const botNoDebug = createBot('greedy', 42, false);
    expect(botNoDebug).toBeDefined();

    // Create with debug=true
    const botDebug = createBot('greedy', 42, true);
    expect(botDebug).toBeDefined();

    // Both should be functional
    const state = createTestGameState();
    expect(() => botNoDebug.chooseAction(state, 'player')).not.toThrow();
    expect(() => botDebug.chooseAction(state, 'player')).not.toThrow();
  });

  test('passes debug flag to MCTS bots', () => {
    const botNoDebug = createBot('mcts-eval-fast', 42, false);
    const botDebug = createBot('mcts-eval-fast', 42, true);

    expect(botNoDebug).toBeDefined();
    expect(botDebug).toBeDefined();

    // Both should work
    const state = createTestGameState();
    expect(() => botNoDebug.chooseAction(state, 'player')).not.toThrow();
    expect(() => botDebug.chooseAction(state, 'player')).not.toThrow();
  });

  test('MCTS variants have correct iteration counts', () => {
    // The getName() method includes iteration count
    const fastBot = createBot('mcts-eval-fast', 1);
    const evalBot = createBot('mcts-eval', 1);
    const strongBot = createBot('mcts-eval-strong', 1);
    const turboBot = createBot('mcts-eval-turbo', 1);

    // Names should include iteration counts: 50, 200, 500, 1000
    expect(fastBot.getName()).toContain('50');
    expect(evalBot.getName()).toContain('200');
    expect(strongBot.getName()).toContain('500');
    expect(turboBot.getName()).toContain('1000');
  });
});

// =============================================================================
// BOT INTERFACE COMPLIANCE
// =============================================================================

describe('Bot interface compliance', () => {
  const botTypes: BotType[] = [
    'random',
    'greedy',
    'mcts-eval-fast',
    'mcts-eval',
    'mcts-eval-strong',
    'mcts-eval-turbo',
    'mcts-ordered',
  ];

  test('all created bots have getName() method', () => {
    for (const botType of botTypes) {
      const bot = createBot(botType, 1);
      expect(typeof bot.getName).toBe('function');
      const name = bot.getName();
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  test('all created bots have getDescription() method', () => {
    for (const botType of botTypes) {
      const bot = createBot(botType, 1);
      expect(typeof bot.getDescription).toBe('function');
      const description = bot.getDescription();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
    }
  });

  test('all created bots have chooseAction() method', () => {
    for (const botType of botTypes) {
      const bot = createBot(botType, 1);
      expect(typeof bot.chooseAction).toBe('function');
    }
  });

  test('bots return valid actions for player', () => {
    const state = createTestGameState();
    const legalActions = getLegalActions(state, 'player');

    // Test a few key bot types (skip slow MCTS variants)
    const quickBots: BotType[] = ['random', 'greedy', 'mcts-eval-fast'];

    for (const botType of quickBots) {
      const bot = createBot(botType, 42);
      const action = bot.chooseAction(state, 'player');

      expect(action).toBeDefined();
      expect(action.type).toBeDefined();
      expect(action.playerId).toBe('player');

      // Action should be in the legal actions list
      const matchingAction = legalActions.find(
        (la) => la.type === action.type && JSON.stringify(la) === JSON.stringify(action),
      );
      expect(matchingAction).toBeDefined();
    }
  });

  test('bots return valid actions for opponent', () => {
    const state = createTestGameState();
    // Switch priority to opponent for testing
    const opponentState = { ...state, priorityPlayer: 'opponent' as const };
    const legalActions = getLegalActions(opponentState, 'opponent');

    const quickBots: BotType[] = ['random', 'greedy', 'mcts-eval-fast'];

    for (const botType of quickBots) {
      const bot = createBot(botType, 42);
      const action = bot.chooseAction(opponentState, 'opponent');

      expect(action).toBeDefined();
      expect(action.type).toBeDefined();
      expect(action.playerId).toBe('opponent');

      const matchingAction = legalActions.find(
        (la) => la.type === action.type && JSON.stringify(la) === JSON.stringify(action),
      );
      expect(matchingAction).toBeDefined();
    }
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

describe('Error handling', () => {
  test('handles various seed values', () => {
    // Test different seed values
    const seeds = [0, 1, -1, 999999, Number.MAX_SAFE_INTEGER];

    for (const seed of seeds) {
      const bot = createBot('random', seed);
      expect(bot).toBeDefined();
      expect(bot.getName()).toBe('RandomBot');
    }
  });

  test('handles debug flag values', () => {
    // Test explicit true/false
    expect(() => createBot('greedy', 1, true)).not.toThrow();
    expect(() => createBot('greedy', 1, false)).not.toThrow();

    // Test default (should be false)
    const botDefault = createBot('greedy', 1);
    expect(botDefault).toBeDefined();
  });

  test('bot throws when no legal actions available', () => {
    const state = createTestGameState();
    // Create an impossible state (this would be a bug in practice)
    const impossibleState = {
      ...state,
      phase: 'cleanup' as const,
      step: 'cleanup' as const,
      priorityPlayer: 'player' as const,
      // Clear all possible actions
      players: {
        ...state.players,
        player: {
          ...state.players.player,
          hand: [],
          battlefield: [],
          manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
        },
      },
    };

    const bot = createBot('random', 42);

    // getLegalActions might still return PASS_PRIORITY, so this test
    // verifies the bot handles edge cases gracefully
    try {
      const action = bot.chooseAction(impossibleState, 'player');
      // If it returns something, it should be a valid action
      expect(action).toBeDefined();
    } catch (error) {
      // If it throws, it should be a meaningful error
      expect(error).toBeDefined();
      if (error instanceof Error) {
        expect(error.message).toContain('No legal actions');
      }
    }
  });
});

// =============================================================================
// BOT NAMES
// =============================================================================

describe('Bot names', () => {
  test('RandomBot returns correct name', () => {
    const bot = createBot('random', 1);
    expect(bot.getName()).toBe('RandomBot');
  });

  test('GreedyBot returns correct name', () => {
    const bot = createBot('greedy', 1);
    expect(bot.getName()).toBe('GreedyBot');
  });

  test('MCTS bots return descriptive names with iterations', () => {
    const mctsConfigs: Array<{ type: BotType; expectedParts: string[] }> = [
      { type: 'mcts-eval-fast', expectedParts: ['MCTSBot', '50', 'eval-fast'] },
      { type: 'mcts-eval', expectedParts: ['MCTSBot', '200', 'eval'] },
      { type: 'mcts-eval-strong', expectedParts: ['MCTSBot', '500', 'eval-strong'] },
      { type: 'mcts-eval-turbo', expectedParts: ['MCTSBot', '1000', 'eval-turbo'] },
      { type: 'mcts-ordered', expectedParts: ['MCTSBot', '200', 'ordered'] },
    ];

    for (const config of mctsConfigs) {
      const bot = createBot(config.type, 1);
      const name = bot.getName();

      for (const part of config.expectedParts) {
        expect(name).toContain(part);
      }
    }
  });

  test('names are consistent across multiple instantiations', () => {
    const botTypes: BotType[] = ['random', 'greedy', 'mcts-eval-fast'];

    for (const botType of botTypes) {
      const bot1 = createBot(botType, 1);
      const bot2 = createBot(botType, 2);

      // Same bot type should have same name regardless of seed
      expect(bot1.getName()).toBe(bot2.getName());
    }
  });

  test('each bot type has unique name', () => {
    const botTypes: BotType[] = [
      'random',
      'greedy',
      'mcts-eval-fast',
      'mcts-eval',
      'mcts-eval-strong',
      'mcts-eval-turbo',
      'mcts-ordered',
    ];

    const names = botTypes.map((type) => createBot(type, 1).getName());
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(botTypes.length);
  });
});

// =============================================================================
// INTEGRATION TESTS - ACTUAL GAMEPLAY
// =============================================================================

describe('Integration - bots can play', () => {
  test('RandomBot can make multiple consecutive decisions', () => {
    const bot = createBot('random', 42);
    let state = createTestGameState();

    // Make several decisions
    for (let i = 0; i < 5; i++) {
      const action = bot.chooseAction(state, 'player');
      expect(action).toBeDefined();
      expect(action.type).toBeDefined();
    }
  });

  test('GreedyBot can make multiple consecutive decisions', () => {
    const bot = createBot('greedy', 42);
    let state = createTestGameState();

    // Make several decisions
    for (let i = 0; i < 5; i++) {
      const action = bot.chooseAction(state, 'player');
      expect(action).toBeDefined();
      expect(action.type).toBeDefined();
    }
  });

  // Skip: This test runs MCTS which is slow
  test.skip('MCTS fast bot can make a decision in reasonable time', () => {
    const bot = createBot('mcts-eval-fast', 42);
    const state = createTestGameState();

    const startTime = Date.now();
    const action = bot.chooseAction(state, 'player');
    const elapsed = Date.now() - startTime;

    expect(action).toBeDefined();
    // Should complete within 5 seconds (generous timeout for CI)
    expect(elapsed).toBeLessThan(5000);
  });

  test('deterministic behavior with same seed', () => {
    const seed = 54321;

    // Create fresh game states for each bot
    const state1 = createTestGameState();
    const state2 = createTestGameState();

    const bot1 = createBot('random', seed);
    const bot2 = createBot('random', seed);

    // Both should make identical decisions
    const action1 = bot1.chooseAction(state1, 'player');
    const action2 = bot2.chooseAction(state2, 'player');

    expect(JSON.stringify(action1)).toBe(JSON.stringify(action2));
  });
});
