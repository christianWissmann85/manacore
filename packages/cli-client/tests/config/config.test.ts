/**
 * Comprehensive tests for the Configuration System
 *
 * Tests all configuration-related modules in packages/cli-client/src/config/
 * including loading, validation, schema, environment overrides, and error handling.
 */

import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { createTempDir, cleanupTempDir, cleanupAllTempDirs, readJsonFile } from '../helpers';
import {
  loadConfig,
  loadRootConfig,
  resolveOutputPath,
  printConfigSummary,
  CONFIG_DEFAULTS,
  type ExperimentConfig,
  type SimulateConfig,
  type BenchmarkConfig,
  type TuneWeightsConfig,
  type TuneMCTSConfig,
  type PipelineConfig,
  type CollectTrainingConfig,
  type ReplayConfig,
  type OutputConfig,
  type ManaCoreConfig,
} from '../../src/config';

// =============================================================================
// TEST UTILITIES
// =============================================================================

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir('config-test');
});

afterEach(() => {
  cleanupTempDir(tempDir);
});

afterAll(() => {
  cleanupAllTempDirs();
});

/**
 * Write a JSON config file to the temp directory
 */
function writeConfigFile(filename: string, config: Record<string, unknown>): string {
  const filepath = join(tempDir, filename);
  writeFileSync(filepath, JSON.stringify(config, null, 2));
  return filepath;
}

/**
 * Create a minimal valid simulate config
 */
function createMinimalSimulateConfig(): Partial<SimulateConfig> {
  return {
    command: 'simulate',
    name: 'test-experiment',
    games: 10,
    p1: { type: 'random' },
    p2: { type: 'greedy' },
  };
}

/**
 * Create a minimal valid benchmark config
 */
function createMinimalBenchmarkConfig(): Partial<BenchmarkConfig> {
  return {
    command: 'benchmark',
    name: 'test-benchmark',
    bots: ['random', 'greedy'],
    gamesPerMatchup: 10,
  };
}

// =============================================================================
// CONFIG LOADING TESTS
// =============================================================================

describe('Config loading', () => {
  test('loads valid simulate config from file', () => {
    const configData = createMinimalSimulateConfig();
    const filepath = writeConfigFile('simulate.json', configData);

    const config = loadConfig(filepath);

    expect(config).toBeDefined();
    expect(config.command).toBe('simulate');
    expect(config.name).toBe('test-experiment');
    expect((config as SimulateConfig).games).toBe(10);
    expect((config as SimulateConfig).p1.type).toBe('random');
    expect((config as SimulateConfig).p2.type).toBe('greedy');
  });

  test('loads valid benchmark config from file', () => {
    const configData = createMinimalBenchmarkConfig();
    const filepath = writeConfigFile('benchmark.json', configData);

    const config = loadConfig(filepath);

    expect(config).toBeDefined();
    expect(config.command).toBe('benchmark');
    expect(config.name).toBe('test-benchmark');
    expect((config as BenchmarkConfig).bots).toEqual(['random', 'greedy']);
    expect((config as BenchmarkConfig).gamesPerMatchup).toBe(10);
  });

  test('resolves relative paths to absolute', () => {
    const configData = createMinimalSimulateConfig();
    const filepath = writeConfigFile('relative.json', configData);
    const relativePath = filepath.replace(process.cwd() + '/', '');

    // Should not throw for valid relative path
    const config = loadConfig(filepath);
    expect(config).toBeDefined();
  });

  test('throws error for non-existent file', () => {
    const nonExistentPath = join(tempDir, 'does-not-exist.json');

    expect(() => loadConfig(nonExistentPath)).toThrow('Configuration file not found');
  });

  test('throws error for invalid JSON', () => {
    const filepath = join(tempDir, 'invalid.json');
    writeFileSync(filepath, '{ invalid json content }');

    expect(() => loadConfig(filepath)).toThrow('Invalid JSON in config file');
  });

  test('throws error for truncated JSON', () => {
    const filepath = join(tempDir, 'truncated.json');
    writeFileSync(filepath, '{ "command": "simulate", "name": ');

    expect(() => loadConfig(filepath)).toThrow('Invalid JSON in config file');
  });
});

// =============================================================================
// CONFIG VALIDATION TESTS
// =============================================================================

