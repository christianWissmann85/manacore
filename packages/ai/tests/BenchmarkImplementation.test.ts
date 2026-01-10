import { expect, test, describe } from 'bun:test';
import { BenchmarkRunner } from '../src/simulation/BenchmarkRunner';
import { RandomBot } from '../src/bots/RandomBot';

describe('Benchmark Implementation', () => {
  test('BenchmarkRunner should execute games and return real metrics', async () => {
    const p1 = new RandomBot(1);
    const p2 = new RandomBot(2);
    const numGames = 5;

    const result = await BenchmarkRunner.run(p1, p2, numGames);

    expect(result.games).toBe(numGames);
    expect(result.gamesPerSecond).toBeGreaterThan(0);
    expect(result.actionsPerSecond).toBeGreaterThan(0);
    expect(result.avgTurnResolutionTimeMs).toBeGreaterThan(0);
    expect(result.peakMemoryMb).toBeGreaterThan(0);
    expect(result.ruleComplianceRate).toBeGreaterThan(0);
  });
});
