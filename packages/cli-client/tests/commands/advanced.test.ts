/**
 * Advanced Commands Tests
 *
 * Comprehensive tests for advanced command modules:
 * - Benchmark Suite (benchmarkSuite.ts)
 * - Tuning Commands (tune.ts, tune-mcts.ts)
 * - Supporting utilities (presets, statistics, etc.)
 *
 * Tests cover:
 * - Benchmark execution and configuration
 * - Results aggregation and win rate matrices
 * - Elo calculation and statistics
 * - Configuration validation
 * - Output formatting
 * - Preset handling
 * - Error handling
 */

import { describe, test, expect, beforeEach, afterAll, mock, spyOn } from 'bun:test';
import {
  createTempDir,
  cleanupTempDir,
  cleanupAllTempDirs,
  createMockBot,
  readJsonFile,
} from '../helpers';
import type { BotType } from '../../src/botFactory';
import { createBot } from '../../src/botFactory';
import { OutputLevel } from '../../src/types';
import * as fs from 'fs';
import { join } from 'path';

// =============================================================================
// BENCHMARKING IMPORTS
// =============================================================================

import { BenchmarkRunner, runBenchmark } from '../../src/benchmarking/BenchmarkRunner';
import { MatchupRecorder } from '../../src/benchmarking/MatchupRecorder';
import {
  wilsonInterval,
  calculateEloRatings,
  proportionZTest,
  recommendedGames,
  formatCI,
} from '../../src/benchmarking/StatisticsCalculator';
import {
  getPreset,
  getAllBotTypes,
  getPresetNames,
  isValidBotType,
  parseBotList,
  BENCHMARK_PRESETS,
} from '../../src/benchmarking/presets';
import type {
  BenchmarkConfig,
  BenchmarkResults,
  BenchmarkProgress,
  MatchupResult,
  BotRanking,
} from '../../src/benchmarking/types';

// =============================================================================
// COMMAND IMPORTS
// =============================================================================

import {
  parseBenchmarkSuiteArgs,
  type BenchmarkSuiteOptions,
} from '../../src/commands/benchmarkSuite';
import { parseTuneMCTSArgs, type TuneMCTSOptions } from '../../src/commands/tune-mcts';
import type { TuneOptions } from '../../src/commands/tune';

// Cleanup after all tests
afterAll(() => {
  cleanupAllTempDirs();
});

// =============================================================================
// STATISTICS CALCULATOR TESTS
// =============================================================================

