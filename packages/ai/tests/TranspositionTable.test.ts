/**
 * Tests for TranspositionTable (Phase 3.2)
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { TranspositionTable, DEFAULT_TRANSPOSITION_CONFIG } from '../src/search/TranspositionTable';
import { MCTSBot } from '../src/bots/MCTSBot';
import { initializeGame, createRedDeck, createGreenDeck, applyAction } from '@manacore/engine';

describe('TranspositionTable', () => {
  let tt: TranspositionTable;

  beforeEach(() => {
    tt = new TranspositionTable();
  });

  test('computes consistent hash for same state', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const hash1 = tt.computeHash(state, 'player');
    const hash2 = tt.computeHash(state, 'player');

    expect(hash1).toBe(hash2);
  });

  test('computes different hash for different life totals', () => {
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state1 = initializeGame(playerDeck, opponentDeck, 12345);
    // Modify life to create different state
    const state2 = {
      ...state1,
      players: {
        ...state1.players,
        player: { ...state1.players.player, life: 15 },
      },
    };

    const hash1 = tt.computeHash(state1, 'player');
    const hash2 = tt.computeHash(state2, 'player');

    // Different life totals should produce different hashes
    expect(hash1).not.toBe(hash2);
  });

  test('stores and retrieves entries', () => {
    const hash = 'test-hash-1';

    tt.store(hash, 10, 7.5, 0);

    const entry = tt.lookup(hash);
    expect(entry).toBeDefined();
    expect(entry!.visits).toBe(10);
    expect(entry!.totalReward).toBe(7.5);
  });

  test('returns undefined for missing entries', () => {
    const entry = tt.lookup('nonexistent-hash');
    expect(entry).toBeUndefined();
  });

  test('tracks hits and misses', () => {
    const hash = 'test-hash-2';
    tt.store(hash, 5, 2.5, 0);

    tt.lookup(hash); // Hit
    tt.lookup(hash); // Hit
    tt.lookup('missing'); // Miss

    const stats = tt.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.667, 1);
  });

  test('evicts entries when full (LRU)', () => {
    const smallTT = new TranspositionTable({
      maxSize: 10,
      evictionRatio: 0.5, // Evict 50% when full
    });

    // Fill the table
    for (let i = 0; i < 10; i++) {
      smallTT.store(`hash-${i}`, i, i * 0.1, 0);
    }

    expect(smallTT.size).toBe(10);

    // Access some entries to update their lastAccess
    smallTT.lookup('hash-5');
    smallTT.lookup('hash-6');
    smallTT.lookup('hash-7');

    // Add a new entry - should trigger eviction
    smallTT.store('hash-new', 100, 50, 0);

    // Should have evicted ~5 entries (50%)
    expect(smallTT.size).toBeLessThanOrEqual(6);

    // Recently accessed entries should still be there
    expect(smallTT.lookup('hash-5')).toBeDefined();
    expect(smallTT.lookup('hash-6')).toBeDefined();
    expect(smallTT.lookup('hash-7')).toBeDefined();
    expect(smallTT.lookup('hash-new')).toBeDefined();
  });

  test('clears table and stats', () => {
    tt.store('hash-1', 10, 5, 0);
    tt.store('hash-2', 20, 10, 0);
    tt.lookup('hash-1');

    tt.clear();

    expect(tt.size).toBe(0);
    const stats = tt.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  test('updates existing entries with max values', () => {
    const hash = 'test-hash-3';

    // First store
    tt.store(hash, 10, 5, 2);

    // Second store with higher values
    tt.store(hash, 20, 12, 1);

    const entry = tt.lookup(hash);
    expect(entry!.visits).toBe(20); // Max of 10, 20
    expect(entry!.totalReward).toBe(12); // Max of 5, 12
    expect(entry!.depth).toBe(1); // Min of 2, 1
  });
});

describe('DEFAULT_TRANSPOSITION_CONFIG', () => {
  test('has sensible defaults', () => {
    expect(DEFAULT_TRANSPOSITION_CONFIG.maxSize).toBe(100_000);
    expect(DEFAULT_TRANSPOSITION_CONFIG.evictionPolicy).toBe('lru');
    expect(DEFAULT_TRANSPOSITION_CONFIG.evictionRatio).toBe(0.1);
  });
});

describe('TranspositionTable hash features', () => {
  test('hash includes life totals', () => {
    const table = new TranspositionTable();
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const hash = table.computeHash(state, 'player');

    // Should include life totals in format "L:20/20"
    expect(hash).toContain('L:');
  });

  test('hash includes hand sizes', () => {
    const table = new TranspositionTable();
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const hash = table.computeHash(state, 'player');

    // Should include hand sizes in format "H:7/7"
    expect(hash).toContain('H:');
  });

  test('hash includes phase', () => {
    const table = new TranspositionTable();
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const hash = table.computeHash(state, 'player');

    // Should include phase info
    expect(hash).toContain('P:');
  });

  test('hash includes battlefield', () => {
    const table = new TranspositionTable();
    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    const hash = table.computeHash(state, 'player');

    // Should include battlefield markers
    expect(hash).toContain('PB:');
    expect(hash).toContain('OB:');
  });
});

describe('MCTSBot with TranspositionTable', () => {
  test('creates bot with transposition table', () => {
    const tt = new TranspositionTable({ maxSize: 10_000 });
    const bot = new MCTSBot({
      iterations: 50,
      rolloutDepth: 0,
      transpositionTable: tt,
    });

    expect(bot.getName()).toContain('MCTSBot');
  });

  test('bot uses transposition table during search', () => {
    const tt = new TranspositionTable({ maxSize: 10_000 });
    const bot = new MCTSBot({
      iterations: 50,
      rolloutDepth: 0,
      transpositionTable: tt,
    });

    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    // Make a decision
    bot.chooseAction(state, 'player');

    // Transposition table should have entries
    const stats = tt.getStats();
    expect(stats.size).toBeGreaterThan(0);
  });

  test('transposition table accumulates across decisions', () => {
    const tt = new TranspositionTable({ maxSize: 50_000 });
    const bot = new MCTSBot({
      iterations: 30,
      rolloutDepth: 0,
      transpositionTable: tt,
    });

    const playerDeck = createRedDeck();
    const opponentDeck = createGreenDeck();
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    // Make multiple decisions
    bot.chooseAction(state, 'player');
    const sizeAfterFirst = tt.size;

    bot.chooseAction(state, 'player');
    const sizeAfterSecond = tt.size;

    // Table should grow (or at least maintain) with more decisions
    expect(sizeAfterSecond).toBeGreaterThanOrEqual(sizeAfterFirst);
  });
});
