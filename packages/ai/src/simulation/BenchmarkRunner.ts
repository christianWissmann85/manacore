export interface BenchmarkResult {
  p1Name: string;
  p2Name: string;
  games: number;
  p1Wins: number;
  p2Wins: number;
  draws: number;
  errors: number;
  avgTurns: number;
  gamesPerSecond: number;
  actionsPerSecond: number;
  avgTurnResolutionTimeMs: number;
  peakMemoryMb: number;
  avgMemoryMb: number;
  ruleComplianceRate: number;
}

export class BenchmarkRunner {
  // Implementation will follow in Task 2
  static getPlaceholderResult(): BenchmarkResult {
    return {
      p1Name: "Placeholder",
      p2Name: "Placeholder",
      games: 0,
      p1Wins: 0,
      p2Wins: 0,
      draws: 0,
      errors: 0,
      avgTurns: 0,
      gamesPerSecond: 0,
      actionsPerSecond: 0,
      avgTurnResolutionTimeMs: 0,
      peakMemoryMb: 0,
      avgMemoryMb: 0,
      ruleComplianceRate: 0,
    };
  }
}