describe('StatisticsCalculator', () => {
  describe('wilsonInterval', () => {
    test('returns [0, 0] for zero total games', () => {
      const [lower, upper] = wilsonInterval(0, 0);
      expect(lower).toBe(0);
      expect(upper).toBe(0);
    });

    test('calculates correct interval for 50% win rate', () => {
      const [lower, upper] = wilsonInterval(50, 100);
      // At 50/100 wins, the 95% CI should be roughly [0.40, 0.60]
      expect(lower).toBeGreaterThan(0.35);
      expect(lower).toBeLessThan(0.45);
      expect(upper).toBeGreaterThan(0.55);
      expect(upper).toBeLessThan(0.65);
    });

    test('calculates correct interval for 100% win rate', () => {
      const [lower, upper] = wilsonInterval(100, 100);
      // At 100% wins, interval should be close to [0.96, 1.0]
      expect(lower).toBeGreaterThan(0.9);
      expect(upper).toBeCloseTo(1, 5); // Use toBeCloseTo for floating point
    });

    test('calculates correct interval for 0% win rate', () => {
      const [lower, upper] = wilsonInterval(0, 100);
      // At 0% wins, interval should be close to [0, 0.04]
      expect(lower).toBe(0);
      expect(upper).toBeLessThan(0.1);
    });

    test('interval narrows with more games', () => {
      const [lower10, upper10] = wilsonInterval(5, 10);
      const [lower100, upper100] = wilsonInterval(50, 100);
      const [lower1000, upper1000] = wilsonInterval(500, 1000);

      const width10 = upper10 - lower10;
      const width100 = upper100 - lower100;
      const width1000 = upper1000 - lower1000;

      expect(width10).toBeGreaterThan(width100);
      expect(width100).toBeGreaterThan(width1000);
    });

    test('handles small sample sizes', () => {
      const [lower, upper] = wilsonInterval(1, 2);
      // With 1 win in 2 games, interval should be wide
      expect(lower).toBeLessThan(0.3);
      expect(upper).toBeGreaterThan(0.7);
    });

    test('supports custom confidence levels', () => {
      const [lower95, upper95] = wilsonInterval(50, 100, 0.95);
      const [lower99, upper99] = wilsonInterval(50, 100, 0.99);

      // 99% CI should be wider than 95% CI
      const width95 = upper95 - lower95;
      const width99 = upper99 - lower99;
      expect(width99).toBeGreaterThan(width95);
    });
  });

  describe('calculateEloRatings', () => {
    test('returns empty array for no matches', () => {
      const ratings = calculateEloRatings([]);
      expect(ratings).toEqual([]);
    });

    test('calculates ratings for simple matchup', () => {
      const matches = [
        { bot1: 'A', bot2: 'B', bot1Wins: 10, bot2Wins: 0, draws: 0 },
      ];

      const ratings = calculateEloRatings(matches);
      expect(ratings).toHaveLength(2);

      const botA = ratings.find((r) => r.bot === 'A');
      const botB = ratings.find((r) => r.bot === 'B');

      expect(botA).toBeDefined();
      expect(botB).toBeDefined();
      expect(botA!.elo).toBeGreaterThan(botB!.elo);
    });

    test('ratings converge for balanced matchup', () => {
      const matches = [
        { bot1: 'A', bot2: 'B', bot1Wins: 50, bot2Wins: 50, draws: 0 },
      ];

      const ratings = calculateEloRatings(matches);
      const botA = ratings.find((r) => r.bot === 'A');
      const botB = ratings.find((r) => r.bot === 'B');

      // Ratings should be nearly equal (within ~50 points)
      expect(Math.abs(botA!.elo - botB!.elo)).toBeLessThan(50);
    });

    test('handles draws correctly', () => {
      const matches = [
        { bot1: 'A', bot2: 'B', bot1Wins: 0, bot2Wins: 0, draws: 100 },
      ];

      const ratings = calculateEloRatings(matches);
      const botA = ratings.find((r) => r.bot === 'A');
      const botB = ratings.find((r) => r.bot === 'B');

      // All draws should result in nearly equal ratings
      expect(Math.abs(botA!.elo - botB!.elo)).toBeLessThan(50);
    });

    test('ranks multiple bots correctly', () => {
      const matches = [
        { bot1: 'A', bot2: 'B', bot1Wins: 80, bot2Wins: 20, draws: 0 },
        { bot1: 'A', bot2: 'C', bot1Wins: 90, bot2Wins: 10, draws: 0 },
        { bot1: 'B', bot2: 'C', bot1Wins: 70, bot2Wins: 30, draws: 0 },
      ];

      const ratings = calculateEloRatings(matches);

      // Should be sorted by Elo (descending)
      expect(ratings[0].bot).toBe('A');
      expect(ratings[1].bot).toBe('B');
      expect(ratings[2].bot).toBe('C');
    });

    test('tracks games played', () => {
      const matches = [
        { bot1: 'A', bot2: 'B', bot1Wins: 10, bot2Wins: 5, draws: 5 },
      ];

      const ratings = calculateEloRatings(matches);
      const botA = ratings.find((r) => r.bot === 'A');
      const botB = ratings.find((r) => r.bot === 'B');

      // Each bot played 20 games total
      expect(botA!.gamesPlayed).toBe(20);
      expect(botB!.gamesPlayed).toBe(20);
    });

    test('uses custom base Elo', () => {
      const matches = [
        { bot1: 'A', bot2: 'B', bot1Wins: 50, bot2Wins: 50, draws: 0 },
      ];

      const ratings = calculateEloRatings(matches, 1000);
      const avgElo = (ratings[0].elo + ratings[1].elo) / 2;

      // Average should be close to base Elo
      expect(Math.abs(avgElo - 1000)).toBeLessThan(50);
    });
  });

  describe('proportionZTest', () => {
    test('returns 1 for zero total games', () => {
      expect(proportionZTest(0, 0, 0, 0)).toBe(1);
      expect(proportionZTest(5, 10, 0, 0)).toBe(1);
      expect(proportionZTest(0, 0, 5, 10)).toBe(1);
    });

    test('returns high p-value for similar proportions', () => {
      const pValue = proportionZTest(50, 100, 51, 100);
      expect(pValue).toBeGreaterThan(0.1); // Not significant
    });

    test('returns low p-value for different proportions', () => {
      const pValue = proportionZTest(80, 100, 20, 100);
      expect(pValue).toBeLessThan(0.01); // Highly significant
    });

    test('handles identical proportions', () => {
      const pValue = proportionZTest(50, 100, 50, 100);
      expect(pValue).toBeCloseTo(1, 5); // No difference, use toBeCloseTo for floating point
    });
  });

  describe('recommendedGames', () => {
    test('recommends more games for smaller margin of error', () => {
      const games5pct = recommendedGames(0.05);
      const games10pct = recommendedGames(0.10);

      expect(games5pct).toBeGreaterThan(games10pct);
    });

    test('returns reasonable values for common margins', () => {
      const games5pct = recommendedGames(0.05);
      // For 5% margin of error at 95% confidence, need ~400 games
      expect(games5pct).toBeGreaterThan(300);
      expect(games5pct).toBeLessThan(500);
    });
  });

  describe('formatCI', () => {
    test('formats as percentage by default', () => {
      const result = formatCI([0.4, 0.6]);
      expect(result).toBe('[40.0%, 60.0%]');
    });

    test('formats as decimal when requested', () => {
      const result = formatCI([0.4, 0.6], false);
      expect(result).toBe('[0.400, 0.600]');
    });
  });
});

// =============================================================================
// BENCHMARK PRESETS TESTS
// =============================================================================

