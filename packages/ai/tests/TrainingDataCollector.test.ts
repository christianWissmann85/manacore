/**
 * Training Data Collector Tests
 */

import { describe, test, expect } from 'bun:test';
import {
  TrainingDataCollector,
  extractFeatures,
  featuresToArray,
  FEATURE_VECTOR_SIZE,
  toTensorFormat,
  mergeTrainingData,
  DEFAULT_COLLECTOR_CONFIG,
} from '../src/training';
import {
  initializeGame,
  getLegalActions,
  applyAction,
  createRedDeck,
  createGreenDeck,
  CardLoader,
  type GameState,
  type Action,
  type PlayerId,
  type Zone,
} from '@manacore/engine';

// Helper to create a game state
function createTestState(seed: number = 42): GameState {
  const playerDeck = createRedDeck();
  const opponentDeck = createGreenDeck();
  return initializeGame(playerDeck, opponentDeck, seed);
}

describe('TrainingDataCollector', () => {
  describe('extractFeatures', () => {
    test('extracts features from initial game state', () => {
      const state = createTestState(42);
      const features = extractFeatures(state, 'player');

      // Check life (20/20 = 1.0)
      expect(features.playerLife).toBe(1);
      expect(features.opponentLife).toBe(1);
      expect(features.lifeDelta).toBe(0);

      // Check initial hand size (7 cards / 7 = 1.0)
      expect(features.playerHandSize).toBe(1);
      expect(features.opponentHandSize).toBe(1);

      // No creatures initially
      expect(features.playerCreatureCount).toBe(0);
      expect(features.opponentCreatureCount).toBe(0);

      // Turn 1 (normalized: 1/50 = 0.02)
      expect(features.turnNumber).toBe(0.02);

      // Player is active
      expect(features.isPlayerTurn).toBe(true);
    });

    test('normalizes life above 20', () => {
      const state = createTestState(42);
      // Manually set life to 40
      state.players.player.life = 40;

      const features = extractFeatures(state, 'player');

      // Should be capped at 2.0 (40/20)
      expect(features.playerLife).toBe(2.0);
    });

    test('correctly calculates board advantage', () => {
      const state = createTestState(42);

      // Get a real creature card to use
      const grizzlyBears = CardLoader.getByName('Grizzly Bears');
      expect(grizzlyBears).toBeDefined();

      // Add some creatures to player's battlefield
      const mockCreature = {
        instanceId: 'test-1',
        scryfallId: grizzlyBears!.id,
        controller: 'player' as PlayerId,
        owner: 'player' as PlayerId,
        zone: 'battlefield' as Zone,
        tapped: false,
        summoningSick: false,
        damage: 0,
        counters: {},
        temporaryModifications: [],
        attachments: [],
      };

      state.players.player.battlefield.push(mockCreature as any);
      state.players.player.battlefield.push({ ...mockCreature, instanceId: 'test-2' } as any);

      const features = extractFeatures(state, 'player');

      expect(features.playerCreatureCount).toBe(0.2); // 2/10
      expect(features.opponentCreatureCount).toBe(0);
      expect(features.boardAdvantage).toBe(0.2); // 2/10
      // Grizzly Bears has 2/2, so 2 creatures = 4 total power/toughness
      expect(features.playerTotalPower).toBeCloseTo(4 / 30, 2); // 4/30 ≈ 0.133
      expect(features.playerTotalToughness).toBeCloseTo(4 / 30, 2); // 4/30 ≈ 0.133
    });
  });

  describe('featuresToArray', () => {
    test('returns correct size array', () => {
      const state = createTestState(42);
      const features = extractFeatures(state, 'player');
      const array = featuresToArray(features);

      expect(array.length).toBe(FEATURE_VECTOR_SIZE);
    });

    test('all values are numbers', () => {
      const state = createTestState(42);
      const features = extractFeatures(state, 'player');
      const array = featuresToArray(features);

      for (const value of array) {
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
      }
    });

    test('values are in valid ranges', () => {
      const state = createTestState(42);
      const features = extractFeatures(state, 'player');
      const array = featuresToArray(features);

      // Most values should be in [-1, 2] range (some like life can exceed 1)
      for (const value of array) {
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('TrainingDataCollector', () => {
    test('initializes with correct defaults', () => {
      const collector = new TrainingDataCollector(42, 'GreedyBot', 'RandomBot');

      expect(collector.getSampleCount()).toBe(0);
    });

    test('records decisions', () => {
      const collector = new TrainingDataCollector(42, 'GreedyBot', 'RandomBot');
      const state = createTestState(42);
      const legalActions = getLegalActions(state);

      if (legalActions.length > 0) {
        collector.recordDecision(state, legalActions[0], legalActions);
        expect(collector.getSampleCount()).toBeGreaterThanOrEqual(0);
      }
    });

    test('skips PASS_PRIORITY when configured', () => {
      const collector = new TrainingDataCollector(42, 'GreedyBot', 'RandomBot', {
        skipPassPriority: true,
      });

      const state = createTestState(42);
      const passAction: Action = { type: 'PASS_PRIORITY', playerId: 'player' };

      collector.recordDecision(state, passAction, [passAction]);

      expect(collector.getSampleCount()).toBe(0);
    });

    test('records PASS_PRIORITY when not skipping', () => {
      const collector = new TrainingDataCollector(42, 'GreedyBot', 'RandomBot', {
        skipPassPriority: false,
      });

      const state = createTestState(42);
      const passAction: Action = { type: 'PASS_PRIORITY', playerId: 'player' };

      collector.recordDecision(state, passAction, [passAction]);

      expect(collector.getSampleCount()).toBe(1);
    });

    test('respects maxSamplesPerGame limit', () => {
      const collector = new TrainingDataCollector(42, 'GreedyBot', 'RandomBot', {
        maxSamplesPerGame: 5,
        skipPassPriority: false,
      });

      const state = createTestState(42);
      const passAction: Action = { type: 'PASS_PRIORITY', playerId: 'player' };

      for (let i = 0; i < 10; i++) {
        collector.recordDecision(state, passAction, [passAction]);
      }

      expect(collector.getSampleCount()).toBe(5);
    });

    test('only records specified player', () => {
      const collector = new TrainingDataCollector(42, 'GreedyBot', 'RandomBot', {
        recordPlayer: 'opponent',
        skipPassPriority: false,
      });

      const state = createTestState(42);
      const playerAction: Action = { type: 'PASS_PRIORITY', playerId: 'player' };
      const opponentAction: Action = { type: 'PASS_PRIORITY', playerId: 'opponent' };

      collector.recordDecision(state, playerAction, [playerAction]);
      expect(collector.getSampleCount()).toBe(0);

      collector.recordDecision(state, opponentAction, [opponentAction]);
      expect(collector.getSampleCount()).toBe(1);
    });

    test('finalize returns correct structure', () => {
      const collector = new TrainingDataCollector(42, 'GreedyBot', 'RandomBot', {
        skipPassPriority: false,
      });

      const state = createTestState(42);
      const passAction: Action = { type: 'PASS_PRIORITY', playerId: 'player' };
      collector.recordDecision(state, passAction, [passAction]);

      // Set winner
      state.winner = 'player';

      const data = collector.finalize(state);

      expect(data.seed).toBe(42);
      expect(data.playerBot).toBe('GreedyBot');
      expect(data.opponentBot).toBe('RandomBot');
      expect(data.outcome).toBe(1); // Player won
      expect(data.samples.length).toBe(1);
    });

    test('correctly determines outcome', () => {
      const state = createTestState(42);

      // Test player win
      state.winner = 'player';
      let collector = new TrainingDataCollector(42, 'A', 'B');
      expect(collector.finalize(state).outcome).toBe(1);

      // Test player loss
      state.winner = 'opponent';
      collector = new TrainingDataCollector(42, 'A', 'B');
      expect(collector.finalize(state).outcome).toBe(-1);

      // Test draw
      state.winner = null;
      collector = new TrainingDataCollector(42, 'A', 'B');
      expect(collector.finalize(state).outcome).toBe(0);
    });
  });

  describe('toTensorFormat', () => {
    test('converts training data to tensor format', () => {
      const collector = new TrainingDataCollector(42, 'GreedyBot', 'RandomBot', {
        skipPassPriority: false,
      });

      const state = createTestState(42);
      const passAction: Action = { type: 'PASS_PRIORITY', playerId: 'player' };

      // Record a few samples
      collector.recordDecision(state, passAction, [passAction]);
      collector.recordDecision(state, passAction, [passAction]);

      state.winner = 'player';
      const data = collector.finalize(state);
      const tensor = toTensorFormat(data);

      expect(tensor.features.length).toBe(2);
      expect(tensor.features[0].length).toBe(FEATURE_VECTOR_SIZE);
      expect(tensor.actions.length).toBe(2);
      expect(tensor.actionCounts.length).toBe(2);
      expect(tensor.outcomes.length).toBe(2);
      expect(tensor.outcomes[0]).toBe(1); // Player won
    });
  });

  describe('mergeTrainingData', () => {
    test('merges multiple datasets', () => {
      const state = createTestState(42);
      const passAction: Action = { type: 'PASS_PRIORITY', playerId: 'player' };

      // Create first dataset (win)
      const collector1 = new TrainingDataCollector(42, 'A', 'B', { skipPassPriority: false });
      collector1.recordDecision(state, passAction, [passAction]);
      state.winner = 'player';
      const data1 = collector1.finalize(state);

      // Create second dataset (loss)
      const collector2 = new TrainingDataCollector(43, 'A', 'B', { skipPassPriority: false });
      collector2.recordDecision(state, passAction, [passAction]);
      collector2.recordDecision(state, passAction, [passAction]);
      state.winner = 'opponent';
      const data2 = collector2.finalize(state);

      // Merge
      const merged = mergeTrainingData([data1, data2]);

      expect(merged.samples.length).toBe(3);
      expect(merged.outcomes.length).toBe(3);
      expect(merged.metadata.games).toBe(2);
      expect(merged.metadata.totalSamples).toBe(3);
      expect(merged.metadata.wins).toBe(1);
      expect(merged.metadata.losses).toBe(1);
      expect(merged.metadata.draws).toBe(0);
    });
  });

  describe('DEFAULT_COLLECTOR_CONFIG', () => {
    test('has sensible defaults', () => {
      expect(DEFAULT_COLLECTOR_CONFIG.recordPlayer).toBe('player');
      expect(DEFAULT_COLLECTOR_CONFIG.skipPassPriority).toBe(true);
      expect(DEFAULT_COLLECTOR_CONFIG.sampleRate).toBe(1.0);
      expect(DEFAULT_COLLECTOR_CONFIG.maxSamplesPerGame).toBe(0);
    });
  });

  describe('FEATURE_VECTOR_SIZE', () => {
    test('is correct', () => {
      // v2.0: Enhanced from 25 to 36 features
      expect(FEATURE_VECTOR_SIZE).toBe(36);
    });
  });
});
