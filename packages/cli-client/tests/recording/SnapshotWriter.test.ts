/**
 * SnapshotWriter Tests
 *
 * Comprehensive tests for the error snapshot creation module.
 * Tests snapshot creation, file output, error capture, and edge cases.
 */

import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import {
  initializeGame,
  applyAction,
  getLegalActions,
  createRedDeck,
  createGreenDeck,
  _resetInstanceCounter,
  _resetModificationCounter,
} from '@manacore/engine';
import type { GameState, Action } from '@manacore/engine';
import { SnapshotWriter, GameError, type GameSnapshot } from '../../src/recording/SnapshotWriter';
import {
  createTempDir,
  cleanupTempDir,
  cleanupAllTempDirs,
  readJsonFile,
  readTextFile,
} from '../helpers';

// Test output directory - use a dedicated test directory
const TEST_DIR = '/tmp/manacore-snapshot-tests';

/**
 * Simple seeded RNG for deterministic tests
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Play a test game and return state with actions
 */
function playTestGame(
  gameSeed: number,
  botSeed: number,
  maxTurns: number = 10,
): { state: GameState; actions: Action[] } {
  _resetInstanceCounter();
  _resetModificationCounter();

  const playerDeck = createRedDeck();
  const opponentDeck = createGreenDeck();
  let state = initializeGame(playerDeck, opponentDeck, gameSeed);

  const rng = createSeededRandom(botSeed);
  const actions: Action[] = [];

  while (!state.gameOver && state.turnCount <= maxTurns) {
    const legalActions = getLegalActions(state, state.priorityPlayer);
    if (legalActions.length === 0) break;

    const index = Math.floor(rng() * legalActions.length);
    const action = legalActions[index]!;
    actions.push(action);
    state = applyAction(state, action);
  }

  return { state, actions };
}

/**
 * Create a GameError from test game state
 */
function createTestError(
  message: string,
  state: GameState,
  recentActions: Action[],
  seed?: number,
): GameError {
  return new GameError(message, state, recentActions, seed);
}