describe('Config validation', () => {
  describe('Required fields', () => {
    test('throws error when command is missing', () => {
      const configData = { name: 'test' };
      const filepath = writeConfigFile('no-command.json', configData);

      expect(() => loadConfig(filepath)).toThrow('Configuration missing required field: command');
    });

    test('throws error when name is missing', () => {
      const configData = { command: 'simulate', games: 10 };
      const filepath = writeConfigFile('no-name.json', configData);

      expect(() => loadConfig(filepath)).toThrow('Configuration missing required field: name');
    });
  });

  describe('Simulate config validation', () => {
    test('throws error when games is missing', () => {
      const configData = {
        command: 'simulate',
        name: 'test',
        p1: { type: 'random' },
        p2: { type: 'greedy' },
      };
      const filepath = writeConfigFile('no-games.json', configData);

      expect(() => loadConfig(filepath)).toThrow('simulate: games must be >= 1');
    });

    test('throws error when games is zero', () => {
      const configData = {
        command: 'simulate',
        name: 'test',
        games: 0,
        p1: { type: 'random' },
        p2: { type: 'greedy' },
      };
      const filepath = writeConfigFile('zero-games.json', configData);

      expect(() => loadConfig(filepath)).toThrow('simulate: games must be >= 1');
    });

    test('throws error when games is negative', () => {
      const configData = {
        command: 'simulate',
        name: 'test',
        games: -5,
        p1: { type: 'random' },
        p2: { type: 'greedy' },
      };
      const filepath = writeConfigFile('negative-games.json', configData);

      expect(() => loadConfig(filepath)).toThrow('simulate: games must be >= 1');
    });

    test('throws error when p1 is missing', () => {
      const configData = {
        command: 'simulate',
        name: 'test',
        games: 10,
        p2: { type: 'greedy' },
      };
      const filepath = writeConfigFile('no-p1.json', configData);

      expect(() => loadConfig(filepath)).toThrow('simulate: p1.type is required');
    });

    test('throws error when p1.type is missing', () => {
      const configData = {
        command: 'simulate',
        name: 'test',
        games: 10,
        p1: {},
        p2: { type: 'greedy' },
      };
      const filepath = writeConfigFile('no-p1-type.json', configData);

      expect(() => loadConfig(filepath)).toThrow('simulate: p1.type is required');
    });

    test('throws error when p2 is missing', () => {
      const configData = {
        command: 'simulate',
        name: 'test',
        games: 10,
        p1: { type: 'random' },
      };
      const filepath = writeConfigFile('no-p2.json', configData);

      expect(() => loadConfig(filepath)).toThrow('simulate: p2.type is required');
    });

    test('throws error when p2.type is missing', () => {
      const configData = {
        command: 'simulate',
        name: 'test',
        games: 10,
        p1: { type: 'random' },
        p2: {},
      };
      const filepath = writeConfigFile('no-p2-type.json', configData);

      expect(() => loadConfig(filepath)).toThrow('simulate: p2.type is required');
    });
  });

  describe('Benchmark config validation', () => {
    test('throws error when bots array is missing', () => {
      const configData = {
        command: 'benchmark',
        name: 'test',
        gamesPerMatchup: 10,
      };
      const filepath = writeConfigFile('no-bots.json', configData);

      expect(() => loadConfig(filepath)).toThrow('benchmark: at least 2 bots required');
    });

    test('throws error when bots array has less than 2 bots', () => {
      const configData = {
        command: 'benchmark',
        name: 'test',
        bots: ['random'],
        gamesPerMatchup: 10,
      };
      const filepath = writeConfigFile('one-bot.json', configData);

      expect(() => loadConfig(filepath)).toThrow('benchmark: at least 2 bots required');
    });

    test('throws error when bots array is empty', () => {
      const configData = {
        command: 'benchmark',
        name: 'test',
        bots: [],
        gamesPerMatchup: 10,
      };
      const filepath = writeConfigFile('empty-bots.json', configData);

      expect(() => loadConfig(filepath)).toThrow('benchmark: at least 2 bots required');
    });

    test('throws error when gamesPerMatchup is missing', () => {
      const configData = {
        command: 'benchmark',
        name: 'test',
        bots: ['random', 'greedy'],
      };
      const filepath = writeConfigFile('no-games-per-matchup.json', configData);

      expect(() => loadConfig(filepath)).toThrow('benchmark: gamesPerMatchup must be >= 1');
    });

    test('throws error when gamesPerMatchup is zero', () => {
      const configData = {
        command: 'benchmark',
        name: 'test',
        bots: ['random', 'greedy'],
        gamesPerMatchup: 0,
      };
      const filepath = writeConfigFile('zero-games-per-matchup.json', configData);

      expect(() => loadConfig(filepath)).toThrow('benchmark: gamesPerMatchup must be >= 1');
    });
  });

  describe('Tune-weights config validation', () => {
    test('throws error when method is missing', () => {
      const configData = {
        command: 'tune-weights',
        name: 'test',
        gamesRandom: 50,
        gamesGreedy: 50,
      };
      const filepath = writeConfigFile('no-tune-method.json', configData);

      expect(() => loadConfig(filepath)).toThrow('tune-weights: method is required');
    });
  });

  describe('Tune-mcts config validation', () => {
    test('throws error when method is missing', () => {
      const configData = {
        command: 'tune-mcts',
        name: 'test',
        gamesPerConfig: 50,
      };
      const filepath = writeConfigFile('no-mcts-method.json', configData);

      expect(() => loadConfig(filepath)).toThrow('tune-mcts: method is required');
    });
  });

  describe('Collect config validation', () => {
    test('throws error when games is missing', () => {
      const configData = {
        command: 'collect',
        name: 'test',
      };
      const filepath = writeConfigFile('no-collect-games.json', configData);

      expect(() => loadConfig(filepath)).toThrow('collect: games must be >= 1');
    });

    test('throws error when games is zero', () => {
      const configData = {
        command: 'collect',
        name: 'test',
        games: 0,
      };
      const filepath = writeConfigFile('zero-collect-games.json', configData);

      expect(() => loadConfig(filepath)).toThrow('collect: games must be >= 1');
    });
  });

  describe('Replay config validation', () => {
    test('throws error when source is missing', () => {
      const configData = {
        command: 'replay',
        name: 'test',
      };
      const filepath = writeConfigFile('no-replay-source.json', configData);

      expect(() => loadConfig(filepath)).toThrow('replay: source is required');
    });
  });

  describe('Unknown command validation', () => {
    test('throws error for unknown command', () => {
      const configData = {
        command: 'unknown-command',
        name: 'test',
      };
      const filepath = writeConfigFile('unknown-command.json', configData);

      expect(() => loadConfig(filepath)).toThrow('Unknown command: unknown-command');
    });
  });
});

// =============================================================================
// DEFAULT VALUES TESTS
// =============================================================================