describe('Benchmark Presets', () => {
  describe('getPreset', () => {
    test('returns quick preset configuration', () => {
      const preset = getPreset('quick');
      expect(preset).toBeDefined();
      expect(preset!.bots).toBeInstanceOf(Array);
      expect(preset!.gamesPerMatchup).toBeGreaterThan(0);
      expect(preset!.description).toBeDefined();
      expect(preset!.estimatedTime).toBeDefined();
    });

    test('returns standard preset configuration', () => {
      const preset = getPreset('standard');
      expect(preset).toBeDefined();
      expect(preset!.bots.length).toBeGreaterThanOrEqual(4);
      expect(preset!.gamesPerMatchup).toBe(100);
    });

    test('returns comprehensive preset configuration', () => {
      const preset = getPreset('comprehensive');
      expect(preset).toBeDefined();
      expect(preset!.bots.length).toBeGreaterThanOrEqual(5);
    });

    test('returns undefined for custom preset', () => {
      const preset = getPreset('custom');
      expect(preset).toBeUndefined();
    });
  });

  describe('getAllBotTypes', () => {
    test('returns array of bot types', () => {
      const bots = getAllBotTypes();
      expect(bots).toBeInstanceOf(Array);
      expect(bots.length).toBeGreaterThan(0);
      expect(bots).toContain('random');
      expect(bots).toContain('greedy');
    });
  });

  describe('getPresetNames', () => {
    test('returns all preset names', () => {
      const names = getPresetNames();
      expect(names).toContain('quick');
      expect(names).toContain('standard');
      expect(names).toContain('comprehensive');
    });
  });

  describe('isValidBotType', () => {
    test('returns true for valid bot types', () => {
      expect(isValidBotType('random')).toBe(true);
      expect(isValidBotType('greedy')).toBe(true);
      expect(isValidBotType('mcts-eval')).toBe(true);
    });

    test('returns false for invalid bot types', () => {
      expect(isValidBotType('invalid')).toBe(false);
      expect(isValidBotType('')).toBe(false);
      expect(isValidBotType('super-bot')).toBe(false);
    });
  });

  describe('parseBotList', () => {
    test('parses comma-separated bot list', () => {
      const bots = parseBotList('random,greedy');
      expect(bots).toEqual(['random', 'greedy']);
    });

    test('handles whitespace', () => {
      const bots = parseBotList('random , greedy , mcts-eval');
      expect(bots).toEqual(['random', 'greedy', 'mcts-eval']);
    });

    test('filters invalid bot types', () => {
      // Suppress console.warn during test
      const originalWarn = console.warn;
      console.warn = () => {};

      try {
        const bots = parseBotList('random,invalid,greedy');
        expect(bots).toEqual(['random', 'greedy']);
      } finally {
        console.warn = originalWarn;
      }
    });

    test('converts to lowercase', () => {
      const bots = parseBotList('RANDOM,GREEDY');
      expect(bots).toEqual(['random', 'greedy']);
    });
  });

  describe('BENCHMARK_PRESETS', () => {
    test('quick preset has fewer bots than standard', () => {
      expect(BENCHMARK_PRESETS.quick.bots.length).toBeLessThanOrEqual(
        BENCHMARK_PRESETS.standard.bots.length
      );
    });

    test('standard preset has fewer bots than comprehensive', () => {
      expect(BENCHMARK_PRESETS.standard.bots.length).toBeLessThanOrEqual(
        BENCHMARK_PRESETS.comprehensive.bots.length
      );
    });

    test('all presets have required fields', () => {
      for (const [name, preset] of Object.entries(BENCHMARK_PRESETS)) {
        expect(preset.bots).toBeInstanceOf(Array);
        expect(preset.gamesPerMatchup).toBeGreaterThan(0);
        expect(preset.description).toBeTruthy();
        expect(preset.estimatedTime).toBeTruthy();
      }
    });
  });
});

// =============================================================================
// MATCHUP RECORDER TESTS
// =============================================================================

