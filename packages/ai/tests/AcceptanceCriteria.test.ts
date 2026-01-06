/**
 * AcceptanceCriteria Tests
 */

import { describe, test, expect } from 'bun:test';
import {
  wilsonConfidenceInterval,
  areSignificantlyDifferent,
  isSignificantlyBetter,
  validateImprovement,
  formatValidationResult,
  isLikelyBetter,
  calculateRequiredSampleSize,
  DEFAULT_ACCEPTANCE_CONFIG,
  RELAXED_ACCEPTANCE_CONFIG,
  STRICT_ACCEPTANCE_CONFIG,
} from '../src/tuning/AcceptanceCriteria';
import type { PerformanceMetrics } from '../src/weights';

describe('AcceptanceCriteria', () => {
  describe('wilsonConfidenceInterval', () => {
    test('calculates interval for 50% win rate', () => {
      const ci = wilsonConfidenceInterval(50, 100, 0.95);

      expect(ci.center).toBeCloseTo(0.5, 1);
      expect(ci.lower).toBeGreaterThan(0.4);
      expect(ci.upper).toBeLessThan(0.6);
      expect(ci.width).toBeGreaterThan(0);
    });

    test('calculates interval for 80% win rate', () => {
      const ci = wilsonConfidenceInterval(80, 100, 0.95);

      expect(ci.center).toBeCloseTo(0.8, 1);
      expect(ci.lower).toBeGreaterThan(0.7);
      expect(ci.upper).toBeLessThan(0.9);
    });

    test('narrows with more samples', () => {
      const ci100 = wilsonConfidenceInterval(50, 100, 0.95);
      const ci1000 = wilsonConfidenceInterval(500, 1000, 0.95);

      expect(ci1000.width).toBeLessThan(ci100.width);
    });

    test('widens with higher confidence', () => {
      const ci90 = wilsonConfidenceInterval(50, 100, 0.9);
      const ci99 = wilsonConfidenceInterval(50, 100, 0.99);

      expect(ci99.width).toBeGreaterThan(ci90.width);
    });

    test('handles zero samples gracefully', () => {
      const ci = wilsonConfidenceInterval(0, 0, 0.95);

      expect(ci.lower).toBe(0);
      expect(ci.upper).toBe(1);
      expect(ci.center).toBe(0.5);
    });

    test('handles 100% win rate', () => {
      const ci = wilsonConfidenceInterval(100, 100, 0.95);

      expect(ci.center).toBeCloseTo(1, 1);
      expect(ci.upper).toBeCloseTo(1, 5); // Clamped to ~1 (floating point)
      expect(ci.lower).toBeGreaterThan(0.95);
    });

    test('handles 0% win rate', () => {
      const ci = wilsonConfidenceInterval(0, 100, 0.95);

      expect(ci.center).toBeCloseTo(0, 1);
      expect(ci.lower).toBe(0); // Clamped to 0
      expect(ci.upper).toBeLessThan(0.05);
    });
  });

  describe('areSignificantlyDifferent', () => {
    test('returns true for non-overlapping intervals', () => {
      const ci1 = { lower: 0.4, upper: 0.5, center: 0.45, width: 0.1 };
      const ci2 = { lower: 0.6, upper: 0.7, center: 0.65, width: 0.1 };

      expect(areSignificantlyDifferent(ci1, ci2)).toBe(true);
    });

    test('returns false for overlapping intervals', () => {
      const ci1 = { lower: 0.4, upper: 0.55, center: 0.475, width: 0.15 };
      const ci2 = { lower: 0.5, upper: 0.65, center: 0.575, width: 0.15 };

      expect(areSignificantlyDifferent(ci1, ci2)).toBe(false);
    });

    test('returns false for identical intervals', () => {
      const ci = { lower: 0.4, upper: 0.6, center: 0.5, width: 0.2 };

      expect(areSignificantlyDifferent(ci, ci)).toBe(false);
    });
  });

  describe('isSignificantlyBetter', () => {
    test('returns true when new lower > old upper', () => {
      const oldCI = { lower: 0.4, upper: 0.5, center: 0.45, width: 0.1 };
      const newCI = { lower: 0.55, upper: 0.65, center: 0.6, width: 0.1 };

      expect(isSignificantlyBetter(newCI, oldCI)).toBe(true);
    });

    test('returns false when intervals overlap', () => {
      const oldCI = { lower: 0.4, upper: 0.55, center: 0.475, width: 0.15 };
      const newCI = { lower: 0.5, upper: 0.65, center: 0.575, width: 0.15 };

      expect(isSignificantlyBetter(newCI, oldCI)).toBe(false);
    });

    test('returns false when new is worse', () => {
      const oldCI = { lower: 0.55, upper: 0.65, center: 0.6, width: 0.1 };
      const newCI = { lower: 0.4, upper: 0.5, center: 0.45, width: 0.1 };

      expect(isSignificantlyBetter(newCI, oldCI)).toBe(false);
    });
  });

  describe('validateImprovement', () => {
    const baselineMetrics: PerformanceMetrics = {
      vsRandom: 0.8,
      vsGreedy: 0.52,
      elo: 1520,
      gamesPlayed: 200,
    };

    test('accepts significant improvement', () => {
      const newMetrics: PerformanceMetrics = {
        vsRandom: 0.9,
        vsGreedy: 0.72, // +20% improvement with enough games for significance
        elo: 1620,
        gamesPlayed: 500,
      };

      const result = validateImprovement(baselineMetrics, newMetrics, DEFAULT_ACCEPTANCE_CONFIG);

      expect(result.accepted).toBe(true);
      expect(result.checks.meetsImprovementThreshold).toBe(true);
      expect(result.details.vsGreedyDelta).toBeCloseTo(0.2, 2);
    });

    test('rejects insufficient games', () => {
      const newMetrics: PerformanceMetrics = {
        vsRandom: 0.85,
        vsGreedy: 0.6,
        elo: 1580,
        gamesPlayed: 50, // Below minimum
      };

      const result = validateImprovement(baselineMetrics, newMetrics, DEFAULT_ACCEPTANCE_CONFIG);

      expect(result.accepted).toBe(false);
      expect(result.checks.sufficientGames).toBe(false);
      expect(result.rejectionReasons.some((r) => r.includes('Insufficient games'))).toBe(true);
    });

    test('rejects regression in vsGreedy', () => {
      const newMetrics: PerformanceMetrics = {
        vsRandom: 0.85,
        vsGreedy: 0.48, // -4% regression
        elo: 1480,
        gamesPlayed: 200,
      };

      const result = validateImprovement(baselineMetrics, newMetrics, DEFAULT_ACCEPTANCE_CONFIG);

      expect(result.accepted).toBe(false);
      expect(result.checks.noRegression).toBe(false);
      expect(result.rejectionReasons.some((r) => r.includes('Regression'))).toBe(true);
    });

    test('rejects insufficient improvement', () => {
      const newMetrics: PerformanceMetrics = {
        vsRandom: 0.81,
        vsGreedy: 0.525, // Only +0.5% improvement
        elo: 1525,
        gamesPlayed: 200,
      };

      const result = validateImprovement(baselineMetrics, newMetrics, DEFAULT_ACCEPTANCE_CONFIG);

      expect(result.accepted).toBe(false);
      expect(result.checks.meetsImprovementThreshold).toBe(false);
    });

    test('uses relaxed config when specified', () => {
      const newMetrics: PerformanceMetrics = {
        vsRandom: 0.81,
        vsGreedy: 0.535, // +1.5% improvement (below default, above relaxed)
        elo: 1535,
        gamesPlayed: 100, // Below default minimum, at relaxed minimum
      };

      const resultDefault = validateImprovement(
        baselineMetrics,
        newMetrics,
        DEFAULT_ACCEPTANCE_CONFIG,
      );
      const resultRelaxed = validateImprovement(
        baselineMetrics,
        newMetrics,
        RELAXED_ACCEPTANCE_CONFIG,
      );

      expect(resultDefault.accepted).toBe(false);
      expect(resultRelaxed.checks.sufficientGames).toBe(true);
    });

    test('provides detailed rejection reasons', () => {
      const newMetrics: PerformanceMetrics = {
        vsRandom: 0.75, // Regression
        vsGreedy: 0.5, // Regression
        elo: 1500,
        gamesPlayed: 50, // Insufficient
      };

      const result = validateImprovement(baselineMetrics, newMetrics, DEFAULT_ACCEPTANCE_CONFIG);

      expect(result.accepted).toBe(false);
      expect(result.rejectionReasons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('formatValidationResult', () => {
    test('formats accepted result', () => {
      const oldMetrics: PerformanceMetrics = {
        vsRandom: 0.8,
        vsGreedy: 0.52,
        elo: 1520,
        gamesPlayed: 200,
      };
      const newMetrics: PerformanceMetrics = {
        vsRandom: 0.9,
        vsGreedy: 0.72, // Large improvement with many games for significance
        elo: 1620,
        gamesPlayed: 500,
      };

      const result = validateImprovement(oldMetrics, newMetrics, DEFAULT_ACCEPTANCE_CONFIG);
      const formatted = formatValidationResult(result);

      expect(formatted).toContain('ACCEPTED');
      expect(formatted).toContain('vs GreedyBot');
      expect(formatted).toContain('Confidence Intervals');
    });

    test('formats rejected result with reasons', () => {
      const oldMetrics: PerformanceMetrics = {
        vsRandom: 0.8,
        vsGreedy: 0.52,
        elo: 1520,
        gamesPlayed: 200,
      };
      const newMetrics: PerformanceMetrics = {
        vsRandom: 0.75,
        vsGreedy: 0.5,
        elo: 1500,
        gamesPlayed: 50,
      };

      const result = validateImprovement(oldMetrics, newMetrics, DEFAULT_ACCEPTANCE_CONFIG);
      const formatted = formatValidationResult(result);

      expect(formatted).toContain('REJECTED');
      expect(formatted).toContain('Rejection Reasons');
    });
  });

  describe('isLikelyBetter', () => {
    test('returns true when better in 2+ metrics', () => {
      const oldMetrics: PerformanceMetrics = {
        vsRandom: 0.8,
        vsGreedy: 0.52,
        elo: 1520,
        gamesPlayed: 200,
      };
      const newMetrics: PerformanceMetrics = {
        vsRandom: 0.85,
        vsGreedy: 0.55,
        elo: 1500, // Worse
        gamesPlayed: 200,
      };

      expect(isLikelyBetter(oldMetrics, newMetrics)).toBe(true);
    });

    test('returns false when better in only 1 metric', () => {
      const oldMetrics: PerformanceMetrics = {
        vsRandom: 0.8,
        vsGreedy: 0.52,
        elo: 1520,
        gamesPlayed: 200,
      };
      const newMetrics: PerformanceMetrics = {
        vsRandom: 0.85,
        vsGreedy: 0.5, // Worse
        elo: 1500, // Worse
        gamesPlayed: 200,
      };

      expect(isLikelyBetter(oldMetrics, newMetrics)).toBe(false);
    });
  });

  describe('calculateRequiredSampleSize', () => {
    test('returns reasonable sample size for 5% effect', () => {
      const sampleSize = calculateRequiredSampleSize(0.5, 0.05, 0.8, 0.05);

      // For detecting 5% difference from 50% with 80% power
      // The exact value depends on the formula used; should be in thousands
      expect(sampleSize).toBeGreaterThan(500);
      expect(sampleSize).toBeLessThan(5000);
    });

    test('smaller effect size requires more samples', () => {
      const size5pct = calculateRequiredSampleSize(0.5, 0.05);
      const size2pct = calculateRequiredSampleSize(0.5, 0.02);

      expect(size2pct).toBeGreaterThan(size5pct);
    });

    test('higher power requires more samples', () => {
      const power80 = calculateRequiredSampleSize(0.5, 0.05, 0.8);
      const power90 = calculateRequiredSampleSize(0.5, 0.05, 0.9);

      expect(power90).toBeGreaterThan(power80);
    });
  });

  describe('configuration presets', () => {
    test('DEFAULT_ACCEPTANCE_CONFIG has reasonable values', () => {
      expect(DEFAULT_ACCEPTANCE_CONFIG.minGames).toBe(200);
      expect(DEFAULT_ACCEPTANCE_CONFIG.confidenceLevel).toBe(0.95);
      expect(DEFAULT_ACCEPTANCE_CONFIG.thresholds.vsGreedyImprovement).toBe(0.02);
      expect(DEFAULT_ACCEPTANCE_CONFIG.requireSignificance).toBe(true);
    });

    test('RELAXED_ACCEPTANCE_CONFIG is more permissive', () => {
      expect(RELAXED_ACCEPTANCE_CONFIG.minGames).toBeLessThan(DEFAULT_ACCEPTANCE_CONFIG.minGames);
      expect(RELAXED_ACCEPTANCE_CONFIG.confidenceLevel).toBeLessThan(
        DEFAULT_ACCEPTANCE_CONFIG.confidenceLevel,
      );
      expect(RELAXED_ACCEPTANCE_CONFIG.requireSignificance).toBe(false);
    });

    test('STRICT_ACCEPTANCE_CONFIG is more demanding', () => {
      expect(STRICT_ACCEPTANCE_CONFIG.minGames).toBeGreaterThan(DEFAULT_ACCEPTANCE_CONFIG.minGames);
      expect(STRICT_ACCEPTANCE_CONFIG.confidenceLevel).toBeGreaterThan(
        DEFAULT_ACCEPTANCE_CONFIG.confidenceLevel,
      );
      expect(STRICT_ACCEPTANCE_CONFIG.thresholds.vsGreedyImprovement).toBeGreaterThan(
        DEFAULT_ACCEPTANCE_CONFIG.thresholds.vsGreedyImprovement,
      );
    });
  });
});