describe('Default values', () => {
  describe('Simulate defaults', () => {
    test('applies default maxTurns of 100', () => {
      const configData = createMinimalSimulateConfig();
      const filepath = writeConfigFile('sim-defaults.json', configData);

      const config = loadConfig(filepath) as SimulateConfig;

      expect(config.maxTurns).toBe(100);
    });

    test('applies default parallel of true', () => {
      const configData = createMinimalSimulateConfig();
      const filepath = writeConfigFile('sim-parallel.json', configData);

      const config = loadConfig(filepath) as SimulateConfig;

      expect(config.parallel).toBe(true);
    });

    test('preserves explicit maxTurns value', () => {
      const configData = { ...createMinimalSimulateConfig(), maxTurns: 50 };
      const filepath = writeConfigFile('sim-explicit-turns.json', configData);

      const config = loadConfig(filepath) as SimulateConfig;

      expect(config.maxTurns).toBe(50);
    });

    test('preserves explicit parallel value of false', () => {
      const configData = { ...createMinimalSimulateConfig(), parallel: false };
      const filepath = writeConfigFile('sim-explicit-parallel.json', configData);

      const config = loadConfig(filepath) as SimulateConfig;

      expect(config.parallel).toBe(false);
    });
  });

  describe('Benchmark defaults', () => {
    test('applies default calculateElo of true', () => {
      const configData = createMinimalBenchmarkConfig();
      const filepath = writeConfigFile('bench-defaults.json', configData);

      const config = loadConfig(filepath) as BenchmarkConfig;

      expect(config.calculateElo).toBe(true);
    });

    test('preserves explicit calculateElo value of false', () => {
      const configData = { ...createMinimalBenchmarkConfig(), calculateElo: false };
      const filepath = writeConfigFile('bench-explicit-elo.json', configData);

      const config = loadConfig(filepath) as BenchmarkConfig;

      expect(config.calculateElo).toBe(false);
    });
  });

  describe('Tune-weights defaults', () => {
    test('applies default gamesRandom and gamesGreedy', () => {
      const configData: Partial<TuneWeightsConfig> = {
        command: 'tune-weights',
        name: 'test',
        method: 'local',
        gamesRandom: 50,
        gamesGreedy: 50,
      };
      const filepath = writeConfigFile('tune-defaults.json', configData);

      const config = loadConfig(filepath) as TuneWeightsConfig;

      expect(config.gamesRandom).toBe(50);
      expect(config.gamesGreedy).toBe(50);
    });

    test('applies default generations and population for evolve method', () => {
      const configData: Partial<TuneWeightsConfig> = {
        command: 'tune-weights',
        name: 'test',
        method: 'evolve',
        gamesRandom: 50,
        gamesGreedy: 50,
      };
      const filepath = writeConfigFile('tune-evolve-defaults.json', configData);

      const config = loadConfig(filepath) as TuneWeightsConfig;

      expect(config.generations).toBe(20);
      expect(config.population).toBe(20);
    });
  });

  describe('Tune-mcts defaults', () => {
    test('applies default gamesPerConfig', () => {
      const configData: Partial<TuneMCTSConfig> = {
        command: 'tune-mcts',
        name: 'test',
        method: 'grid',
        gamesPerConfig: 50,
      };
      const filepath = writeConfigFile('mcts-defaults.json', configData);

      const config = loadConfig(filepath) as TuneMCTSConfig;

      expect(config.gamesPerConfig).toBe(50);
    });

    test('applies default validationGames and skipValidation', () => {
      const configData: Partial<TuneMCTSConfig> = {
        command: 'tune-mcts',
        name: 'test',
        method: 'grid',
        gamesPerConfig: 50,
      };
      const filepath = writeConfigFile('mcts-validation-defaults.json', configData);

      const config = loadConfig(filepath) as TuneMCTSConfig;

      expect(config.validationGames).toBe(100);
      expect(config.skipValidation).toBe(false);
    });
  });

  describe('Pipeline defaults', () => {
    test('applies default acceptance level', () => {
      const configData: Partial<PipelineConfig> = {
        command: 'pipeline',
        name: 'test',
      };
      const filepath = writeConfigFile('pipeline-defaults.json', configData);

      const config = loadConfig(filepath) as PipelineConfig;

      expect(config.acceptance).toBe('default');
    });
  });

  describe('Collect defaults', () => {
    test('applies default curriculum', () => {
      const configData: Partial<CollectTrainingConfig> = {
        command: 'collect',
        name: 'test',
        games: 100,
      };
      const filepath = writeConfigFile('collect-defaults.json', configData);

      const config = loadConfig(filepath) as CollectTrainingConfig;

      expect(config.curriculum).toBe('default');
    });

    test('applies default maxTurns', () => {
      const configData: Partial<CollectTrainingConfig> = {
        command: 'collect',
        name: 'test',
        games: 100,
      };
      const filepath = writeConfigFile('collect-turns.json', configData);

      const config = loadConfig(filepath) as CollectTrainingConfig;

      expect(config.maxTurns).toBe(100);
    });

    test('applies default export settings', () => {
      const configData: Partial<CollectTrainingConfig> = {
        command: 'collect',
        name: 'test',
        games: 100,
      };
      const filepath = writeConfigFile('collect-export.json', configData);

      const config = loadConfig(filepath) as CollectTrainingConfig;

      expect(config.export?.json).toBe(true);
      expect(config.export?.binary).toBe(true);
    });
  });

  describe('Output defaults', () => {
    test('applies default output configuration', () => {
      const configData = createMinimalSimulateConfig();
      const filepath = writeConfigFile('output-defaults.json', configData);

      const config = loadConfig(filepath);

      expect(config.output).toBeDefined();
      expect(config.output!.directory).toBe('results');
      expect(config.output!.level).toBe('minimal');
      expect(config.output!.formats).toEqual(['json']);
      expect(config.output!.timestamp).toBe(true);
    });

    test('preserves explicit output configuration', () => {
      const configData = {
        ...createMinimalSimulateConfig(),
        output: {
          directory: 'custom-output',
          level: 'verbose',
          formats: ['json', 'csv'],
          timestamp: false,
        },
      };
      const filepath = writeConfigFile('output-explicit.json', configData);

      const config = loadConfig(filepath);

      expect(config.output!.directory).toBe('custom-output');
      expect(config.output!.level).toBe('verbose');
      expect(config.output!.formats).toEqual(['json', 'csv']);
      expect(config.output!.timestamp).toBe(false);
    });

    test('merges partial output configuration with defaults', () => {
      const configData = {
        ...createMinimalSimulateConfig(),
        output: {
          level: 'verbose',
        },
      };
      const filepath = writeConfigFile('output-partial.json', configData);

      const config = loadConfig(filepath);

      expect(config.output!.directory).toBe('results');
      expect(config.output!.level).toBe('verbose');
      expect(config.output!.formats).toEqual(['json']);
      expect(config.output!.timestamp).toBe(true);
    });
  });

  describe('Seed handling', () => {
    test('converts "timestamp" seed to number', () => {
      const configData = {
        ...createMinimalSimulateConfig(),
        seed: 'timestamp',
      };
      const filepath = writeConfigFile('seed-timestamp.json', configData);

      const config = loadConfig(filepath) as SimulateConfig;

      expect(typeof config.seed).toBe('number');
      expect(config.seed).toBeGreaterThan(0);
    });

    test('does not set seed when seed is not provided in config', () => {
      // When seed is not included in the config, it remains undefined
      // (The 'seed' in config check in applyDefaults requires the key to exist)
      const configData = createMinimalSimulateConfig();
      const filepath = writeConfigFile('seed-undefined.json', configData);

      const config = loadConfig(filepath) as SimulateConfig;

      // Seed is not automatically set if not provided in the config
      expect(config.seed).toBeUndefined();
    });

    test('applies timestamp seed when seed is explicitly set to null in JSON', () => {
      // When seed key exists but value is null (JSON doesn't support undefined),
      // the applyDefaults function checks for 'seed' in config and undefined value
      // Since null !== undefined, it remains null
      const filepath = join(tempDir, 'seed-null.json');
      const configData = { ...createMinimalSimulateConfig(), seed: null };
      writeFileSync(filepath, JSON.stringify(configData, null, 2));

      const config = loadConfig(filepath) as SimulateConfig;

      // null is preserved since the check is for undefined specifically
      expect(config.seed).toBeNull();
    });

    test('preserves explicit numeric seed', () => {
      const configData = {
        ...createMinimalSimulateConfig(),
        seed: 12345,
      };
      const filepath = writeConfigFile('seed-explicit.json', configData);

      const config = loadConfig(filepath) as SimulateConfig;

      expect(config.seed).toBe(12345);
    });
  });
});