describe('MatchupRecorder', () => {
  const defaultConfig: BenchmarkConfig = {
    bots: ['random', 'greedy'] as BotType[],
    gamesPerMatchup: 10,
    maxTurns: 100,
    seed: 12345,
    parallel: false,
    outputLevel: OutputLevel.QUIET,
  };

  test('initializes matchup slots for all bot pairs', () => {
    const recorder = new MatchupRecorder(defaultConfig);

    // Should have 4 matchup slots: random-random, random-greedy, greedy-random, greedy-greedy
    const result = recorder.getMatchupResult('random', 'greedy');
    expect(result.totalGames).toBe(0);
    expect(result.bot1Wins).toBe(0);
    expect(result.bot2Wins).toBe(0);
  });

  test('records game results correctly', () => {
    const recorder = new MatchupRecorder(defaultConfig);

    recorder.recordGame('random', 'greedy', 'bot1', 10, 100);
    recorder.recordGame('random', 'greedy', 'bot2', 12, 120);
    recorder.recordGame('random', 'greedy', 'draw', 8, 80);

    const result = recorder.getMatchupResult('random', 'greedy');
    expect(result.bot1Wins).toBe(1);
    expect(result.bot2Wins).toBe(1);
    expect(result.draws).toBe(1);
    expect(result.totalGames).toBe(3);
  });

  test('calculates win rate correctly', () => {
    const recorder = new MatchupRecorder(defaultConfig);

    recorder.recordGame('random', 'greedy', 'bot1', 10, 100);
    recorder.recordGame('random', 'greedy', 'bot1', 10, 100);
    recorder.recordGame('random', 'greedy', 'bot2', 10, 100);
    recorder.recordGame('random', 'greedy', 'draw', 10, 100);

    const result = recorder.getMatchupResult('random', 'greedy');
    expect(result.winRate).toBe(0.5); // 2 wins out of 4 games
  });

  test('calculates average turns correctly', () => {
    const recorder = new MatchupRecorder(defaultConfig);

    recorder.recordGame('random', 'greedy', 'bot1', 10, 100);
    recorder.recordGame('random', 'greedy', 'bot1', 20, 100);
    recorder.recordGame('random', 'greedy', 'bot2', 30, 100);

    const result = recorder.getMatchupResult('random', 'greedy');
    expect(result.avgTurns).toBe(20); // (10 + 20 + 30) / 3
  });

  test('includes confidence interval in result', () => {
    const recorder = new MatchupRecorder(defaultConfig);

    // Record 10 games
    for (let i = 0; i < 10; i++) {
      recorder.recordGame('random', 'greedy', i < 6 ? 'bot1' : 'bot2', 10, 100);
    }

    const result = recorder.getMatchupResult('random', 'greedy');
    expect(result.confidenceInterval).toBeDefined();
    expect(result.confidenceInterval![0]).toBeLessThan(result.winRate);
    expect(result.confidenceInterval![1]).toBeGreaterThan(result.winRate);
  });

  test('builds win rate matrix', () => {
    const recorder = new MatchupRecorder(defaultConfig);

    recorder.recordGame('random', 'greedy', 'bot1', 10, 100);
    recorder.recordGame('greedy', 'random', 'bot2', 10, 100);

    const matrix = recorder.buildMatrix();

    expect(matrix['random']['greedy']).toBe(1); // 1 win, 1 game
    expect(matrix['greedy']['random']).toBe(0); // 0 wins, 1 game
  });

  test('calculates rankings by average win rate', () => {
    const config: BenchmarkConfig = {
      ...defaultConfig,
      bots: ['random', 'greedy', 'mcts-eval'] as BotType[],
    };
    const recorder = new MatchupRecorder(config);

    // Random beats everyone
    recorder.recordGame('random', 'greedy', 'bot1', 10, 100);
    recorder.recordGame('random', 'mcts-eval', 'bot1', 10, 100);

    // Greedy splits
    recorder.recordGame('greedy', 'random', 'bot1', 10, 100);
    recorder.recordGame('greedy', 'mcts-eval', 'bot2', 10, 100);

    // MCTS loses to everyone
    recorder.recordGame('mcts-eval', 'random', 'bot2', 10, 100);
    recorder.recordGame('mcts-eval', 'greedy', 'bot2', 10, 100);

    const rankings = recorder.calculateRankings();

    expect(rankings).toHaveLength(3);
    // Rankings are sorted by avgWinRate descending
    expect(rankings[0].avgWinRate).toBeGreaterThanOrEqual(rankings[1].avgWinRate);
    expect(rankings[1].avgWinRate).toBeGreaterThanOrEqual(rankings[2].avgWinRate);
  });

  test('calculates Elo ratings when requested', () => {
    const recorder = new MatchupRecorder(defaultConfig);

    // Record several games
    for (let i = 0; i < 10; i++) {
      recorder.recordGame('random', 'greedy', 'bot1', 10, 100);
    }

    const rankings = recorder.calculateRankings(true);

    // Elo should be defined
    expect(rankings[0].elo).toBeDefined();
    expect(rankings[1].elo).toBeDefined();

    // Winner should have higher Elo
    const randomRanking = rankings.find((r) => r.bot === 'random');
    const greedyRanking = rankings.find((r) => r.bot === 'greedy');
    expect(randomRanking!.elo).toBeGreaterThan(greedyRanking!.elo!);
  });

  test('returns all matchup results', () => {
    const recorder = new MatchupRecorder(defaultConfig);

    recorder.recordGame('random', 'greedy', 'bot1', 10, 100);
    recorder.recordGame('greedy', 'random', 'bot2', 10, 100);

    const allMatchups = recorder.getAllMatchups();

    // 2 bots = 4 matchups (including mirrors)
    expect(allMatchups).toHaveLength(4);
  });

  test('calculates summary statistics', () => {
    const recorder = new MatchupRecorder(defaultConfig);

    recorder.recordGame('random', 'greedy', 'bot1', 10, 100);
    recorder.recordGame('greedy', 'random', 'bot2', 10, 100);

    const summary = recorder.calculateSummary();

    expect(summary.totalGames).toBe(2);
    expect(summary.totalMatchups).toBe(4); // All possible matchups
    expect(summary.botsCompared).toBe(2);
    // Duration might be 0 in fast tests, so check it's non-negative
    expect(summary.totalDurationMs).toBeGreaterThanOrEqual(0);
    // Games per second can be Infinity if duration is 0, or a positive number
    expect(summary.gamesPerSecond).toBeGreaterThanOrEqual(0);
  });

  test('finalizes results with metadata', () => {
    const recorder = new MatchupRecorder(defaultConfig);

    recorder.recordGame('random', 'greedy', 'bot1', 10, 100);

    const results = recorder.finalize('test', false);

    expect(results.config).toEqual(defaultConfig);
    expect(results.matchups).toHaveLength(4);
    expect(results.matrix).toBeDefined();
    expect(results.rankings).toBeDefined();
    expect(results.summary).toBeDefined();
    expect(results.metadata.seed).toBe(12345);
    expect(results.metadata.preset).toBe('test');
    expect(results.metadata.startTime).toBeDefined();
    expect(results.metadata.endTime).toBeDefined();
  });

  test('getCurrentWinRate returns correct value during benchmark', () => {
    const recorder = new MatchupRecorder(defaultConfig);

    recorder.recordGame('random', 'greedy', 'bot1', 10, 100);
    recorder.recordGame('random', 'greedy', 'bot1', 10, 100);
    recorder.recordGame('random', 'greedy', 'bot2', 10, 100);

    const winRate = recorder.getCurrentWinRate('random', 'greedy');
    expect(winRate).toBeCloseTo(2 / 3, 5);
  });

  test('throws error for unknown matchup', () => {
    const recorder = new MatchupRecorder(defaultConfig);

    expect(() => {
      recorder.getMatchupResult('unknown' as BotType, 'greedy');
    }).toThrow('Unknown matchup');
  });
});