// Cleanup after all tests
afterAll(() => {
  cleanupAllTempDirs();
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe('SnapshotWriter', () => {
  let tempDir: string;
  let snapshotWriter: SnapshotWriter;

  beforeEach(() => {
    _resetInstanceCounter();
    _resetModificationCounter();

    // Ensure test directory exists
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }

    tempDir = createTempDir('snapshot-writer');
    snapshotWriter = new SnapshotWriter();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('Snapshot Creation', () => {
    test('creates snapshot files with correct naming', async () => {
      const { state, actions } = playTestGame(12345, 54321);
      const error = createTestError('Test error message', state, actions, 12345);

      const result = await snapshotWriter.writeSnapshot(1, error, false);

      // Should create JSON file
      expect(result.jsonFile).toBeDefined();
      expect(existsSync(result.jsonFile!)).toBe(true);

      // Filename should contain game number, seed, and timestamp
      expect(result.jsonFile!).toContain('game-1');
      expect(result.jsonFile!).toContain('seed-12345');
      expect(result.jsonFile!).toContain('.json');
    });

    test('captures game state accurately in JSON snapshot', async () => {
      const { state, actions } = playTestGame(42, 99, 5);
      const error = createTestError('State capture test', state, actions, 42);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      // Verify game state fields match
      expect(snapshot.gameState.turn).toBe(state.turnCount);
      expect(snapshot.gameState.phase).toBe(state.phase);
      expect(snapshot.gameState.activePlayer).toBe(state.activePlayer);
      expect(snapshot.gameState.priorityPlayer).toBe(state.priorityPlayer);
      expect(snapshot.gameState.gameOver).toBe(state.gameOver);
      expect(snapshot.gameState.winner).toBe(state.winner);
    });

    test('includes error information in snapshot', async () => {
      const { state, actions } = playTestGame(100, 200);
      const errorMessage = 'Specific error message for testing';
      const error = createTestError(errorMessage, state, actions, 100);

      const result = await snapshotWriter.writeSnapshot(5, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      expect(snapshot.error.message).toBe(errorMessage);
      expect(snapshot.error.stack).toBeDefined();
      expect(snapshot.error.stack!.length).toBeGreaterThan(0);
    });

    test('timestamps are valid ISO format', async () => {
      const { state, actions } = playTestGame(111, 222);
      const error = createTestError('Timestamp test', state, actions, 111);

      const beforeTime = new Date().toISOString();
      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const afterTime = new Date().toISOString();

      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      // Verify timestamp is valid ISO format
      const timestamp = new Date(snapshot.metadata.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.toString()).not.toBe('Invalid Date');

      // Verify timestamp is in expected range
      expect(snapshot.metadata.timestamp >= beforeTime.slice(0, 19)).toBe(true);
    });

    test('version field is set correctly', async () => {
      const { state, actions } = playTestGame(333, 444);
      const error = createTestError('Version test', state, actions, 333);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      expect(snapshot.version).toBe('1.0');
    });
  });

  describe('File Output', () => {
    test('writes to errors directory', async () => {
      const { state, actions } = playTestGame(555, 666);
      const error = createTestError('Directory test', state, actions, 555);

      const result = await snapshotWriter.writeSnapshot(1, error, false);

      // Should be in errors directory
      expect(result.jsonFile!).toContain('/errors/');
    });

    test('creates directory if needed', async () => {
      const { state, actions } = playTestGame(777, 888);
      const error = createTestError('Directory creation test', state, actions, 777);

      // This should not throw even if output/errors doesn't exist
      const result = await snapshotWriter.writeSnapshot(1, error, false);

      expect(result.jsonFile).toBeDefined();
      expect(existsSync(result.jsonFile!)).toBe(true);
    });

    test('file format is valid JSON', async () => {
      const { state, actions } = playTestGame(999, 1000);
      const error = createTestError('JSON validity test', state, actions, 999);

      const result = await snapshotWriter.writeSnapshot(1, error, false);

      // Should not throw when parsing
      const parseTest = () => readJsonFile<GameSnapshot>(result.jsonFile!);
      expect(parseTest).not.toThrow();
    });

    test('contains all required fields', async () => {
      const { state, actions } = playTestGame(1111, 2222);
      const error = createTestError('Required fields test', state, actions, 1111);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      // Check all required top-level fields
      expect(snapshot.version).toBeDefined();
      expect(snapshot.metadata).toBeDefined();
      expect(snapshot.error).toBeDefined();
      expect(snapshot.gameState).toBeDefined();
      expect(snapshot.players).toBeDefined();
      expect(snapshot.recentActions).toBeDefined();
      expect(snapshot.legalActions).toBeDefined();

      // Check metadata fields
      expect(snapshot.metadata.seed).toBe(1111);
      expect(snapshot.metadata.gameNumber).toBe(1);
      expect(snapshot.metadata.timestamp).toBeDefined();
    });

    test('writes text file when verbose is true', async () => {
      const { state, actions } = playTestGame(3333, 4444);
      const error = createTestError('Verbose test', state, actions, 3333);

      const result = await snapshotWriter.writeSnapshot(1, error, true);

      // Should create both JSON and text files
      expect(result.jsonFile).toBeDefined();
      expect(result.textFile).toBeDefined();
      expect(existsSync(result.jsonFile!)).toBe(true);
      expect(existsSync(result.textFile!)).toBe(true);

      // Text file should have .txt extension
      expect(result.textFile!).toContain('.txt');
    });

    test('does not write text file when verbose is false', async () => {
      const { state, actions } = playTestGame(5555, 6666);
      const error = createTestError('Non-verbose test', state, actions, 5555);

      const result = await snapshotWriter.writeSnapshot(1, error, false);

      expect(result.jsonFile).toBeDefined();
      expect(result.textFile).toBeUndefined();
    });
  });

  describe('Error Capture', () => {
    test('captures error message', async () => {
      const { state, actions } = playTestGame(7777, 8888);
      const errorMessage = 'Custom error message: Something went wrong at turn 5';
      const error = createTestError(errorMessage, state, actions, 7777);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      expect(snapshot.error.message).toBe(errorMessage);
    });

    test('captures stack trace', async () => {
      const { state, actions } = playTestGame(9999, 10000);
      const error = createTestError('Stack trace test', state, actions, 9999);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      expect(snapshot.error.stack).toBeDefined();
      expect(snapshot.error.stack!).toContain('GameError');
    });

    test('captures action that caused error (via recent actions)', async () => {
      const { state, actions } = playTestGame(11111, 22222, 15);
      const error = createTestError('Action capture test', state, actions, 11111);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      // Recent actions should be captured (last 10)
      expect(snapshot.recentActions.length).toBeGreaterThan(0);
      expect(snapshot.recentActions.length).toBeLessThanOrEqual(10);
    });

    test('captures game state at time of error', async () => {
      const { state, actions } = playTestGame(33333, 44444);
      const error = createTestError('State at error test', state, actions, 33333);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      // Game state should reflect the state passed to the error
      expect(snapshot.gameState.turn).toBe(state.turnCount);
      expect(snapshot.gameState.phase).toBe(state.phase);
      expect(snapshot.gameState.step).toBe(state.step);
    });
  });

  describe('Snapshot Content', () => {
    test('game state is complete', async () => {
      const { state, actions } = playTestGame(55555, 66666);
      const error = createTestError('Complete state test', state, actions, 55555);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      // All game state fields should be present
      expect(snapshot.gameState.turn).toBeDefined();
      expect(snapshot.gameState.phase).toBeDefined();
      expect(snapshot.gameState.step).toBeDefined();
      expect(snapshot.gameState.activePlayer).toBeDefined();
      expect(snapshot.gameState.priorityPlayer).toBeDefined();
      expect(typeof snapshot.gameState.gameOver).toBe('boolean');
      expect(
        snapshot.gameState.winner === null || typeof snapshot.gameState.winner === 'string',
      ).toBe(true);
    });

    test('player states included', async () => {
      const { state, actions } = playTestGame(77777, 88888);
      const error = createTestError('Player states test', state, actions, 77777);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      // Should have exactly 2 players
      expect(snapshot.players.length).toBe(2);

      // Each player should have required fields
      for (const player of snapshot.players) {
        expect(player.playerId).toBeDefined();
        expect(typeof player.life).toBe('number');
        expect(typeof player.handSize).toBe('number');
        expect(typeof player.librarySize).toBe('number');
        expect(typeof player.graveyardSize).toBe('number');
        expect(typeof player.battlefieldSize).toBe('number');
        expect(player.manaPool).toBeDefined();
      }
    });

    test('battlefield state included', async () => {
      const { state, actions } = playTestGame(99999, 100000, 20);
      const error = createTestError('Battlefield test', state, actions, 99999);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      // Battlefield size should match actual state
      for (const player of snapshot.players) {
        const playerId = player.playerId as 'player' | 'opponent';
        const actualBattlefield = state.players[playerId].battlefield;
        expect(player.battlefieldSize).toBe(actualBattlefield.length);
      }
    });

    test('action history included (via recent actions)', async () => {
      const { state, actions } = playTestGame(111111, 222222, 15);
      const error = createTestError('Action history test', state, actions, 111111);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      // Should have recent actions (up to 10)
      expect(Array.isArray(snapshot.recentActions)).toBe(true);
      if (actions.length > 0) {
        expect(snapshot.recentActions.length).toBeGreaterThan(0);
      }
    });

    test('legal actions included in snapshot', async () => {
      const { state, actions } = playTestGame(333333, 444444);
      const error = createTestError('Legal actions test', state, actions, 333333);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      expect(Array.isArray(snapshot.legalActions)).toBe(true);
      // Legal actions should be up to 10
      expect(snapshot.legalActions.length).toBeLessThanOrEqual(10);
    });

    test('mana pool captured correctly', async () => {
      const { state, actions } = playTestGame(555555, 666666);
      const error = createTestError('Mana pool test', state, actions, 555555);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      for (const player of snapshot.players) {
        expect(player.manaPool).toBeDefined();
        expect(typeof player.manaPool.white).toBe('number');
        expect(typeof player.manaPool.blue).toBe('number');
        expect(typeof player.manaPool.black).toBe('number');
        expect(typeof player.manaPool.red).toBe('number');
        expect(typeof player.manaPool.green).toBe('number');
        expect(typeof player.manaPool.colorless).toBe('number');
      }
    });
  });

  describe('Edge Cases', () => {
    test('handles very large game states', async () => {
      // Play a longer game to create more state
      const { state, actions } = playTestGame(777777, 888888, 50);
      const error = createTestError('Large state test', state, actions, 777777);

      const result = await snapshotWriter.writeSnapshot(1, error, false);

      expect(result.jsonFile).toBeDefined();
      expect(existsSync(result.jsonFile!)).toBe(true);

      // Should still be valid JSON
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);
      expect(snapshot.version).toBe('1.0');
    });

    test('handles missing optional fields gracefully', async () => {
      const { state, actions } = playTestGame(999999, 1111111);
      // Create error with undefined seed
      const error = createTestError('Missing fields test', state, actions, undefined);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      // Seed should be undefined in snapshot
      expect(snapshot.metadata.seed).toBeUndefined();

      // Filename should contain 'random' for undefined seed
      expect(result.jsonFile!).toContain('seed-random');
    });

    test('handles empty action history', async () => {
      const { state } = playTestGame(2222222, 3333333);
      // Create error with empty actions array
      const error = createTestError('Empty actions test', state, [], 2222222);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      expect(Array.isArray(snapshot.recentActions)).toBe(true);
      expect(snapshot.recentActions.length).toBe(0);
    });

    test('handles game over state', async () => {
      // Play game to completion
      const { state, actions } = playTestGame(4444444, 5555555, 100);

      // Ensure we have a game over state by manipulating if needed
      const gameOverState = { ...state, gameOver: true, winner: 'player' as const };
      const error = createTestError('Game over test', gameOverState, actions, 4444444);

      const result = await snapshotWriter.writeSnapshot(1, error, false);
      const snapshot = readJsonFile<GameSnapshot>(result.jsonFile!);

      expect(snapshot.gameState.gameOver).toBe(true);
      expect(snapshot.gameState.winner).toBe('player');
    });

    test('handles game number correctly', async () => {
      const { state, actions } = playTestGame(6666666, 7777777);
      const error = createTestError('Game number test', state, actions, 6666666);

      // Test different game numbers
      const result1 = await snapshotWriter.writeSnapshot(1, error, false);
      const result42 = await snapshotWriter.writeSnapshot(42, error, false);
      const result999 = await snapshotWriter.writeSnapshot(999, error, false);

      // Filenames should contain correct game numbers
      expect(result1.jsonFile!).toContain('game-1');
      expect(result42.jsonFile!).toContain('game-42');
      expect(result999.jsonFile!).toContain('game-999');

      // Metadata should have correct game numbers
      const snap1 = readJsonFile<GameSnapshot>(result1.jsonFile!);
      const snap42 = readJsonFile<GameSnapshot>(result42.jsonFile!);
      const snap999 = readJsonFile<GameSnapshot>(result999.jsonFile!);

      expect(snap1.metadata.gameNumber).toBe(1);
      expect(snap42.metadata.gameNumber).toBe(42);
      expect(snap999.metadata.gameNumber).toBe(999);
    });

    test('handles concurrent writes without conflict', async () => {
      const { state, actions } = playTestGame(8888888, 9999999);
      const error = createTestError('Concurrent test', state, actions, 8888888);

      // Write multiple snapshots concurrently
      const promises = [
        snapshotWriter.writeSnapshot(1, error, false),
        snapshotWriter.writeSnapshot(2, error, false),
        snapshotWriter.writeSnapshot(3, error, false),
      ];

      const results = await Promise.all(promises);

      // All should succeed
      for (const result of results) {
        expect(result.jsonFile).toBeDefined();
        expect(existsSync(result.jsonFile!)).toBe(true);
      }

      // All should be different files
      const files = new Set(results.map((r) => r.jsonFile));
      expect(files.size).toBe(3);
    });
  });

  describe('Text Snapshot Format', () => {
    test('text snapshot contains error section', async () => {
      const { state, actions } = playTestGame(11111111, 22222222);
      const errorMessage = 'Text format error message';
      const error = createTestError(errorMessage, state, actions, 11111111);

      const result = await snapshotWriter.writeSnapshot(1, error, true);
      const textContent = readTextFile(result.textFile!);

      expect(textContent).toContain('ERROR:');
      expect(textContent).toContain(errorMessage);
    });

    test('text snapshot contains game state section', async () => {
      const { state, actions } = playTestGame(33333333, 44444444);
      const error = createTestError('Text state test', state, actions, 33333333);

      const result = await snapshotWriter.writeSnapshot(1, error, true);
      const textContent = readTextFile(result.textFile!);

      expect(textContent).toContain('GAME STATE:');
      expect(textContent).toContain('Turn:');
      expect(textContent).toContain('Phase:');
      expect(textContent).toContain('Active Player:');
      expect(textContent).toContain('Priority Player:');
    });

    test('text snapshot contains player sections', async () => {
      const { state, actions } = playTestGame(55555555, 66666666);
      const error = createTestError('Text player test', state, actions, 55555555);

      const result = await snapshotWriter.writeSnapshot(1, error, true);
      const textContent = readTextFile(result.textFile!);

      expect(textContent).toContain('PLAYER:');
      expect(textContent).toContain('OPPONENT:');
      expect(textContent).toContain('Life:');
      expect(textContent).toContain('Hand:');
      expect(textContent).toContain('Library:');
      expect(textContent).toContain('Battlefield:');
    });

    test('text snapshot contains header with metadata', async () => {
      const { state, actions } = playTestGame(77777777, 88888888);
      const error = createTestError('Text header test', state, actions, 77777777);

      const result = await snapshotWriter.writeSnapshot(1, error, true);
      const textContent = readTextFile(result.textFile!);

      expect(textContent).toContain('Seed: 77777777');
      expect(textContent).toContain('Game Number: 1');
      expect(textContent).toContain('Timestamp:');
    });

    test('text snapshot contains legal actions section', async () => {
      const { state, actions } = playTestGame(99999999, 111111111);
      const error = createTestError('Text legal actions test', state, actions, 99999999);

      const result = await snapshotWriter.writeSnapshot(1, error, true);
      const textContent = readTextFile(result.textFile!);

      expect(textContent).toContain('LEGAL ACTIONS FOR PRIORITY PLAYER:');
    });
  });

  describe('GameError Class', () => {
    test('GameError has correct name', () => {
      const { state, actions } = playTestGame(222222222, 333333333);
      const error = new GameError('Test', state, actions, 12345);

      expect(error.name).toBe('GameError');
    });

    test('GameError preserves state reference', () => {
      const { state, actions } = playTestGame(444444444, 555555555);
      const error = new GameError('Test', state, actions, 12345);

      expect(error.state).toBe(state);
    });

    test('GameError preserves recentActions reference', () => {
      const { state, actions } = playTestGame(666666666, 777777777);
      const error = new GameError('Test', state, actions, 12345);

      expect(error.recentActions).toBe(actions);
    });

    test('GameError preserves seed', () => {
      const { state, actions } = playTestGame(888888888, 999999999);
      const error = new GameError('Test', state, actions, 54321);

      expect(error.seed).toBe(54321);
    });

    test('GameError message is accessible', () => {
      const { state, actions } = playTestGame(1234567890, 9876543210);
      const message = 'Custom error message for testing';
      const error = new GameError(message, state, actions, 12345);

      expect(error.message).toBe(message);
    });
  });

  describe('generateTextSnapshot Method', () => {
    test('generates readable text output', () => {
      const { state, actions } = playTestGame(1111111111, 2222222222);
      const error = new Error('Test error for text generation');

      const textOutput = snapshotWriter.generateTextSnapshot(state, actions, error);

      expect(typeof textOutput).toBe('string');
      expect(textOutput.length).toBeGreaterThan(0);
      expect(textOutput).toContain('ERROR STATE SNAPSHOT');
    });

    test('includes separators for readability', () => {
      const { state, actions } = playTestGame(3333333333, 4444444444);
      const error = new Error('Separator test');

      const textOutput = snapshotWriter.generateTextSnapshot(state, actions, error);

      // Should contain separator lines
      expect(textOutput).toContain('═'.repeat(80));
    });

    test('handles empty actions array', () => {
      const { state } = playTestGame(5555555555, 6666666666);
      const error = new Error('Empty actions');

      const textOutput = snapshotWriter.generateTextSnapshot(state, [], error);

      expect(typeof textOutput).toBe('string');
      // Should not contain RECENT ACTIONS section with entries
      expect(textOutput).not.toContain('RECENT ACTIONS (last 10):');
    });

    test('limits recent actions to 10', () => {
      const { state, actions } = playTestGame(7777777777, 8888888888, 50);
      const error = new Error('Actions limit test');

      // Make sure we have more than 10 actions
      if (actions.length < 10) {
        // Pad with dummy actions for testing
        while (actions.length < 15) {
          actions.push({ type: 'PASS_PRIORITY', playerId: 'player', payload: {} });
        }
      }

      const textOutput = snapshotWriter.generateTextSnapshot(state, actions, error);

      // Count action entries (format: "  N. [playerId] description")
      const actionMatches = textOutput.match(/\s+\d+\.\s+\[/g);
      if (actionMatches && actions.length >= 10) {
        expect(actionMatches.length).toBeLessThanOrEqual(10);
      }
    });
  });
});
