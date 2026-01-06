/**
 * AcceptanceCriteria - Statistical validation for weight improvements
 *
 * Defines what "better" means with statistical rigor using Wilson score
 * confidence intervals. Prevents accepting changes that aren't statistically
 * significant or that cause regressions in other metrics.
 */

import type { PerformanceMetrics } from '../weights';

/**
 * Confidence interval bounds
 */
export interface ConfidenceInterval {
  lower: number;
  upper: number;
  center: number;
  width: number;
}

/**
 * Thresholds for accepting new weights
 */
export interface AcceptanceThresholds {
  /** Minimum improvement in vsGreedy win rate (absolute, e.g., 0.02 = 2%) */
  vsGreedyImprovement: number;

  /** Minimum improvement in vsRandom win rate (absolute) */
  vsRandomImprovement: number;

  /** Minimum Elo gain */
  eloDelta: number;

  /** Maximum allowed regression in vsGreedy (absolute) */
  vsGreedyMaxRegression: number;

  /** Maximum allowed regression in vsRandom (absolute) */
  vsRandomMaxRegression: number;
}

/**
 * Configuration for acceptance criteria validation
 */
export interface AcceptanceCriteriaConfig {
  /** Minimum games required for statistical validity */
  minGames: number;

  /** Confidence level for intervals (0.95 = 95%) */
  confidenceLevel: number;

  /** Improvement and regression thresholds */
  thresholds: AcceptanceThresholds;

  /** Require statistical significance (CI separation) */
  requireSignificance: boolean;
}

/**
 * Detailed validation result
 */
export interface ValidationResult {
  /** Overall: should we accept the new weights? */
  accepted: boolean;

  /** Human-readable summary */
  summary: string;

  /** Individual check results */
  checks: {
    /** Enough games played for statistical validity */
    sufficientGames: boolean;

    /** New weights are statistically significantly better */
    statisticallySignificant: boolean;

    /** Improvement exceeds threshold */
    meetsImprovementThreshold: boolean;

    /** No regression in other metrics */
    noRegression: boolean;
  };

  /** Detailed metrics */
  details: {
    oldMetrics: PerformanceMetrics;
    newMetrics: PerformanceMetrics;
    oldCI: ConfidenceInterval;
    newCI: ConfidenceInterval;
    vsGreedyDelta: number;
    vsRandomDelta: number;
    eloDelta: number;
  };

  /** Reasons for rejection (if not accepted) */
  rejectionReasons: string[];
}

/**
 * Default acceptance criteria - conservative but practical
 */
export const DEFAULT_ACCEPTANCE_CONFIG: AcceptanceCriteriaConfig = {
  minGames: 200,
  confidenceLevel: 0.95,
  thresholds: {
    vsGreedyImprovement: 0.02, // Must be 2% better vs GreedyBot
    vsRandomImprovement: 0.01, // Must be 1% better vs RandomBot
    eloDelta: 15, // Must gain 15+ Elo points
    vsGreedyMaxRegression: 0.01, // Can't lose more than 1% vs Greedy
    vsRandomMaxRegression: 0.005, // Can't lose more than 0.5% vs Random
  },
  requireSignificance: true,
};

/**
 * Relaxed criteria for exploratory tuning
 */
export const RELAXED_ACCEPTANCE_CONFIG: AcceptanceCriteriaConfig = {
  minGames: 100,
  confidenceLevel: 0.9,
  thresholds: {
    vsGreedyImprovement: 0.01,
    vsRandomImprovement: 0.005,
    eloDelta: 10,
    vsGreedyMaxRegression: 0.02,
    vsRandomMaxRegression: 0.01,
  },
  requireSignificance: false,
};

/**
 * Strict criteria for production updates
 */
export const STRICT_ACCEPTANCE_CONFIG: AcceptanceCriteriaConfig = {
  minGames: 500,
  confidenceLevel: 0.99,
  thresholds: {
    vsGreedyImprovement: 0.03,
    vsRandomImprovement: 0.02,
    eloDelta: 25,
    vsGreedyMaxRegression: 0.005,
    vsRandomMaxRegression: 0.002,
  },
  requireSignificance: true,
};

/**
 * Calculate Wilson score confidence interval for a proportion
 *
 * The Wilson score interval is preferred over the normal approximation
 * because it performs better for extreme proportions and small sample sizes.
 *
 * @param successes - Number of successes (wins)
 * @param total - Total number of trials (games)
 * @param confidenceLevel - Confidence level (0.95 = 95%)
 * @returns Confidence interval bounds
 *
 * @see https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval#Wilson_score_interval
 */
