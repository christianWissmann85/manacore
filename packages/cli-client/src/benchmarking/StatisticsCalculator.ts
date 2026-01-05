/**
 * StatisticsCalculator - Statistical analysis for benchmark results
 *
 * Provides:
 * - Wilson score confidence intervals for win rates
 * - Elo rating calculation from head-to-head results
 * - Statistical significance testing
 */

/**
 * Wilson score confidence interval
 *
 * More accurate than normal approximation for proportions,
 * especially when rates are near 0% or 100%.
 *
 * @param wins - Number of wins
 * @param total - Total games
 * @param confidence - Confidence level (default 0.95 for 95% CI)
 * @returns [lower, upper] bounds as proportions (0-1)
 */
export function wilsonInterval(wins: number, total: number, confidence = 0.95): [number, number] {
  if (total === 0) return [0, 0];

  // Z-score for confidence level
  const z = getZScore(confidence);
  const p = wins / total;
  const n = total;

  // Wilson score formula
  const denominator = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);

  const lower = Math.max(0, (center - spread) / denominator);
  const upper = Math.min(1, (center + spread) / denominator);

  return [lower, upper];
}

/**
 * Get Z-score for given confidence level
 */
function getZScore(confidence: number): number {
  // Common values
  if (confidence === 0.95) return 1.96;
  if (confidence === 0.99) return 2.576;
  if (confidence === 0.9) return 1.645;

  // Approximate for other values using inverse normal
  // This is a rough approximation
  const alpha = 1 - confidence;
  return Math.sqrt(2) * inverseErf(1 - alpha);
}

/**
 * Inverse error function approximation
 */
function inverseErf(x: number): number {
  const a = 0.147;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const ln = Math.log(1 - x * x);
  const term1 = 2 / (Math.PI * a) + ln / 2;
  const term2 = ln / a;

  return sign * Math.sqrt(Math.sqrt(term1 * term1 - term2) - term1);
}

/**
 * Elo rating result for a single bot
 */
export interface EloRating {
  bot: string;
  elo: number;
  gamesPlayed: number;
}

/**
 * Match result for Elo calculation
 */
export interface MatchResult {
  bot1: string;
  bot2: string;
  bot1Wins: number;
  bot2Wins: number;
  draws: number;
}

/**
 * Calculate Elo ratings from match results
 *
 * Uses iterative approach to find stable ratings.
 * Starts all bots at 1500 and adjusts based on results.
 *
 * @param matches - Array of match results
 * @param baseElo - Starting Elo for all bots (default 1500)
 * @param kFactor - K-factor for rating updates (default 32)
 * @param iterations - Number of iterations to stabilize (default 100)
 */
export function calculateEloRatings(
  matches: MatchResult[],
  baseElo = 1500,
  kFactor = 32,
  iterations = 100,
): EloRating[] {
  // Collect all unique bots
  const bots = new Set<string>();
  for (const match of matches) {
    bots.add(match.bot1);
    bots.add(match.bot2);
  }

  // Initialize ratings
  const ratings = new Map<string, number>();
  const gamesPlayed = new Map<string, number>();
  for (const bot of bots) {
    ratings.set(bot, baseElo);
    gamesPlayed.set(bot, 0);
  }

  // Count games per bot
  for (const match of matches) {
    const total = match.bot1Wins + match.bot2Wins + match.draws;
    gamesPlayed.set(match.bot1, (gamesPlayed.get(match.bot1) || 0) + total);
    gamesPlayed.set(match.bot2, (gamesPlayed.get(match.bot2) || 0) + total);
  }

  // Iteratively update ratings
  for (let i = 0; i < iterations; i++) {
    for (const match of matches) {
      const r1 = ratings.get(match.bot1)!;
      const r2 = ratings.get(match.bot2)!;

      // Expected scores
      const e1 = expectedScore(r1, r2);
      const e2 = expectedScore(r2, r1);

      // Actual scores (draws count as 0.5)
      const total = match.bot1Wins + match.bot2Wins + match.draws;
      if (total === 0) continue;

      const s1 = (match.bot1Wins + match.draws * 0.5) / total;
      const s2 = (match.bot2Wins + match.draws * 0.5) / total;

      // Update ratings (scaled by number of games)
      const scaledK = kFactor * Math.sqrt(total / 100);
      ratings.set(match.bot1, r1 + scaledK * (s1 - e1));
      ratings.set(match.bot2, r2 + scaledK * (s2 - e2));
    }
  }

  // Convert to array and sort by rating
  const results: EloRating[] = [];
  for (const [bot, elo] of ratings) {
    results.push({
      bot,
      elo: Math.round(elo),
      gamesPlayed: gamesPlayed.get(bot) || 0,
    });
  }

  results.sort((a, b) => b.elo - a.elo);
  return results;
}

/**
 * Expected score in Elo system
 */
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Two-proportion Z-test for comparing win rates
 *
 * Tests H0: p1 = p2 (win rates are equal)
 *
 * @param wins1 - Wins for group 1
 * @param total1 - Total games for group 1
 * @param wins2 - Wins for group 2
 * @param total2 - Total games for group 2
 * @returns p-value (probability of observed difference under H0)
 */
export function proportionZTest(
  wins1: number,
  total1: number,
  wins2: number,
  total2: number,
): number {
  if (total1 === 0 || total2 === 0) return 1;

  const p1 = wins1 / total1;
  const p2 = wins2 / total2;

  // Pooled proportion
  const pPooled = (wins1 + wins2) / (total1 + total2);

  // Standard error
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / total1 + 1 / total2));

  if (se === 0) return p1 === p2 ? 1 : 0;

  // Z-statistic
  const z = (p1 - p2) / se;

  // Two-tailed p-value
  return 2 * (1 - normalCDF(Math.abs(z)));
}

/**
 * Standard normal cumulative distribution function
 */
function normalCDF(x: number): number {
  // Approximation using error function
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

/**
 * Error function approximation
 */
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Recommended minimum games for a given margin of error
 *
 * @param marginOfError - Desired margin of error (e.g., 0.05 for ±5%)
 * @param confidence - Confidence level (default 0.95)
 * @returns Minimum recommended games
 */
export function recommendedGames(marginOfError: number, confidence = 0.95): number {
  const z = getZScore(confidence);
  // Conservative estimate using p = 0.5 (maximum variance)
  const n = Math.ceil((z * z * 0.25) / (marginOfError * marginOfError));
  return n;
}

/**
 * Format confidence interval as string
 */
export function formatCI(ci: [number, number], asPercent = true): string {
  if (asPercent) {
    return `[${(ci[0] * 100).toFixed(1)}%, ${(ci[1] * 100).toFixed(1)}%]`;
  }
  return `[${ci[0].toFixed(3)}, ${ci[1].toFixed(3)}]`;
}