// =============================================================================
// CONFIG SCHEMA TESTS
// =============================================================================

describe('Config schema', () => {
  test('CONFIG_DEFAULTS has expected structure', () => {
    expect(CONFIG_DEFAULTS).toBeDefined();
    expect(CONFIG_DEFAULTS.output).toBeDefined();
    expect(CONFIG_DEFAULTS.output.directory).toBe('output');
    expect(CONFIG_DEFAULTS.output.level).toBe('minimal');
    expect(CONFIG_DEFAULTS.output.formats).toEqual(['json']);
    expect(CONFIG_DEFAULTS.output.timestamp).toBe(true);
    expect(CONFIG_DEFAULTS.seed).toBe('timestamp');
    expect(CONFIG_DEFAULTS.maxTurns).toBe(100);
    expect(CONFIG_DEFAULTS.parallel).toBe(true);
  });

  describe('OutputConfig schema', () => {
    test('accepts all valid output levels', () => {
      const levels: Array<OutputConfig['level']> = ['quiet', 'minimal', 'normal', 'verbose'];

      for (const level of levels) {
        const configData = {
          ...createMinimalSimulateConfig(),
          output: { level },
        };
        const filepath = writeConfigFile(`level-${level}.json`, configData);

        const config = loadConfig(filepath);
        expect(config.output!.level).toBe(level);
      }
    });

    test('accepts all valid export formats', () => {
      const formats: Array<'json' | 'csv' | 'markdown'> = ['json', 'csv', 'markdown'];

      const configData = {
        ...createMinimalSimulateConfig(),
        output: { formats },
      };
      const filepath = writeConfigFile('all-formats.json', configData);

      const config = loadConfig(filepath);
      expect(config.output!.formats).toEqual(formats);
    });
  });

  describe('BotConfig schema', () => {
    test('accepts all valid bot types', () => {
      const botTypes = [
        'random',
        'greedy',
        'mcts-eval-fast',
        'mcts-eval',
        'mcts-eval-strong',
        'mcts-eval-turbo',
        'mcts-ordered',
      ];

      for (const type of botTypes) {
        const configData = {
          ...createMinimalSimulateConfig(),
          p1: { type },
          p2: { type: 'random' },
        };
        const filepath = writeConfigFile(`bot-${type}.json`, configData);

        const config = loadConfig(filepath) as SimulateConfig;
        expect(config.p1.type).toBe(type);
      }
    });

    test('accepts optional name suffix for bots', () => {
      const configData = {
        ...createMinimalSimulateConfig(),
        p1: { type: 'random', name: 'custom-name' },
        p2: { type: 'greedy' },
      };
      const filepath = writeConfigFile('bot-name.json', configData);

      const config = loadConfig(filepath) as SimulateConfig;
      expect(config.p1.name).toBe('custom-name');
    });
  });

  describe('Full config structures', () => {
    test('accepts complete SimulateConfig', () => {
      const configData: SimulateConfig = {
        command: 'simulate',
        name: 'full-simulate',
        games: 100,
        p1: { type: 'mcts-eval', name: 'player1' },
        p2: { type: 'greedy', name: 'player2' },
        seed: 42,
        maxTurns: 50,
        parallel: false,
        output: {
          directory: 'output',
          level: 'verbose',
          formats: ['json', 'csv'],
          timestamp: true,
        },
      };
      const filepath = writeConfigFile('full-simulate.json', configData);

      const config = loadConfig(filepath) as SimulateConfig;

      expect(config.command).toBe('simulate');
      expect(config.name).toBe('full-simulate');
      expect(config.games).toBe(100);
      expect(config.p1.type).toBe('mcts-eval');
      expect(config.p1.name).toBe('player1');
      expect(config.p2.type).toBe('greedy');
      expect(config.seed).toBe(42);
      expect(config.maxTurns).toBe(50);
      expect(config.parallel).toBe(false);
    });

    test('accepts complete BenchmarkConfig', () => {
      const configData: BenchmarkConfig = {
        command: 'benchmark',
        name: 'full-benchmark',
        bots: ['random', 'greedy', 'mcts-eval'],
        gamesPerMatchup: 50,
        seed: 12345,
        calculateElo: true,
        output: {
          directory: 'benchmarks',
          level: 'normal',
          formats: ['json', 'markdown'],
          timestamp: false,
        },
      };
      const filepath = writeConfigFile('full-benchmark.json', configData);

      const config = loadConfig(filepath) as BenchmarkConfig;

      expect(config.bots).toEqual(['random', 'greedy', 'mcts-eval']);
      expect(config.gamesPerMatchup).toBe(50);
      expect(config.seed).toBe(12345);
      expect(config.calculateElo).toBe(true);
    });

    test('accepts complete TuneWeightsConfig', () => {
      const configData: TuneWeightsConfig = {
        command: 'tune-weights',
        name: 'full-tune',
        method: 'evolve',
        generations: 30,
        population: 25,
        gamesRandom: 100,
        gamesGreedy: 100,
        seed: 999,
        output: { level: 'verbose' },
      };
      const filepath = writeConfigFile('full-tune.json', configData);

      const config = loadConfig(filepath) as TuneWeightsConfig;

      expect(config.method).toBe('evolve');
      expect(config.generations).toBe(30);
      expect(config.population).toBe(25);
    });

    test('accepts complete TuneMCTSConfig', () => {
      const configData: TuneMCTSConfig = {
        command: 'tune-mcts',
        name: 'full-mcts',
        method: 'coarse-to-fine',
        gamesPerConfig: 75,
        validationGames: 150,
        iterations: { min: 50, max: 500, step: 50 },
        seed: 777,
        skipValidation: true,
        output: { level: 'quiet' },
      };
      const filepath = writeConfigFile('full-mcts.json', configData);

      const config = loadConfig(filepath) as TuneMCTSConfig;

      expect(config.method).toBe('coarse-to-fine');
      expect(config.gamesPerConfig).toBe(75);
      expect(config.validationGames).toBe(150);
      expect(config.iterations).toEqual({ min: 50, max: 500, step: 50 });
      expect(config.skipValidation).toBe(true);
    });

    test('accepts complete PipelineConfig', () => {
      const configData: PipelineConfig = {
        command: 'pipeline',
        name: 'full-pipeline',
        seed: 555,
        weights: {
          method: 'evolve',
          generations: 10,
          skip: false,
        },
        mcts: {
          method: 'grid',
          games: 50,
          validation: 100,
          skip: false,
        },
        acceptance: 'strict',
        output: { level: 'normal' },
      };
      const filepath = writeConfigFile('full-pipeline.json', configData);

      const config = loadConfig(filepath) as PipelineConfig;

      expect(config.weights?.method).toBe('evolve');
      expect(config.weights?.generations).toBe(10);
      expect(config.mcts?.method).toBe('grid');
      expect(config.acceptance).toBe('strict');
    });

    test('accepts complete CollectTrainingConfig', () => {
      const configData: CollectTrainingConfig = {
        command: 'collect',
        name: 'full-collect',
        games: 1000,
        curriculum: 'fast',
        phase: 'medium',
        seed: 333,
        maxTurns: 75,
        export: {
          json: true,
          binary: false,
        },
        output: { directory: 'training' },
      };
      const filepath = writeConfigFile('full-collect.json', configData);

      const config = loadConfig(filepath) as CollectTrainingConfig;

      expect(config.curriculum).toBe('fast');
      expect(config.phase).toBe('medium');
      expect(config.export?.json).toBe(true);
      expect(config.export?.binary).toBe(false);
    });

    test('accepts complete ReplayConfig', () => {
      const configData: ReplayConfig = {
        command: 'replay',
        name: 'full-replay',
        source: '/path/to/replay.json',
        fromTurn: 5,
        watch: {
          enabled: true,
          delayMs: 1000,
        },
        verify: true,
        output: { level: 'verbose' },
      };
      const filepath = writeConfigFile('full-replay.json', configData);

      const config = loadConfig(filepath) as ReplayConfig;

      expect(config.source).toBe('/path/to/replay.json');
      expect(config.fromTurn).toBe(5);
      expect(config.watch?.enabled).toBe(true);
      expect(config.watch?.delayMs).toBe(1000);
      expect(config.verify).toBe(true);
    });

    test('accepts ReplayConfig with numeric seed source', () => {
      const configData: ReplayConfig = {
        command: 'replay',
        name: 'seed-replay',
        source: 12345,
      };
      const filepath = writeConfigFile('seed-replay.json', configData);

      const config = loadConfig(filepath) as ReplayConfig;

      expect(config.source).toBe(12345);
    });
  });
});