export function wilsonConfidenceInterval(
  successes: number,
  total: number,
  confidenceLevel: number = 0.95,
): ConfidenceInterval {
  if (total === 0) {
    return { lower: 0, upper: 1, center: 0.5, width: 1 };
  }

  const p = successes / total;
  const n = total;

  // Z-score for confidence level
  // For 95% CI: z ≈ 1.96
  // For 99% CI: z ≈ 2.576
  // For 90% CI: z ≈ 1.645
  const z = getZScore(confidenceLevel);
  const z2 = z * z;

  // Wilson score interval formula
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denominator;

  const lower = Math.max(0, center - margin);
  const upper = Math.min(1, center + margin);

  return {
    lower,
    upper,
    center,
    width: upper - lower,
  };
}

/**
 * Get Z-score for a given confidence level
 *
 * Uses approximation for common values, falls back to inverse normal for others.
 */
function getZScore(confidenceLevel: number): number {
  // Common confidence levels
  const zScores: Record<number, number> = {
    0.9: 1.645,
    0.95: 1.96,
    0.99: 2.576,
    0.999: 3.291,
  };

  // Check for exact match
  if (confidenceLevel in zScores) {
    return zScores[confidenceLevel]!;
  }

  // Approximation using inverse error function
  // For a two-tailed test: z = Φ^(-1)((1 + confidenceLevel) / 2)
  const alpha = 1 - confidenceLevel;
  const p = 1 - alpha / 2;

  // Rational approximation to inverse normal CDF
  // Accurate to about 4 decimal places for p in [0.5, 1)
  return inverseNormalCDF(p);
}

/**
 * Approximate inverse of the standard normal CDF
 *
 * Uses Abramowitz and Stegun approximation (formula 26.2.23)
 */
function inverseNormalCDF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  // Coefficients for the rational approximation
  const a1 = -3.969683028665376e1;
  const a2 = 2.209460984245205e2;
  const a3 = -2.759285104469687e2;
  const a4 = 1.38357751867269e2;
  const a5 = -3.066479806614716e1;
  const a6 = 2.506628277459239;

  const b1 = -5.447609879822406e1;
  const b2 = 1.615858368580409e2;
  const b3 = -1.556989798598866e2;
  const b4 = 6.680131188771972e1;
  const b5 = -1.328068155288572e1;

  const c1 = -7.784894002430293e-3;
  const c2 = -3.223964580411365e-1;
  const c3 = -2.400758277161838;
  const c4 = -2.549732539343734;
  const c5 = 4.374664141464968;
  const c6 = 2.938163982698783;

  const d1 = 7.784695709041462e-3;
  const d2 = 3.224671290700398e-1;
  const d3 = 2.445134137142996;
  const d4 = 3.754408661907416;

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;

  if (p < pLow) {
    // Lower region
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  } else if (p <= pHigh) {
    // Central region
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q) /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
    );
  } else {
    // Upper region
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }
}

/**
 * Check if two confidence intervals are statistically significantly different
 *
 * Returns true if the intervals don't overlap, meaning we can be confident
 * the true proportions are different.
 */
export function areSignificantlyDifferent(
  ci1: ConfidenceInterval,
  ci2: ConfidenceInterval,
): boolean {
  // No overlap means significant difference
  return ci1.upper < ci2.lower || ci2.upper < ci1.lower;
}

/**
 * Check if ci1 is significantly BETTER than ci2
 *
 * Returns true if the lower bound of ci1 exceeds the upper bound of ci2
 */
export function isSignificantlyBetter(
  newCI: ConfidenceInterval,
  oldCI: ConfidenceInterval,
): boolean {
  return newCI.lower > oldCI.upper;
}

/**
 * Validate whether new weights should be accepted over old weights
 *
 * @param oldMetrics - Performance metrics from current weights
 * @param newMetrics - Performance metrics from candidate weights
 * @param config - Acceptance criteria configuration
 * @returns Detailed validation result
 */