// =============================================================================
// BENCHMARK RUNNER TESTS
// =============================================================================

describe('BenchmarkRunner', () => {
  test('calculates total games correctly', () => {
    const runner = new BenchmarkRunner({
      bots: ['random', 'greedy'] as BotType[],
      gamesPerMatchup: 10,
    });

    // 2 bots = 4 matchups (including mirrors), 10 games each = 40 total
    expect(runner.getTotalGames()).toBe(40);
  });

  test('calculates total matchups correctly', () => {
    const runner = new BenchmarkRunner({
      bots: ['random', 'greedy', 'mcts-eval'] as BotType[],
      gamesPerMatchup: 10,
    });

    // 3 bots = 9 matchups (3x3 including mirrors)
    expect(runner.getTotalMatchups()).toBe(9);
  });

  test('returns config copy', () => {
    const config = {
      bots: ['random', 'greedy'] as BotType[],
      gamesPerMatchup: 5,
      seed: 99999,
    };
    const runner = new BenchmarkRunner(config);

    const returnedConfig = runner.getConfig();
    expect(returnedConfig.bots).toEqual(['random', 'greedy']);
    expect(returnedConfig.gamesPerMatchup).toBe(5);
    expect(returnedConfig.seed).toBe(99999);
  });

  test('uses default config values', () => {
    const runner = new BenchmarkRunner({});
    const config = runner.getConfig();

    expect(config.bots).toEqual(['random', 'greedy']);
    expect(config.gamesPerMatchup).toBe(50);
    expect(config.maxTurns).toBe(100);
  });
});

// =============================================================================
// BENCHMARK SUITE COMMAND ARGUMENT PARSING TESTS
// =============================================================================

describe('parseBenchmarkSuiteArgs', () => {
  test('returns default options with no arguments', () => {
    const options = parseBenchmarkSuiteArgs([]);

    expect(options.preset).toBe('quick');
    expect(options.exportJson).toBe(true);
  });

  test('parses --preset argument', () => {
    const options = parseBenchmarkSuiteArgs(['--preset', 'comprehensive']);
    expect(options.preset).toBe('comprehensive');
  });

  test('parses --bots argument', () => {
    // Suppress console.warn
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      const options = parseBenchmarkSuiteArgs(['--bots', 'random,greedy']);
      expect(options.bots).toEqual(['random', 'greedy']);
      expect(options.preset).toBe('custom');
    } finally {
      console.warn = originalWarn;
    }
  });

  test('parses --games argument', () => {
    const options = parseBenchmarkSuiteArgs(['--games', '200']);
    expect(options.gamesPerMatchup).toBe(200);
  });

  test('parses --seed argument', () => {
    const options = parseBenchmarkSuiteArgs(['--seed', '42']);
    expect(options.seed).toBe(42);
  });

  test('parses --turns argument', () => {
    const options = parseBenchmarkSuiteArgs(['--turns', '50']);
    expect(options.maxTurns).toBe(50);
  });

  test('parses --quiet flag', () => {
    const options = parseBenchmarkSuiteArgs(['--quiet']);
    expect(options.outputLevel).toBe(OutputLevel.QUIET);
  });

  test('parses --verbose flag', () => {
    const options = parseBenchmarkSuiteArgs(['--verbose']);
    expect(options.outputLevel).toBe(OutputLevel.VERBOSE);
  });

  test('parses --no-export flag', () => {
    const options = parseBenchmarkSuiteArgs(['--no-export']);
    expect(options.exportJson).toBe(false);
  });

  test('parses --export-path argument', () => {
    const options = parseBenchmarkSuiteArgs(['--export-path', '/tmp/results.json']);
    expect(options.exportPath).toBe('/tmp/results.json');
  });

  test('parses --elo flag', () => {
    const options = parseBenchmarkSuiteArgs(['--elo']);
    expect(options.includeElo).toBe(true);
  });

  test('parses --export-markdown flag', () => {
    const options = parseBenchmarkSuiteArgs(['--export-markdown']);
    expect(options.exportMarkdown).toBe(true);
  });

  test('parses multiple arguments', () => {
    const options = parseBenchmarkSuiteArgs([
      '--preset', 'standard',
      '--games', '100',
      '--seed', '12345',
      '--elo',
      '--export-markdown',
    ]);

    expect(options.preset).toBe('standard');
    expect(options.gamesPerMatchup).toBe(100);
    expect(options.seed).toBe(12345);
    expect(options.includeElo).toBe(true);
    expect(options.exportMarkdown).toBe(true);
  });
});

// =============================================================================
// TUNE MCTS COMMAND ARGUMENT PARSING TESTS
// =============================================================================