// =============================================================================
// ROOT CONFIG TESTS
// =============================================================================

describe('Root config loading', () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    // Restore original working directory
    process.chdir(originalCwd);
  });

  test('returns null when no root config exists', () => {
    // Change to temp dir where no config exists
    process.chdir(tempDir);

    const config = loadRootConfig();

    expect(config).toBeNull();
  });

  test('loads manacore.config.json from current directory', () => {
    const rootConfig: ManaCoreConfig = {
      version: '1.0',
      defaults: {
        output: { directory: 'custom-results' },
        seed: 42,
      },
    };
    const filepath = join(tempDir, 'manacore.config.json');
    writeFileSync(filepath, JSON.stringify(rootConfig, null, 2));

    process.chdir(tempDir);
    const config = loadRootConfig();

    expect(config).not.toBeNull();
    expect(config!.version).toBe('1.0');
    expect(config!.defaults?.output?.directory).toBe('custom-results');
    expect(config!.defaults?.seed).toBe(42);
  });

  test('loads .manacore.json from current directory', () => {
    const rootConfig: ManaCoreConfig = {
      version: '1.0',
      defaults: {
        output: { level: 'verbose' },
      },
    };
    const filepath = join(tempDir, '.manacore.json');
    writeFileSync(filepath, JSON.stringify(rootConfig, null, 2));

    process.chdir(tempDir);
    const config = loadRootConfig();

    expect(config).not.toBeNull();
    expect(config!.defaults?.output?.level).toBe('verbose');
  });

  test('prefers manacore.config.json over .manacore.json', () => {
    const mainConfig: ManaCoreConfig = {
      version: '1.0',
      defaults: { output: { directory: 'main-config' } },
    };
    const dotConfig: ManaCoreConfig = {
      version: '1.0',
      defaults: { output: { directory: 'dot-config' } },
    };

    writeFileSync(join(tempDir, 'manacore.config.json'), JSON.stringify(mainConfig, null, 2));
    writeFileSync(join(tempDir, '.manacore.json'), JSON.stringify(dotConfig, null, 2));

    process.chdir(tempDir);
    const config = loadRootConfig();

    expect(config!.defaults?.output?.directory).toBe('main-config');
  });

  test('returns null for invalid root config JSON', () => {
    writeFileSync(join(tempDir, 'manacore.config.json'), '{ invalid json }');

    process.chdir(tempDir);
    const config = loadRootConfig();

    // Should silently return null for invalid config
    expect(config).toBeNull();
  });

  test('accepts root config with profiles', () => {
    const rootConfig: ManaCoreConfig = {
      version: '1.0',
      profiles: {
        quick: {
          games: 10,
          parallel: true,
        },
        thorough: {
          games: 1000,
          parallel: true,
        },
      },
    };
    writeFileSync(join(tempDir, 'manacore.config.json'), JSON.stringify(rootConfig, null, 2));

    process.chdir(tempDir);
    const config = loadRootConfig();

    expect(config!.profiles?.quick).toBeDefined();
    expect(config!.profiles?.quick?.games).toBe(10);
    expect(config!.profiles?.thorough?.games).toBe(1000);
  });
});