export function validateImprovement(
  oldMetrics: PerformanceMetrics,
  newMetrics: PerformanceMetrics,
  config: AcceptanceCriteriaConfig = DEFAULT_ACCEPTANCE_CONFIG,
): ValidationResult {
  const rejectionReasons: string[] = [];

  // Calculate confidence intervals for vsGreedy (primary metric)
  const oldCI = wilsonConfidenceInterval(
    Math.round(oldMetrics.vsGreedy * oldMetrics.gamesPlayed),
    oldMetrics.gamesPlayed,
    config.confidenceLevel,
  );

  const newCI = wilsonConfidenceInterval(
    Math.round(newMetrics.vsGreedy * newMetrics.gamesPlayed),
    newMetrics.gamesPlayed,
    config.confidenceLevel,
  );

  // Calculate deltas
  const vsGreedyDelta = newMetrics.vsGreedy - oldMetrics.vsGreedy;
  const vsRandomDelta = newMetrics.vsRandom - oldMetrics.vsRandom;
  const eloDelta = newMetrics.elo - oldMetrics.elo;

  // Check 1: Sufficient games
  const sufficientGames = newMetrics.gamesPlayed >= config.minGames;
  if (!sufficientGames) {
    rejectionReasons.push(
      `Insufficient games: ${newMetrics.gamesPlayed} < ${config.minGames} required`,
    );
  }

  // Check 2: Statistical significance (if required)
  const statisticallySignificant = isSignificantlyBetter(newCI, oldCI);
  if (config.requireSignificance && !statisticallySignificant) {
    rejectionReasons.push(
      `Not statistically significant: new CI [${(newCI.lower * 100).toFixed(1)}%, ${(newCI.upper * 100).toFixed(1)}%] ` +
        `does not exceed old CI [${(oldCI.lower * 100).toFixed(1)}%, ${(oldCI.upper * 100).toFixed(1)}%]`,
    );
  }

  // Check 3: Improvement threshold
  const meetsImprovementThreshold =
    vsGreedyDelta >= config.thresholds.vsGreedyImprovement ||
    eloDelta >= config.thresholds.eloDelta;

  if (!meetsImprovementThreshold) {
    rejectionReasons.push(
      `Improvement below threshold: vsGreedy +${(vsGreedyDelta * 100).toFixed(1)}% ` +
        `(need +${(config.thresholds.vsGreedyImprovement * 100).toFixed(1)}%) ` +
        `or Elo +${eloDelta.toFixed(0)} (need +${config.thresholds.eloDelta})`,
    );
  }

  // Check 4: No regression
  const noVsGreedyRegression = vsGreedyDelta >= -config.thresholds.vsGreedyMaxRegression;
  const noVsRandomRegression = vsRandomDelta >= -config.thresholds.vsRandomMaxRegression;
  const noRegression = noVsGreedyRegression && noVsRandomRegression;

  if (!noVsGreedyRegression) {
    rejectionReasons.push(
      `Regression in vsGreedy: ${(vsGreedyDelta * 100).toFixed(1)}% ` +
        `exceeds max allowed -${(config.thresholds.vsGreedyMaxRegression * 100).toFixed(1)}%`,
    );
  }

  if (!noVsRandomRegression) {
    rejectionReasons.push(
      `Regression in vsRandom: ${(vsRandomDelta * 100).toFixed(1)}% ` +
        `exceeds max allowed -${(config.thresholds.vsRandomMaxRegression * 100).toFixed(1)}%`,
    );
  }

  // Overall decision
  const accepted =
    sufficientGames &&
    (config.requireSignificance ? statisticallySignificant : true) &&
    meetsImprovementThreshold &&
    noRegression;

  // Generate summary
  let summary: string;
  if (accepted) {
    summary =
      `✓ ACCEPTED: +${(vsGreedyDelta * 100).toFixed(1)}% vs Greedy ` +
      `(${(newMetrics.vsGreedy * 100).toFixed(1)}% vs ${(oldMetrics.vsGreedy * 100).toFixed(1)}%), ` +
      `+${eloDelta.toFixed(0)} Elo`;
  } else {
    summary = `✗ REJECTED: ${rejectionReasons[0] || 'Unknown reason'}`;
  }

  return {
    accepted,
    summary,
    checks: {
      sufficientGames,
      statisticallySignificant,
      meetsImprovementThreshold,
      noRegression,
    },
    details: {
      oldMetrics,
      newMetrics,
      oldCI,
      newCI,
      vsGreedyDelta,
      vsRandomDelta,
      eloDelta,
    },
    rejectionReasons,
  };
}

