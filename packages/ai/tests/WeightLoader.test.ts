/**
 * WeightLoader Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  loadWeights,
  getEvaluationWeights,
  getEvaluationCoefficients,
  getMCTSParams,
  getWeightsVersion,
  getPerformanceMetrics,
  weightsToCoefficients,
  normalizeWeights,
  bumpVersion,
  clearCache,
} from '../src/weights';

describe('WeightLoader', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearCache();
  });

  describe('loadWeights', () => {
    test('loads weights from weights.json', () => {
      const weights = loadWeights();

      expect(weights).toBeDefined();
      expect(weights.version).toBe('1.0.1');
      expect(weights.evaluation).toBeDefined();
      expect(weights.coefficients).toBeDefined();
      expect(weights.mcts).toBeDefined();
      expect(weights.performance).toBeDefined();
    });

    test('weights have expected structure and valid ranges', () => {
      const weights = loadWeights();

      // Evaluation weights - check types and ranges instead of specific values
      Object.entries(weights.evaluation).forEach(([key, value]) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1); // Individual normalized weights shouldn't exceed 1
      });

      // Weights should still sum to ~1.0 (Invariant)
      const sum =
        weights.evaluation.life +
        weights.evaluation.board +
        weights.evaluation.cards +
        weights.evaluation.mana +
        weights.evaluation.tempo;
      expect(sum).toBeCloseTo(1.0, 1);
    });

    test('caches weights on subsequent calls', () => {
      const weights1 = loadWeights();
      const weights2 = loadWeights();

      // Should be the same object from cache
      expect(weights1).toBe(weights2);
    });

    test('forceReload bypasses cache', () => {
      const weights1 = loadWeights();
      const weights2 = loadWeights(true);

      // Values should be equal but not necessarily the same object
      expect(weights1.version).toBe(weights2.version);
    });
  });

  describe('getEvaluationWeights', () => {
    test('returns evaluation weights', () => {
      const weights = getEvaluationWeights();

      expect(weights.life).toBeGreaterThan(0);
      expect(weights.board).toBeGreaterThan(0);
      expect(weights.cards).toBeGreaterThan(0);
      expect(weights.mana).toBeGreaterThan(0);
      expect(weights.tempo).toBeGreaterThan(0);
    });
  });

  describe('getEvaluationCoefficients', () => {
    test('returns evaluation coefficients', () => {
      const coeffs = getEvaluationCoefficients();

      expect(coeffs.life).toBeGreaterThan(0);
      expect(coeffs.board).toBeGreaterThan(0);
      expect(coeffs.cards).toBeGreaterThan(0);
      expect(coeffs.mana).toBeGreaterThan(0);
      expect(coeffs.stack).toBeGreaterThan(0);
    });
  });

  describe('getMCTSParams', () => {
    test('returns valid MCTS parameters', () => {
      const params = getMCTSParams();

      expect(params.explorationConstant).toBeGreaterThan(0);
      expect(params.rolloutDepth).toBeGreaterThan(0);
      expect(['random', 'greedy', 'epsilon']).toContain(params.rolloutPolicy);
      if (params.epsilon !== undefined) {
        expect(params.epsilon).toBeGreaterThanOrEqual(0);
        expect(params.epsilon).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('getWeightsVersion', () => {
    test('returns valid semver version string', () => {
      const version = getWeightsVersion();
      // Simple regex for x.y.z
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('getPerformanceMetrics', () => {
    test('returns performance metrics', () => {
      const metrics = getPerformanceMetrics();

      expect(metrics.vsRandom).toBeGreaterThanOrEqual(0);
      expect(metrics.vsRandom).toBeLessThanOrEqual(1);
      expect(metrics.vsGreedy).toBeGreaterThanOrEqual(0);
      expect(metrics.vsGreedy).toBeLessThanOrEqual(1);
      expect(metrics.elo).toBeGreaterThan(0);
      expect(metrics.gamesPlayed).toBeGreaterThan(0);
    });
  });

  describe('weightsToCoefficients', () => {
    test('converts weights to coefficients', () => {
      const weights = {
        life: 0.3,
        board: 0.45,
        cards: 0.1,
        mana: 0.1,
        tempo: 0.05,
      };

      const coeffs = weightsToCoefficients(weights);

      // Check scaling is approximately correct
      expect(coeffs.life).toBeCloseTo(2.0, 1);
      expect(coeffs.board).toBeCloseTo(5.0, 1);
      expect(coeffs.cards).toBeCloseTo(0.1, 1);
      expect(coeffs.mana).toBeCloseTo(1.5, 1);
      expect(coeffs.stack).toBe(8.0); // Stack is constant
    });
  });

  describe('normalizeWeights', () => {
    test('normalizes weights to sum to 1.0', () => {
      const weights = {
        life: 0.6,
        board: 0.9,
        cards: 0.2,
        mana: 0.2,
        tempo: 0.1,
      };

      const normalized = normalizeWeights(weights);

      const sum =
        normalized.life + normalized.board + normalized.cards + normalized.mana + normalized.tempo;

      expect(sum).toBeCloseTo(1.0, 5);
    });

    test('handles zero sum gracefully', () => {
      const weights = {
        life: 0,
        board: 0,
        cards: 0,
        mana: 0,
        tempo: 0,
      };

      const normalized = normalizeWeights(weights);

      // Should return defaults
      expect(normalized.life).toBeGreaterThan(0);
      expect(normalized.board).toBeGreaterThan(0);
    });
  });

  describe('bumpVersion', () => {
    test('increments patch version', () => {
      expect(bumpVersion('1.0.0')).toBe('1.0.1');
      expect(bumpVersion('1.0.9')).toBe('1.0.10');
      expect(bumpVersion('2.3.4')).toBe('2.3.5');
    });

    test('handles invalid version', () => {
      expect(bumpVersion('invalid')).toBe('1.0.0');
      expect(bumpVersion('')).toBe('1.0.0');
    });
  });
});