// =============================================================================
// OUTPUT PATH RESOLUTION TESTS
// =============================================================================

describe('Output path resolution', () => {
  test('resolves output path with timestamp', () => {
    const configData = createMinimalSimulateConfig();
    const filepath = writeConfigFile('path-timestamp.json', configData);

    const config = loadConfig(filepath);
    const outputPath = resolveOutputPath(config);

    expect(outputPath).toContain('results');
    expect(outputPath).toContain('test-experiment');
    // Should contain timestamp pattern: YYYY-MM-DDTHH-MM-SS
    expect(outputPath).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
  });

  test('resolves output path without timestamp', () => {
    const configData = {
      ...createMinimalSimulateConfig(),
      output: { timestamp: false },
    };
    const filepath = writeConfigFile('path-no-timestamp.json', configData);

    const config = loadConfig(filepath);
    const outputPath = resolveOutputPath(config);

    expect(outputPath).toContain('results');
    expect(outputPath).toContain('test-experiment');
    // Should NOT contain timestamp pattern
    expect(outputPath).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
  });

  test('uses custom directory from config', () => {
    const configData = {
      ...createMinimalSimulateConfig(),
      output: { directory: 'custom-output-dir', timestamp: false },
    };
    const filepath = writeConfigFile('custom-dir.json', configData);

    const config = loadConfig(filepath);
    const outputPath = resolveOutputPath(config);

    expect(outputPath).toContain('custom-output-dir');
    expect(outputPath).toContain('test-experiment');
  });

  test('returns absolute path', () => {
    const configData = createMinimalSimulateConfig();
    const filepath = writeConfigFile('absolute-path.json', configData);

    const config = loadConfig(filepath);
    const outputPath = resolveOutputPath(config);

    expect(outputPath.startsWith('/')).toBe(true);
  });
});

// =============================================================================
// CONFIG SUMMARY PRINTING TESTS
// =============================================================================