/**
 * Format a validation result for console output
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                    VALIDATION RESULT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  // Summary
  lines.push(result.summary);
  lines.push('');

  // Metrics comparison
  lines.push('Performance Comparison:');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(
    `  vs GreedyBot:  ${(result.details.oldMetrics.vsGreedy * 100).toFixed(1)}% → ${(result.details.newMetrics.vsGreedy * 100).toFixed(1)}%  (${result.details.vsGreedyDelta >= 0 ? '+' : ''}${(result.details.vsGreedyDelta * 100).toFixed(1)}%)`,
  );
  lines.push(
    `  vs RandomBot:  ${(result.details.oldMetrics.vsRandom * 100).toFixed(1)}% → ${(result.details.newMetrics.vsRandom * 100).toFixed(1)}%  (${result.details.vsRandomDelta >= 0 ? '+' : ''}${(result.details.vsRandomDelta * 100).toFixed(1)}%)`,
  );
  lines.push(
    `  Elo Rating:    ${result.details.oldMetrics.elo.toFixed(0)} → ${result.details.newMetrics.elo.toFixed(0)}  (${result.details.eloDelta >= 0 ? '+' : ''}${result.details.eloDelta.toFixed(0)})`,
  );
  lines.push(
    `  Games Played:  ${result.details.oldMetrics.gamesPlayed} → ${result.details.newMetrics.gamesPlayed}`,
  );
  lines.push('');

  // Confidence intervals
  lines.push('Confidence Intervals (vs GreedyBot):');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(
    `  Old: [${(result.details.oldCI.lower * 100).toFixed(1)}%, ${(result.details.oldCI.upper * 100).toFixed(1)}%]  (width: ${(result.details.oldCI.width * 100).toFixed(1)}%)`,
  );
  lines.push(
    `  New: [${(result.details.newCI.lower * 100).toFixed(1)}%, ${(result.details.newCI.upper * 100).toFixed(1)}%]  (width: ${(result.details.newCI.width * 100).toFixed(1)}%)`,
  );
  lines.push('');

  // Check results
  lines.push('Validation Checks:');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`  ${result.checks.sufficientGames ? '✓' : '✗'} Sufficient games played`);
  lines.push(`  ${result.checks.statisticallySignificant ? '✓' : '✗'} Statistically significant`);
  lines.push(
    `  ${result.checks.meetsImprovementThreshold ? '✓' : '✗'} Meets improvement threshold`,
  );
  lines.push(`  ${result.checks.noRegression ? '✓' : '✗'} No regression in metrics`);
  lines.push('');

  // Rejection reasons (if any)
  if (result.rejectionReasons.length > 0) {
    lines.push('Rejection Reasons:');
    lines.push('───────────────────────────────────────────────────────────────');
    for (const reason of result.rejectionReasons) {
      lines.push(`  • ${reason}`);
    }
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Quick check if new metrics are likely better (for progress display)
 *
 * Less rigorous than full validation, used during tuning to show progress
 */
export function isLikelyBetter(
  oldMetrics: PerformanceMetrics,
  newMetrics: PerformanceMetrics,
): boolean {
  // Simple heuristic: better in at least 2 of 3 metrics
  let betterCount = 0;

  if (newMetrics.vsGreedy > oldMetrics.vsGreedy) betterCount++;
  if (newMetrics.vsRandom > oldMetrics.vsRandom) betterCount++;
  if (newMetrics.elo > oldMetrics.elo) betterCount++;

  return betterCount >= 2;
}

/**
 * Calculate required sample size for detecting a given effect size
 *
 * Useful for planning how many games to run in validation
 *
 * @param baselineRate - Expected baseline win rate (e.g., 0.52)
 * @param effectSize - Minimum detectable improvement (e.g., 0.03 for 3%)
 * @param power - Statistical power (default 0.8)
 * @param alpha - Significance level (default 0.05)
 * @returns Required number of games
 */
export function calculateRequiredSampleSize(
  baselineRate: number,
  effectSize: number,
  power: number = 0.8,
  alpha: number = 0.05,
): number {
  // Z-scores for alpha and power
  const zAlpha = getZScore(1 - alpha);
  const zBeta = getZScore(power);

  const p1 = baselineRate;
  const p2 = baselineRate + effectSize;
  const pBar = (p1 + p2) / 2;

  // Sample size formula for comparing two proportions
  const numerator = Math.pow(
    zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)),
    2,
  );
  const denominator = Math.pow(p2 - p1, 2);

  return Math.ceil(numerator / denominator);
}