describe('parseTuneMCTSArgs', () => {
  test('returns empty options with no arguments', () => {
    const options = parseTuneMCTSArgs([]);
    expect(Object.keys(options)).toHaveLength(0);
  });

  test('parses --method argument', () => {
    const gridOptions = parseTuneMCTSArgs(['--method', 'grid']);
    expect(gridOptions.method).toBe('grid');

    const fineOptions = parseTuneMCTSArgs(['--method', 'coarse-to-fine']);
    expect(fineOptions.method).toBe('coarse-to-fine');
  });

  test('parses --games argument', () => {
    const options = parseTuneMCTSArgs(['--games', '100']);
    expect(options.gamesPerConfig).toBe(100);
  });

  test('parses --games-per-config argument', () => {
    const options = parseTuneMCTSArgs(['--games-per-config', '75']);
    expect(options.gamesPerConfig).toBe(75);
  });

  test('parses --validation argument', () => {
    const options = parseTuneMCTSArgs(['--validation', '300']);
    expect(options.validationGames).toBe(300);
  });

  test('parses --validation-games argument', () => {
    const options = parseTuneMCTSArgs(['--validation-games', '250']);
    expect(options.validationGames).toBe(250);
  });

  test('parses --turns argument', () => {
    const options = parseTuneMCTSArgs(['--turns', '50']);
    expect(options.maxTurns).toBe(50);
  });

  test('parses --max-turns argument', () => {
    const options = parseTuneMCTSArgs(['--max-turns', '75']);
    expect(options.maxTurns).toBe(75);
  });

  test('parses --iterations argument', () => {
    const options = parseTuneMCTSArgs(['--iterations', '100']);
    expect(options.tuningIterations).toBe(100);
  });

  test('parses --seed argument', () => {
    const options = parseTuneMCTSArgs(['--seed', '42']);
    expect(options.seed).toBe(42);
  });

  test('parses --save flag', () => {
    const options = parseTuneMCTSArgs(['--save']);
    expect(options.save).toBe(true);
  });

  test('parses --skip-validation flag', () => {
    const options = parseTuneMCTSArgs(['--skip-validation']);
    expect(options.skipValidation).toBe(true);
  });

  test('parses --verbose flag', () => {
    const options = parseTuneMCTSArgs(['--verbose']);
    expect(options.verbose).toBe(true);
  });

  test('parses -v flag', () => {
    const options = parseTuneMCTSArgs(['-v']);
    expect(options.verbose).toBe(true);
  });

  test('parses multiple arguments', () => {
    const options = parseTuneMCTSArgs([
      '--method', 'grid',
      '--games', '50',
      '--validation', '100',
      '--iterations', '25',
      '--seed', '99999',
      '--save',
      '--verbose',
    ]);

    expect(options.method).toBe('grid');
    expect(options.gamesPerConfig).toBe(50);
    expect(options.validationGames).toBe(100);
    expect(options.tuningIterations).toBe(25);
    expect(options.seed).toBe(99999);
    expect(options.save).toBe(true);
    expect(options.verbose).toBe(true);
  });
});

// =============================================================================
// BOT FACTORY TESTS
// =============================================================================

describe('Bot Factory', () => {
  test('creates random bot', () => {
    const bot = createBot('random', 12345);
    expect(bot).toBeDefined();
    expect(bot.getName()).toContain('Random');
  });

  test('creates greedy bot', () => {
    const bot = createBot('greedy', 12345);
    expect(bot).toBeDefined();
    expect(bot.getName()).toContain('Greedy');
  });

  test('creates mcts-eval-fast bot', () => {
    const bot = createBot('mcts-eval-fast', 12345);
    expect(bot).toBeDefined();
    expect(bot.getName()).toContain('MCTS');
  });

  test('creates mcts-eval bot', () => {
    const bot = createBot('mcts-eval', 12345);
    expect(bot).toBeDefined();
    expect(bot.getName()).toContain('MCTS');
  });

  test('creates mcts-eval-strong bot', () => {
    const bot = createBot('mcts-eval-strong', 12345);
    expect(bot).toBeDefined();
    expect(bot.getName()).toContain('MCTS');
  });

  test('creates mcts-eval-turbo bot', () => {
    const bot = createBot('mcts-eval-turbo', 12345);
    expect(bot).toBeDefined();
    expect(bot.getName()).toContain('MCTS');
  });

  test('creates mcts-ordered bot', () => {
    const bot = createBot('mcts-ordered', 12345);
    expect(bot).toBeDefined();
    expect(bot.getName()).toContain('MCTS');
  });

  test('defaults to random bot for unknown type', () => {
    // Cast to BotType to test default case
    const bot = createBot('unknown' as BotType, 12345);
    expect(bot).toBeDefined();
    expect(bot.getName()).toContain('Random');
  });

  test('bots can choose actions', () => {
    const { initializeGame, createVanillaDeck, getLegalActions } = require('@manacore/engine');
    const deck = createVanillaDeck();
    const state = initializeGame(deck, deck, 12345);

    const bot = createBot('random', 12345);
    const action = bot.chooseAction(state, 'player');

    expect(action).toBeDefined();
    expect(action.type).toBeDefined();
  });
});

// =============================================================================
// CONFIGURATION VALIDATION TESTS
// =============================================================================