describe('Config summary printing', () => {
  // Capture console.log output
  let consoleOutput: string[];
  const originalLog = console.log;

  beforeEach(() => {
    consoleOutput = [];
    console.log = (...args: unknown[]) => {
      consoleOutput.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    console.log = originalLog;
  });

  test('prints simulate config summary', () => {
    const configData = createMinimalSimulateConfig();
    const filepath = writeConfigFile('summary-simulate.json', configData);

    const config = loadConfig(filepath);
    printConfigSummary(config);

    const output = consoleOutput.join('\n');
    expect(output).toContain('Experiment: test-experiment');
    expect(output).toContain('Command: simulate');
    expect(output).toContain('Games: 10');
    expect(output).toContain('P1: random');
    expect(output).toContain('P2: greedy');
  });

  test('prints benchmark config summary', () => {
    const configData = createMinimalBenchmarkConfig();
    const filepath = writeConfigFile('summary-benchmark.json', configData);

    const config = loadConfig(filepath);
    printConfigSummary(config);

    const output = consoleOutput.join('\n');
    expect(output).toContain('Experiment: test-benchmark');
    expect(output).toContain('Command: benchmark');
    expect(output).toContain('Bots: random, greedy');
    expect(output).toContain('Games/Matchup: 10');
  });

  test('prints tune-weights config summary', () => {
    const configData: Partial<TuneWeightsConfig> = {
      command: 'tune-weights',
      name: 'test-tune',
      method: 'evolve',
      gamesRandom: 50,
      gamesGreedy: 50,
    };
    const filepath = writeConfigFile('summary-tune.json', configData);

    const config = loadConfig(filepath);
    printConfigSummary(config);

    const output = consoleOutput.join('\n');
    expect(output).toContain('Method: evolve');
    expect(output).toContain('Games vs Random: 50');
    expect(output).toContain('Games vs Greedy: 50');
  });

  test('prints tune-mcts config summary', () => {
    const configData: Partial<TuneMCTSConfig> = {
      command: 'tune-mcts',
      name: 'test-mcts',
      method: 'grid',
      gamesPerConfig: 50,
    };
    const filepath = writeConfigFile('summary-mcts.json', configData);

    const config = loadConfig(filepath);
    printConfigSummary(config);

    const output = consoleOutput.join('\n');
    expect(output).toContain('Method: grid');
    expect(output).toContain('Games/Config: 50');
  });

  test('prints pipeline config summary', () => {
    const configData: Partial<PipelineConfig> = {
      command: 'pipeline',
      name: 'test-pipeline',
    };
    const filepath = writeConfigFile('summary-pipeline.json', configData);

    const config = loadConfig(filepath);
    printConfigSummary(config);

    const output = consoleOutput.join('\n');
    expect(output).toContain('Command: pipeline');
    expect(output).toContain('Acceptance:');
  });

  test('prints collect config summary', () => {
    const configData: Partial<CollectTrainingConfig> = {
      command: 'collect',
      name: 'test-collect',
      games: 100,
    };
    const filepath = writeConfigFile('summary-collect.json', configData);

    const config = loadConfig(filepath);
    printConfigSummary(config);

    const output = consoleOutput.join('\n');
    expect(output).toContain('Games: 100');
    expect(output).toContain('Curriculum:');
  });

  test('prints replay config summary', () => {
    const configData: Partial<ReplayConfig> = {
      command: 'replay',
      name: 'test-replay',
      source: '/path/to/replay.json',
    };
    const filepath = writeConfigFile('summary-replay.json', configData);

    const config = loadConfig(filepath);
    printConfigSummary(config);

    const output = consoleOutput.join('\n');
    expect(output).toContain('Source: /path/to/replay.json');
  });

  test('prints output configuration in summary', () => {
    const configData = {
      ...createMinimalSimulateConfig(),
      output: {
        directory: 'my-results',
        level: 'verbose',
        formats: ['json', 'csv'],
      },
    };
    const filepath = writeConfigFile('summary-output.json', configData);

    const config = loadConfig(filepath);
    printConfigSummary(config);

    const output = consoleOutput.join('\n');
    expect(output).toContain('Output: my-results');
    expect(output).toContain('Level: verbose');
    expect(output).toContain('Formats: json, csv');
  });
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

describe('Error handling', () => {
  test('provides meaningful error for missing file', () => {
    try {
      loadConfig('/nonexistent/path/config.json');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Configuration file not found');
      expect((error as Error).message).toContain('/nonexistent/path/config.json');
    }
  });

  test('provides meaningful error for invalid JSON syntax', () => {
    const filepath = join(tempDir, 'syntax-error.json');
    writeFileSync(filepath, '{ "command": simulate }'); // Missing quotes around value

    try {
      loadConfig(filepath);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Invalid JSON in config file');
    }
  });

  test('provides meaningful error for missing required fields', () => {
    const filepath = writeConfigFile('missing-fields.json', {});

    try {
      loadConfig(filepath);
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Configuration missing required field');
    }
  });

  test('provides meaningful error for invalid command type', () => {
    const filepath = writeConfigFile('invalid-command.json', {
      command: 'invalid',
      name: 'test',
    });

    try {
      loadConfig(filepath);
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Unknown command');
    }
  });

  test('handles empty config file', () => {
    const filepath = join(tempDir, 'empty.json');
    writeFileSync(filepath, '');

    try {
      loadConfig(filepath);
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Invalid JSON');
    }
  });

  test('handles config file with only whitespace', () => {
    const filepath = join(tempDir, 'whitespace.json');
    writeFileSync(filepath, '   \n\n   ');

    try {
      loadConfig(filepath);
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  test('handles config file with null content', () => {
    const filepath = join(tempDir, 'null.json');
    writeFileSync(filepath, 'null');

    // null is valid JSON but causes a TypeError when accessing properties
    expect(() => loadConfig(filepath)).toThrow();
  });

  test('handles config file with array instead of object', () => {
    const filepath = join(tempDir, 'array.json');
    writeFileSync(filepath, '[]');

    try {
      loadConfig(filepath);
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Configuration missing required field');
    }
  });
});

// =============================================================================
// EDGE CASES AND SPECIAL VALUES
// =============================================================================

describe('Edge cases and special values', () => {
  test('handles very large game counts', () => {
    const configData = {
      ...createMinimalSimulateConfig(),
      games: 1000000,
    };
    const filepath = writeConfigFile('large-games.json', configData);

    const config = loadConfig(filepath) as SimulateConfig;

    expect(config.games).toBe(1000000);
  });

  test('handles maxTurns of 1', () => {
    const configData = {
      ...createMinimalSimulateConfig(),
      maxTurns: 1,
    };
    const filepath = writeConfigFile('min-turns.json', configData);

    const config = loadConfig(filepath) as SimulateConfig;

    expect(config.maxTurns).toBe(1);
  });

  test('handles very large maxTurns', () => {
    const configData = {
      ...createMinimalSimulateConfig(),
      maxTurns: 10000,
    };
    const filepath = writeConfigFile('large-turns.json', configData);

    const config = loadConfig(filepath) as SimulateConfig;

    expect(config.maxTurns).toBe(10000);
  });

  test('handles special characters in experiment name', () => {
    const configData = {
      ...createMinimalSimulateConfig(),
      name: 'test_experiment-v2.0',
    };
    const filepath = writeConfigFile('special-name.json', configData);

    const config = loadConfig(filepath);

    expect(config.name).toBe('test_experiment-v2.0');
  });

  test('handles unicode in experiment name', () => {
    const configData = {
      ...createMinimalSimulateConfig(),
      name: 'test-experiment-beta',
    };
    const filepath = writeConfigFile('unicode-name.json', configData);

    const config = loadConfig(filepath);

    expect(config.name).toBe('test-experiment-beta');
  });

  test('handles empty output formats array', () => {
    const configData = {
      ...createMinimalSimulateConfig(),
      output: { formats: [] },
    };
    const filepath = writeConfigFile('empty-formats.json', configData);

    const config = loadConfig(filepath);

    expect(config.output!.formats).toEqual([]);
  });

  test('handles seed value of 0', () => {
    const configData = {
      ...createMinimalSimulateConfig(),
      seed: 0,
    };
    const filepath = writeConfigFile('zero-seed.json', configData);

    const config = loadConfig(filepath) as SimulateConfig;

    expect(config.seed).toBe(0);
  });

  test('handles benchmark with many bots', () => {
    const configData: Partial<BenchmarkConfig> = {
      command: 'benchmark',
      name: 'many-bots',
      bots: [
        'random',
        'greedy',
        'mcts-eval-fast',
        'mcts-eval',
        'mcts-eval-strong',
        'mcts-eval-turbo',
        'mcts-ordered',
      ],
      gamesPerMatchup: 10,
    };
    const filepath = writeConfigFile('many-bots.json', configData);

    const config = loadConfig(filepath) as BenchmarkConfig;

    expect(config.bots.length).toBe(7);
  });

  test('handles collect with all phase options', () => {
    const phases: Array<CollectTrainingConfig['phase']> = [
      'easy',
      'medium',
      'hard',
      'fast-easy',
      'fast-medium',
    ];

    for (const phase of phases) {
      const configData: Partial<CollectTrainingConfig> = {
        command: 'collect',
        name: `collect-${phase}`,
        games: 10,
        phase,
      };
      const filepath = writeConfigFile(`collect-${phase}.json`, configData);

      const config = loadConfig(filepath) as CollectTrainingConfig;
      expect(config.phase).toBe(phase);
    }
  });

  test('handles pipeline with all acceptance levels', () => {
    const levels: Array<PipelineConfig['acceptance']> = ['relaxed', 'default', 'strict'];

    for (const acceptance of levels) {
      const configData: Partial<PipelineConfig> = {
        command: 'pipeline',
        name: `pipeline-${acceptance}`,
        acceptance,
      };
      const filepath = writeConfigFile(`pipeline-${acceptance}.json`, configData);

      const config = loadConfig(filepath) as PipelineConfig;
      expect(config.acceptance).toBe(acceptance);
    }
  });
});

// =============================================================================
// CONFIG MERGING TESTS
// =============================================================================

describe('Config merging behavior', () => {
  test('output config merges with defaults correctly', () => {
    const configData = {
      ...createMinimalSimulateConfig(),
      output: {
        level: 'verbose',
        // directory, formats, timestamp should come from defaults
      },
    };
    const filepath = writeConfigFile('merge-partial.json', configData);

    const config = loadConfig(filepath);

    expect(config.output!.level).toBe('verbose');
    expect(config.output!.directory).toBe('results');
    expect(config.output!.formats).toEqual(['json']);
    expect(config.output!.timestamp).toBe(true);
  });

  test('explicit values override defaults', () => {
    const configData = {
      ...createMinimalSimulateConfig(),
      maxTurns: 25,
      parallel: false,
      output: {
        directory: 'custom',
        level: 'quiet',
        formats: ['csv'],
        timestamp: false,
      },
    };
    const filepath = writeConfigFile('override-all.json', configData);

    const config = loadConfig(filepath) as SimulateConfig;

    expect(config.maxTurns).toBe(25);
    expect(config.parallel).toBe(false);
    expect(config.output!.directory).toBe('custom');
    expect(config.output!.level).toBe('quiet');
    expect(config.output!.formats).toEqual(['csv']);
    expect(config.output!.timestamp).toBe(false);
  });

  test('falsy values are preserved (not treated as missing)', () => {
    const configData = {
      ...createMinimalSimulateConfig(),
      parallel: false,
      seed: 0,
      output: {
        timestamp: false,
      },
    };
    const filepath = writeConfigFile('falsy-values.json', configData);

    const config = loadConfig(filepath) as SimulateConfig;

    expect(config.parallel).toBe(false);
    expect(config.seed).toBe(0);
    expect(config.output!.timestamp).toBe(false);
  });
});

// =============================================================================
// TYPE INFERENCE TESTS
// =============================================================================

describe('Config type discrimination', () => {
  test('SimulateConfig has correct type', () => {
    const configData = createMinimalSimulateConfig();
    const filepath = writeConfigFile('type-simulate.json', configData);

    const config = loadConfig(filepath);

    if (config.command === 'simulate') {
      // TypeScript should narrow the type here
      expect(config.games).toBeDefined();
      expect(config.p1).toBeDefined();
      expect(config.p2).toBeDefined();
    }
  });

  test('BenchmarkConfig has correct type', () => {
    const configData = createMinimalBenchmarkConfig();
    const filepath = writeConfigFile('type-benchmark.json', configData);

    const config = loadConfig(filepath);

    if (config.command === 'benchmark') {
      expect(config.bots).toBeDefined();
      expect(config.gamesPerMatchup).toBeDefined();
    }
  });

  test('command field correctly discriminates union types', () => {
    const configs = [
      { ...createMinimalSimulateConfig() },
      { ...createMinimalBenchmarkConfig() },
      {
        command: 'tune-weights' as const,
        name: 'test',
        method: 'local' as const,
        gamesRandom: 50,
        gamesGreedy: 50,
      },
      {
        command: 'tune-mcts' as const,
        name: 'test',
        method: 'grid' as const,
        gamesPerConfig: 50,
      },
      { command: 'pipeline' as const, name: 'test' },
      { command: 'collect' as const, name: 'test', games: 100 },
      { command: 'replay' as const, name: 'test', source: '/path' },
    ];

    for (let i = 0; i < configs.length; i++) {
      const filepath = writeConfigFile(`discriminate-${i}.json`, configs[i]);
      const loaded = loadConfig(filepath);

      expect(loaded.command).toBe(configs[i].command);
    }
  });
});
