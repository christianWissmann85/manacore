import { expect, test, describe } from "bun:test";

/**
 * Task 1: Design Benchmark Metrics
 * This test file serves as the "Red" phase for the benchmarking design.
 * It defines the expected structure of a comprehensive benchmark result.
 */

import { BenchmarkRunner, type BenchmarkResult } from "../src/simulation/BenchmarkRunner";

describe("Benchmarking Design", () => {
  test("Benchmark result should contain expanded metrics", () => {
    const result: BenchmarkResult = BenchmarkRunner.getPlaceholderResult();

    const requiredKeys: (keyof BenchmarkResult)[] = [
      "actionsPerSecond",
      "avgTurnResolutionTimeMs",
      "peakMemoryMb",
      "avgMemoryMb",
      "ruleComplianceRate",
    ];

    for (const key of requiredKeys) {
      expect(result).toHaveProperty(key);
    }
  });
});
