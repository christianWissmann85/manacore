/**
 * Replay System Tests
 *
 * Tests for recording, saving, loading, and replaying games.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import {
  initializeGame,
  applyAction,
  getLegalActions,
  createRedDeck,
  createGreenDeck,
  createBlueDeck,
  _resetInstanceCounter,
  _resetModificationCounter,
} from '@manacore/engine';
import type { GameState, Action } from '@manacore/engine';
import {
  ReplayRecorder,
  createReplayFromGame,
  saveReplay,
  loadReplay,
  replayGame,
  replayToTurn,
  replayToAction,
  verifyReplay,
  getReplaySummary,
  REPLAY_VERSION,
} from '../src/replay';
import type { ReplayFile } from '../src/types';

// Test output directory
const TEST_DIR = '/tmp/manacore-replay-tests';

/**
 * Simple seeded RNG for tests
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Play a game and return the final state with actions
 */
function playTestGame(
  gameSeed: number,
  botSeed: number,
  maxTurns: number = 30,
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

describe('ReplayRecorder', () => {
  beforeEach(() => {
    _resetInstanceCounter();
    _resetModificationCounter();

    // Ensure test directory exists
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  test('creates replay with correct version', () => {
    const { state } = playTestGame(42, 99, 10);

    const recorder = new ReplayRecorder({
      gameSeed: 42,
      decks: {
        player: { name: 'Red Deck' },
        opponent: { name: 'Green Deck' },
      },
    });

    recorder.recordFromState(state);
    recorder.setOutcomeFromState(state);

    const replay = recorder.build();

    expect(replay.version).toBe(REPLAY_VERSION);
    expect(replay.seeds.game).toBe(42);
    expect(replay.decks.player.name).toBe('Red Deck');
    expect(replay.decks.opponent.name).toBe('Green Deck');
  });

  test('records actions from state', () => {
    const { state, actions } = playTestGame(42, 99, 10);

    const recorder = new ReplayRecorder({
      gameSeed: 42,
      decks: {
        player: { name: 'Red Deck' },
        opponent: { name: 'Green Deck' },
      },
    });

    recorder.recordFromState(state);
    recorder.setOutcomeFromState(state);

    expect(recorder.getActionCount()).toBe(actions.length);

    const replay = recorder.build();
    expect(replay.actions.length).toBe(actions.length);
  });

  test('records outcome correctly', () => {
    const { state } = playTestGame(42, 99, 50);

    const recorder = new ReplayRecorder({
      gameSeed: 42,
      decks: {
        player: { name: 'Red Deck' },
        opponent: { name: 'Green Deck' },
      },
    });

    recorder.recordFromState(state);
    recorder.setOutcomeFromState(state);

    const replay = recorder.build();

    expect(replay.outcome.winner).toBe(state.winner);
    expect(replay.outcome.turns).toBe(state.turnCount);
    expect(replay.outcome.finalLife?.player).toBe(state.players.player.life);
    expect(replay.outcome.finalLife?.opponent).toBe(state.players.opponent.life);
  });

  test('generates valid filename', () => {
    const recorder = new ReplayRecorder({
      gameSeed: 12345,
      decks: {
        player: { name: 'Red Deck' },
        opponent: { name: 'Green Deck' },
      },
    });

    recorder.setOutcome('player', 10, 'life');

    const filename = recorder.generateFilename();

    expect(filename).toContain('game-12345');
    expect(filename).toContain('player');
    expect(filename).toContain('.replay.json');
  });
});

describe('createReplayFromGame', () => {
  beforeEach(() => {
    _resetInstanceCounter();
    _resetModificationCounter();
  });

  test('creates complete replay from GameState', () => {
    const { state } = playTestGame(42, 99, 20);

    const replay = createReplayFromGame(state, {
      decks: {
        player: { name: 'Red Deck' },
        opponent: { name: 'Green Deck' },
      },
    });

    expect(replay.version).toBe(REPLAY_VERSION);
    expect(replay.seeds.game).toBe(state.rngSeed);
    expect(replay.actions.length).toBeGreaterThan(0);
    expect(replay.outcome.turns).toBe(state.turnCount);
  });
});

describe('saveReplay / loadReplay', () => {
  const testFile = `${TEST_DIR}/test-save-load.replay.json`;

  beforeEach(() => {
    _resetInstanceCounter();
    _resetModificationCounter();

    // Clean up test file
    if (existsSync(testFile)) {
      unlinkSync(testFile);
    }
  });

  test('saves and loads replay file', () => {
    const { state } = playTestGame(42, 99, 15);

    const replay = createReplayFromGame(state, {
      decks: {
        player: { name: 'Red Deck' },
        opponent: { name: 'Green Deck' },
      },
    });

    // Save
    saveReplay(replay, testFile);
    expect(existsSync(testFile)).toBe(true);

    // Load
    const loaded = loadReplay(testFile);

    expect(loaded.version).toBe(replay.version);
    expect(loaded.seeds.game).toBe(replay.seeds.game);
    expect(loaded.actions.length).toBe(replay.actions.length);
    expect(loaded.outcome.winner).toBe(replay.outcome.winner);
    expect(loaded.outcome.turns).toBe(replay.outcome.turns);
  });

  test('throws on missing file', () => {
    expect(() => loadReplay('/nonexistent/file.replay.json')).toThrow('not found');
  });
});

describe('replayGame', () => {
  beforeEach(() => {
    _resetInstanceCounter();
    _resetModificationCounter();
  });

  test('replays game to identical final state', () => {
    // Play original game
    const { state: originalState } = playTestGame(42, 99, 20);

    // Create replay
    const replay = createReplayFromGame(originalState, {
      decks: {
        player: { name: 'red' },
        opponent: { name: 'green' },
      },
    });

    // Replay
    const result = replayGame(replay);

    // Should match
    expect(result.outcomeMatched).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.finalState.winner).toBe(originalState.winner);
    expect(result.finalState.turnCount).toBe(originalState.turnCount);
    expect(result.finalState.players.player.life).toBe(originalState.players.player.life);
    expect(result.finalState.players.opponent.life).toBe(originalState.players.opponent.life);
  });

  test('stops at specified turn', () => {
    const { state } = playTestGame(42, 99, 30);

    const replay = createReplayFromGame(state, {
      decks: {
        player: { name: 'red' },
        opponent: { name: 'green' },
      },
    });

    const result = replayGame(replay, { stopAtTurn: 5 });

    expect(result.finalState.turnCount).toBeLessThanOrEqual(6); // May be 5 or 6 depending on when we check
  });

  test('stops at specified action', () => {
    const { state } = playTestGame(42, 99, 30);

    const replay = createReplayFromGame(state, {
      decks: {
        player: { name: 'red' },
        opponent: { name: 'green' },
      },
    });

    const result = replayGame(replay, { stopAtAction: 10 });

    // Should have processed at most 10 actions
    expect(result.snapshots?.length).toBeLessThanOrEqual(11); // +1 for initial
  });

  test('calls onAction callback', () => {
    const { state } = playTestGame(42, 99, 10);

    const replay = createReplayFromGame(state, {
      decks: {
        player: { name: 'red' },
        opponent: { name: 'green' },
      },
    });

    const callbackCalls: number[] = [];

    replayGame(replay, {
      onAction: (actionIndex) => {
        callbackCalls.push(actionIndex);
      },
    });

    expect(callbackCalls.length).toBeGreaterThan(0);
    expect(callbackCalls[0]).toBe(0);
  });
});

describe('replayToTurn / replayToAction', () => {
  beforeEach(() => {
    _resetInstanceCounter();
    _resetModificationCounter();
  });

  test('replayToTurn returns state at target turn', () => {
    const { state } = playTestGame(42, 99, 30);

    const replay = createReplayFromGame(state, {
      decks: {
        player: { name: 'red' },
        opponent: { name: 'green' },
      },
    });

    const stateAtTurn5 = replayToTurn(replay, 5);

    expect(stateAtTurn5.turnCount).toBeLessThanOrEqual(6);
  });

  test('replayToAction returns state at target action', () => {
    const { state } = playTestGame(42, 99, 30);

    const replay = createReplayFromGame(state, {
      decks: {
        player: { name: 'red' },
        opponent: { name: 'green' },
      },
    });

    // Should not throw
    const stateAt10 = replayToAction(replay, 10);
    expect(stateAt10).toBeDefined();
  });
});

describe('verifyReplay', () => {
  beforeEach(() => {
    _resetInstanceCounter();
    _resetModificationCounter();
  });

  test('returns valid for correct replay', () => {
    const { state } = playTestGame(42, 99, 20);

    const replay = createReplayFromGame(state, {
      decks: {
        player: { name: 'red' },
        opponent: { name: 'green' },
      },
    });

    const result = verifyReplay(replay);

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test('detects corrupted replay', () => {
    const { state } = playTestGame(42, 99, 20);

    const replay = createReplayFromGame(state, {
      decks: {
        player: { name: 'red' },
        opponent: { name: 'green' },
      },
    });

    // Corrupt the outcome
    replay.outcome.turns = 999;

    const result = verifyReplay(replay);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('getReplaySummary', () => {
  beforeEach(() => {
    _resetInstanceCounter();
    _resetModificationCounter();
  });

  test('returns correct summary information', () => {
    const { state } = playTestGame(42, 99, 20);

    const replay = createReplayFromGame(state, {
      decks: {
        player: { name: 'Red Aggro' },
        opponent: { name: 'Green Midrange' },
      },
    });

    const summary = getReplaySummary(replay);

    expect(summary.version).toBe(REPLAY_VERSION);
    expect(summary.seed).toBe(42);
    expect(summary.playerDeck).toBe('Red Aggro');
    expect(summary.opponentDeck).toBe('Green Midrange');
    expect(summary.turns).toBe(state.turnCount);
    expect(summary.actionCount).toBe(replay.actions.length);
  });
});

describe('Integration: Full Replay Cycle', () => {
  const testFile = `${TEST_DIR}/integration-test.replay.json`;

  beforeEach(() => {
    _resetInstanceCounter();
    _resetModificationCounter();

    if (existsSync(testFile)) {
      unlinkSync(testFile);
    }
  });

  test('record -> save -> load -> replay produces identical result', () => {
    // Step 1: Play a game
    const { state: originalState } = playTestGame(12345, 67890, 25);

    // Step 2: Record it
    const replay = createReplayFromGame(originalState, {
      decks: {
        player: { name: 'red' },
        opponent: { name: 'green' },
      },
      description: 'Integration test game',
    });

    // Step 3: Save to disk
    saveReplay(replay, testFile);

    // Step 4: Load from disk
    const loadedReplay = loadReplay(testFile);

    // Step 5: Replay
    const result = replayGame(loadedReplay);

    // Verify everything matches
    expect(result.outcomeMatched).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.finalState.winner).toBe(originalState.winner);
    expect(result.finalState.turnCount).toBe(originalState.turnCount);
    expect(result.finalState.players.player.life).toBe(originalState.players.player.life);
    expect(result.finalState.players.opponent.life).toBe(originalState.players.opponent.life);
    expect(result.finalState.players.player.hand.length).toBe(
      originalState.players.player.hand.length,
    );
    expect(result.finalState.players.opponent.hand.length).toBe(
      originalState.players.opponent.hand.length,
    );
  });

  test('multiple games with different seeds all replay correctly', () => {
    const seeds = [100, 200, 300, 400, 500];

    for (const seed of seeds) {
      _resetInstanceCounter();
      _resetModificationCounter();

      // Play
      const { state } = playTestGame(seed, seed + 1000, 20);

      // Record
      const replay = createReplayFromGame(state, {
        decks: {
          player: { name: 'red' },
          opponent: { name: 'green' },
        },
      });

      // Replay
      const result = replayGame(replay);

      expect(result.outcomeMatched).toBe(true);
      expect(result.errors.length).toBe(0);
    }
  });
});
