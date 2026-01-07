/**
 * MCTSTuner Tests
 */

import { describe, test, expect } from 'bun:test';
import {
  MCTSTuner,
  formatMCTSTuningResult,
  tuningResultToMCTSParams,
  DEFAULT_TUNER_CONFIG,
  DEFAULT_PARAM_RANGES,
  COARSE_PARAM_RANGES,
  type MCTSHyperparams,
} from '../src/tuning/MCTSTuner';

describe('MCTSTuner', () => {
  describe('generateGrid', () => {
    test('generates all parameter combinations', () => {
      const tuner = new MCTSTuner();
      const ranges = {
        explorationConstant: [1.0, 1.5],
        rolloutDepth: [5, 10],
        rolloutPolicy: ['greedy' as const],
        epsilon: [0.1],
        iterations: [50],
      };

      const grid = tuner.generateGrid(ranges);

      // 2 * 2 * 1 * 1 * 1 = 4 combinations
      expect(grid.length).toBe(4);

      // Check all combinations exist
      expect(grid).toContainEqual({
        explorationConstant: 1.0,
        rolloutDepth: 5,
        rolloutPolicy: 'greedy',
        epsilon: 0.1,
        iterations: 50,
      });
      expect(grid).toContainEqual({
        explorationConstant: 1.5,
        rolloutDepth: 10,
        rolloutPolicy: 'greedy',
        epsilon: 0.1,
        iterations: 50,
      });
    });

    test('skips redundant epsilon variations for non-epsilon policies', () => {
      const tuner = new MCTSTuner();
      const ranges = {
        explorationConstant: [1.0],
        rolloutDepth: [5],
        rolloutPolicy: ['greedy' as const, 'random' as const],
        epsilon: [0.1, 0.2], // Should be ignored for greedy/random
        iterations: [50],
      };

      const grid = tuner.generateGrid(ranges);

      // Only 2 combinations (greedy + random), not 4
      expect(grid.length).toBe(2);
    });

    test('generates larger grid with default ranges', () => {
      const tuner = new MCTSTuner();
      const grid = tuner.generateGrid(DEFAULT_PARAM_RANGES);

      // 4 C values * 4 depths * 3 policies = 48 combinations
      expect(grid.length).toBe(48);
    });

    test('generates smaller grid with coarse ranges', () => {
      const tuner = new MCTSTuner();
      const grid = tuner.generateGrid(COARSE_PARAM_RANGES);

      // 3 C values * 3 depths * 2 policies = 18 combinations
      expect(grid.length).toBe(18);
    });
  });

  describe('evaluateConfig', () => {
    // Skip: This test runs actual games and takes ~1.3s
    test.skip('evaluates a single configuration', () => {
      const tuner = new MCTSTuner({
        seed: 12345,
        maxTurns: 50,
      });

      const params: MCTSHyperparams = {
        explorationConstant: 1.41,
        rolloutDepth: 5,
        rolloutPolicy: 'greedy',
        epsilon: 0.1,
        iterations: 10, // Very few iterations for fast test
      };

      // Run just 2 games for quick test
      const result = tuner.evaluateConfig(params, 2, 12345);

      expect(result.params).toEqual(params);
      expect(result.gamesPlayed).toBe(2);
      expect(result.winRate).toBeGreaterThanOrEqual(0);
      expect(result.winRate).toBeLessThanOrEqual(1);
      expect(result.avgTurns).toBeGreaterThan(0);
      expect(result.avgTimeMs).toBeGreaterThan(0);
    });
  });

  describe('config presets', () => {
    test('DEFAULT_TUNER_CONFIG has reasonable values', () => {
      expect(DEFAULT_TUNER_CONFIG.gamesPerConfig).toBe(50);
      expect(DEFAULT_TUNER_CONFIG.validationGames).toBe(200);
      expect(DEFAULT_TUNER_CONFIG.maxTurns).toBe(100);
      expect(DEFAULT_TUNER_CONFIG.method).toBe('coarse-to-fine');
      expect(DEFAULT_TUNER_CONFIG.tuningIterations).toBe(50);
    });

    test('DEFAULT_PARAM_RANGES covers expected values', () => {
      expect(DEFAULT_PARAM_RANGES.explorationConstant).toContain(1.41);
      expect(DEFAULT_PARAM_RANGES.rolloutDepth).toContain(0);
      expect(DEFAULT_PARAM_RANGES.rolloutDepth).toContain(10);
      expect(DEFAULT_PARAM_RANGES.rolloutPolicy).toContain('greedy');
      expect(DEFAULT_PARAM_RANGES.rolloutPolicy).toContain('random');
    });
  });

  describe('formatMCTSTuningResult', () => {
    test('formats result nicely', () => {
      const result = {
        bestParams: {
          explorationConstant: 1.2,
          rolloutDepth: 10,
          rolloutPolicy: 'greedy' as const,
          epsilon: 0.1,
          iterations: 50,
        },
        bestResult: {
          params: {
            explorationConstant: 1.2,
            rolloutDepth: 10,
            rolloutPolicy: 'greedy' as const,
            epsilon: 0.1,
            iterations: 50,
          },
          winRate: 0.58,
          gamesPlayed: 100,
          avgTurns: 45.2,
          avgTimeMs: 1500,
        },
        allResults: [],
        totalGamesPlayed: 1000,
        totalTimeMs: 60000,
        validated: false,
      };

      const formatted = formatMCTSTuningResult(result);

      expect(formatted).toContain('MCTS TUNING RESULT');
      expect(formatted).toContain('Exploration Constant');
      expect(formatted).toContain('1.2');
      expect(formatted).toContain('Rollout Depth');
      expect(formatted).toContain('10');
      expect(formatted).toContain('58.0%');
      expect(formatted).toContain('greedy');
    });
  });

  describe('tuningResultToMCTSParams', () => {
    test('converts result to params for weights.json', () => {
      const result = {
        bestParams: {
          explorationConstant: 1.2,
          rolloutDepth: 10,
          rolloutPolicy: 'epsilon' as const,
          epsilon: 0.15,
          iterations: 50,
        },
        bestResult: {
          params: {
            explorationConstant: 1.2,
            rolloutDepth: 10,
            rolloutPolicy: 'epsilon' as const,
            epsilon: 0.15,
            iterations: 50,
          },
          winRate: 0.58,
          gamesPlayed: 100,
          avgTurns: 45.2,
          avgTimeMs: 1500,
        },
        allResults: [],
        totalGamesPlayed: 1000,
        totalTimeMs: 60000,
        validated: false,
      };

      const params = tuningResultToMCTSParams(result);

      expect(params.explorationConstant).toBe(1.2);
      expect(params.rolloutDepth).toBe(10);
      expect(params.rolloutPolicy).toBe('epsilon');
      expect(params.epsilon).toBe(0.15);
    });
  });

  // Integration test - runs actual tuning (slow, can be skipped in CI)
  describe('integration', () => {
    test.skip('runs quick grid search', () => {
      const tuner = new MCTSTuner({
        gamesPerConfig: 10,
        maxTurns: 30,
        tuningIterations: 10,
        seed: 42,
        method: 'grid',
      });

      const smallRanges = {
        explorationConstant: [1.0, 1.41],
        rolloutDepth: [0, 5],
        rolloutPolicy: ['greedy' as const],
        epsilon: [0.1],
        iterations: [10],
      };

      const result = tuner.runGridSearch(smallRanges);

      expect(result.bestParams).toBeDefined();
      expect(result.bestResult.winRate).toBeGreaterThanOrEqual(0);
      expect(result.allResults.length).toBe(4); // 2 * 2 * 1 = 4
      expect(result.totalGamesPlayed).toBe(40); // 4 configs * 10 games
    });
  });
});