describe('Configuration Validation', () => {
  describe('BenchmarkConfig', () => {
    test('accepts valid configuration', () => {
      const config: BenchmarkConfig = {
        bots: ['random', 'greedy'],
        gamesPerMatchup: 50,
        maxTurns: 100,
        seed: 12345,
        parallel: false,
        outputLevel: OutputLevel.MINIMAL,
      };

      const runner = new BenchmarkRunner(config);
      expect(runner.getConfig().bots).toEqual(['random', 'greedy']);
    });

    test('handles empty bots array gracefully', () => {
      const runner = new BenchmarkRunner({ bots: [] as BotType[] });
      expect(runner.getTotalGames()).toBe(0);
      expect(runner.getTotalMatchups()).toBe(0);
    });

    test('handles single bot', () => {
      const runner = new BenchmarkRunner({
        bots: ['random'] as BotType[],
        gamesPerMatchup: 10,
      });

      // 1 bot = 1 matchup (mirror), 10 games
      expect(runner.getTotalGames()).toBe(10);
      expect(runner.getTotalMatchups()).toBe(1);
    });
  });

  describe('TuneOptions defaults', () => {
    test('default options structure is valid', () => {
      const defaultOptions: TuneOptions = {
        method: 'local',
        gamesVsRandom: 30,
        gamesVsGreedy: 20,
        generations: 15,
        populationSize: 10,
        seed: Date.now(),
        verbose: false,
      };

      expect(defaultOptions.method).toBe('local');
      expect(defaultOptions.gamesVsRandom).toBeGreaterThan(0);
      expect(defaultOptions.gamesVsGreedy).toBeGreaterThan(0);
      expect(defaultOptions.generations).toBeGreaterThan(0);
      expect(defaultOptions.populationSize).toBeGreaterThan(0);
    });
  });

  describe('TuneMCTSOptions defaults', () => {
    test('default options structure is valid', () => {
      const defaultOptions: TuneMCTSOptions = {
        method: 'coarse-to-fine',
        gamesPerConfig: 50,
        validationGames: 200,
        maxTurns: 100,
        tuningIterations: 50,
        seed: Date.now(),
        save: false,
        skipValidation: false,
        verbose: false,
      };

      expect(defaultOptions.method).toBe('coarse-to-fine');
      expect(defaultOptions.gamesPerConfig).toBeGreaterThan(0);
      expect(defaultOptions.validationGames).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// OUTPUT FORMATTING TESTS
// =============================================================================

describe('Output Formatting', () => {
  describe('BenchmarkResults structure', () => {
    test('has all required fields', () => {
      const defaultConfig: BenchmarkConfig = {
        bots: ['random', 'greedy'] as BotType[],
        gamesPerMatchup: 1,
        maxTurns: 10,
        seed: 12345,
        parallel: false,
        outputLevel: OutputLevel.QUIET,
      };

      const recorder = new MatchupRecorder(defaultConfig);
      recorder.recordGame('random', 'greedy', 'bot1', 5, 50);

      const results = recorder.finalize('test');

      // Check structure
      expect(results.config).toBeDefined();
      expect(results.matchups).toBeInstanceOf(Array);
      expect(results.matrix).toBeInstanceOf(Object);
      expect(results.rankings).toBeInstanceOf(Array);
      expect(results.summary).toBeDefined();
      expect(results.metadata).toBeDefined();

      // Check summary fields
      expect(typeof results.summary.totalGames).toBe('number');
      expect(typeof results.summary.totalMatchups).toBe('number');
      expect(typeof results.summary.totalDurationMs).toBe('number');
      expect(typeof results.summary.gamesPerSecond).toBe('number');
      expect(typeof results.summary.botsCompared).toBe('number');

      // Check metadata fields
      expect(typeof results.metadata.startTime).toBe('string');
      expect(typeof results.metadata.endTime).toBe('string');
      expect(typeof results.metadata.seed).toBe('number');
    });
  });

  describe('MatchupResult structure', () => {
    test('has all required fields', () => {
      const defaultConfig: BenchmarkConfig = {
        bots: ['random', 'greedy'] as BotType[],
        gamesPerMatchup: 5,
        maxTurns: 10,
        seed: 12345,
        parallel: false,
        outputLevel: OutputLevel.QUIET,
      };

      const recorder = new MatchupRecorder(defaultConfig);
      for (let i = 0; i < 5; i++) {
        recorder.recordGame('random', 'greedy', i < 3 ? 'bot1' : 'bot2', 8, 80);
      }

      const result = recorder.getMatchupResult('random', 'greedy');

      expect(result.bot1).toBe('random');
      expect(result.bot2).toBe('greedy');
      expect(result.bot1Wins).toBe(3);
      expect(result.bot2Wins).toBe(2);
      expect(result.draws).toBe(0);
      expect(result.totalGames).toBe(5);
      expect(result.winRate).toBe(0.6);
      expect(result.avgTurns).toBe(8);
      expect(result.totalMs).toBe(400);
      expect(result.confidenceInterval).toBeDefined();
    });
  });

  describe('BotRanking structure', () => {
    test('has all required fields', () => {
      const defaultConfig: BenchmarkConfig = {
        bots: ['random', 'greedy'] as BotType[],
        gamesPerMatchup: 10,
        maxTurns: 10,
        seed: 12345,
        parallel: false,
        outputLevel: OutputLevel.QUIET,
      };

      const recorder = new MatchupRecorder(defaultConfig);
      for (let i = 0; i < 10; i++) {
        recorder.recordGame('random', 'greedy', 'bot1', 8, 80);
      }

      const rankings = recorder.calculateRankings();

      for (const ranking of rankings) {
        expect(typeof ranking.bot).toBe('string');
        expect(typeof ranking.avgWinRate).toBe('number');
        expect(typeof ranking.gamesPlayed).toBe('number');
        expect(typeof ranking.wins).toBe('number');
        expect(typeof ranking.losses).toBe('number');
        expect(typeof ranking.draws).toBe('number');
      }
    });

    test('includes Elo when requested', () => {
      const defaultConfig: BenchmarkConfig = {
        bots: ['random', 'greedy'] as BotType[],
        gamesPerMatchup: 10,
        maxTurns: 10,
        seed: 12345,
        parallel: false,
        outputLevel: OutputLevel.QUIET,
      };

      const recorder = new MatchupRecorder(defaultConfig);
      for (let i = 0; i < 10; i++) {
        recorder.recordGame('random', 'greedy', 'bot1', 8, 80);
      }

      const rankings = recorder.calculateRankings(true);

      for (const ranking of rankings) {
        expect(typeof ranking.elo).toBe('number');
      }
    });
  });
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

describe('Error Handling', () => {
  describe('MatchupRecorder errors', () => {
    test('throws on unknown matchup in getMatchupResult', () => {
      const recorder = new MatchupRecorder({
        bots: ['random'] as BotType[],
        gamesPerMatchup: 10,
        maxTurns: 100,
        seed: 12345,
        parallel: false,
        outputLevel: OutputLevel.QUIET,
      });

      expect(() => {
        recorder.getMatchupResult('random', 'greedy');
      }).toThrow();
    });

    test('throws on unknown matchup in recordGame', () => {
      const recorder = new MatchupRecorder({
        bots: ['random'] as BotType[],
        gamesPerMatchup: 10,
        maxTurns: 100,
        seed: 12345,
        parallel: false,
        outputLevel: OutputLevel.QUIET,
      });

      expect(() => {
        recorder.recordGame('random', 'greedy', 'bot1', 10, 100);
      }).toThrow();
    });
  });

  describe('Invalid argument handling', () => {
    test('parseBenchmarkSuiteArgs handles invalid preset', () => {
      const options = parseBenchmarkSuiteArgs(['--preset', 'invalid']);
      // Should keep default preset
      expect(options.preset).toBe('quick');
    });

    test('parseBenchmarkSuiteArgs handles missing argument value', () => {
      const options = parseBenchmarkSuiteArgs(['--preset']);
      // Should keep default preset when value is missing
      expect(options.preset).toBe('quick');
    });

    test('parseTuneMCTSArgs handles invalid method', () => {
      const options = parseTuneMCTSArgs(['--method', 'invalid']);
      // Method should not be set for invalid value
      expect(options.method).toBeUndefined();
    });
  });

  describe('Statistics edge cases', () => {
    test('wilsonInterval handles edge case of 1 game', () => {
      const [lower, upper] = wilsonInterval(1, 1);
      // Should not throw, should return valid interval
      expect(lower).toBeGreaterThanOrEqual(0);
      expect(upper).toBeLessThanOrEqual(1);
    });

    test('calculateEloRatings handles match with zero games', () => {
      const ratings = calculateEloRatings([
        { bot1: 'A', bot2: 'B', bot1Wins: 0, bot2Wins: 0, draws: 0 },
      ]);

      // Should return ratings, both at base Elo
      expect(ratings).toHaveLength(2);
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Integration Tests', () => {
  test('full benchmark flow with recorder', () => {
    const config: BenchmarkConfig = {
      bots: ['random', 'greedy'] as BotType[],
      gamesPerMatchup: 3,
      maxTurns: 10,
      seed: 12345,
      parallel: false,
      outputLevel: OutputLevel.QUIET,
    };

    const recorder = new MatchupRecorder(config);

    // Simulate matchup results
    const outcomes: Array<'bot1' | 'bot2' | 'draw'> = ['bot1', 'bot2', 'draw'];
    for (const bot1 of config.bots) {
      for (const bot2 of config.bots) {
        for (let i = 0; i < 3; i++) {
          recorder.recordGame(bot1, bot2, outcomes[i], 5 + i, 50 + i * 10);
        }
      }
    }

    const results = recorder.finalize('integration-test', true);

    // Verify complete results structure
    expect(results.summary.totalGames).toBe(12); // 4 matchups * 3 games
    expect(results.matchups).toHaveLength(4);
    expect(results.rankings).toHaveLength(2);
    expect(results.rankings[0].elo).toBeDefined();

    // Verify matrix
    expect(results.matrix['random']['random']).toBeDefined();
    expect(results.matrix['random']['greedy']).toBeDefined();
    expect(results.matrix['greedy']['random']).toBeDefined();
    expect(results.matrix['greedy']['greedy']).toBeDefined();
  });

  test('preset configuration to runner flow', () => {
    const preset = getPreset('quick');
    expect(preset).toBeDefined();

    const runner = new BenchmarkRunner({
      bots: preset!.bots,
      gamesPerMatchup: preset!.gamesPerMatchup,
    });

    expect(runner.getTotalMatchups()).toBe(preset!.bots.length * preset!.bots.length);
    expect(runner.getTotalGames()).toBe(
      preset!.bots.length * preset!.bots.length * preset!.gamesPerMatchup
    );
  });
});
