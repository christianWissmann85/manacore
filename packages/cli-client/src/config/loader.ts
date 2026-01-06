/**
 * Configuration Loader
 *
 * Loads, validates, and merges experiment configurations from JSON files.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import type { ExperimentConfig, ManaCoreConfig, OutputConfig, CONFIG_DEFAULTS } from './schema';

/**
 * Load configuration from a JSON file
 */
export function loadConfig(configPath: string): ExperimentConfig {
  const absolutePath = resolve(configPath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Configuration file not found: ${absolutePath}`);
  }

  try {
    const content = readFileSync(absolutePath, 'utf-8');
    const config = JSON.parse(content) as ExperimentConfig;

    // Validate required fields
    validateConfig(config);

    // Apply defaults
    return applyDefaults(config);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${configPath}\n${error.message}`);
    }
    throw error;
  }
}

/**
 * Load root manacore.config.json if it exists
 */
export function loadRootConfig(): ManaCoreConfig | null {
  const possiblePaths = [
    resolve(process.cwd(), 'manacore.config.json'),
    resolve(process.cwd(), '.manacore.json'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        return JSON.parse(content) as ManaCoreConfig;
      } catch {
        // Ignore invalid root config
      }
    }
  }

  return null;
}

/**
 * Validate configuration has required fields
 */
function validateConfig(config: ExperimentConfig): void {
  if (!config.command) {
    throw new Error('Configuration missing required field: command');
  }

  if (!config.name) {
    throw new Error('Configuration missing required field: name');
  }

  // Command-specific validation
  switch (config.command) {
    case 'simulate':
      if (!config.games || config.games < 1) {
        throw new Error('simulate: games must be >= 1');
      }
      if (!config.p1 || !config.p1.type) {
        throw new Error('simulate: p1.type is required');
      }
      if (!config.p2 || !config.p2.type) {
        throw new Error('simulate: p2.type is required');
      }
      break;

    case 'benchmark':
      if (!config.bots || config.bots.length < 2) {
        throw new Error('benchmark: at least 2 bots required');
      }
      if (!config.gamesPerMatchup || config.gamesPerMatchup < 1) {
        throw new Error('benchmark: gamesPerMatchup must be >= 1');
      }
      break;

    case 'tune-weights':
      if (!config.method) {
        throw new Error('tune-weights: method is required (local | evolve)');
      }
      break;

    case 'tune-mcts':
      if (!config.method) {
        throw new Error('tune-mcts: method is required (grid | coarse-to-fine)');
      }
      break;

    case 'pipeline':
      // Pipeline has sensible defaults for everything
      break;

    case 'collect':
      if (!config.games || config.games < 1) {
        throw new Error('collect: games must be >= 1');
      }
      break;

    case 'replay':
      if (!config.source) {
        throw new Error('replay: source is required (file path or seed)');
      }
      break;

    default:
      throw new Error(`Unknown command: ${(config as any).command}`);
  }
}

/**
 * Apply default values to configuration
 */
function applyDefaults(config: ExperimentConfig): ExperimentConfig {
  // Resolve seed (not all configs have seed)
  if ('seed' in config && (config.seed === 'timestamp' || config.seed === undefined)) {
    (config as any).seed = Date.now();
  }

  // Apply output defaults
  const outputDefaults: OutputConfig = {
    directory: 'results',
    level: 'minimal',
    formats: ['json'],
    timestamp: true,
  };

  (config as any).output = {
    ...outputDefaults,
    ...(config.output || {}),
  };

  // Command-specific defaults
  switch (config.command) {
    case 'simulate':
      config.maxTurns = config.maxTurns ?? 100;
      config.parallel = config.parallel ?? true;
      break;

    case 'benchmark':
      config.calculateElo = config.calculateElo ?? true;
      break;

    case 'tune-weights':
      config.gamesRandom = config.gamesRandom ?? 50;
      config.gamesGreedy = config.gamesGreedy ?? 50;
      if (config.method === 'evolve') {
        config.generations = config.generations ?? 20;
        config.population = config.population ?? 20;
      }
      break;

    case 'tune-mcts':
      config.gamesPerConfig = config.gamesPerConfig ?? 50;
      config.validationGames = config.validationGames ?? 100;
      config.skipValidation = config.skipValidation ?? false;
      break;

    case 'pipeline':
      config.acceptance = config.acceptance ?? 'default';
      break;

    case 'collect':
      config.curriculum = config.curriculum ?? 'default';
      config.maxTurns = config.maxTurns ?? 100;
      config.export = {
        json: config.export?.json ?? true,
        binary: config.export?.binary ?? true,
      };
      break;
  }

  return config;
}

/**
 * Resolve output path for an experiment
 */
export function resolveOutputPath(config: ExperimentConfig): string {
  const output = config.output!;
  const baseDir = output.directory || 'results';

  if (output.timestamp) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return resolve(baseDir, `${config.name}-${timestamp}`);
  }

  return resolve(baseDir, config.name);
}

/**
 * Print configuration summary
 */
export function printConfigSummary(config: ExperimentConfig): void {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Experiment: ${config.name}`);
  console.log(`  Command: ${config.command}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  switch (config.command) {
    case 'simulate':
      console.log(`  Games: ${config.games}`);
      console.log(`  P1: ${config.p1.type}${config.p1.name ? ` (${config.p1.name})` : ''}`);
      console.log(`  P2: ${config.p2.type}${config.p2.name ? ` (${config.p2.name})` : ''}`);
      console.log(`  Seed: ${config.seed}`);
      console.log(`  Max Turns: ${config.maxTurns}`);
      console.log(`  Parallel: ${config.parallel}`);
      break;

    case 'benchmark':
      console.log(`  Bots: ${config.bots.join(', ')}`);
      console.log(`  Games/Matchup: ${config.gamesPerMatchup}`);
      console.log(`  Seed: ${config.seed}`);
      console.log(`  Calculate Elo: ${config.calculateElo}`);
      break;

    case 'tune-weights':
      console.log(`  Method: ${config.method}`);
      console.log(`  Games vs Random: ${config.gamesRandom}`);
      console.log(`  Games vs Greedy: ${config.gamesGreedy}`);
      if (config.method === 'evolve') {
        console.log(`  Generations: ${config.generations}`);
        console.log(`  Population: ${config.population}`);
      }
      break;

    case 'tune-mcts':
      console.log(`  Method: ${config.method}`);
      console.log(`  Games/Config: ${config.gamesPerConfig}`);
      console.log(`  Validation Games: ${config.validationGames}`);
      break;

    case 'pipeline':
      console.log(`  Acceptance: ${config.acceptance}`);
      console.log(`  Weight Method: ${config.weights?.method || 'evolve'}`);
      console.log(`  MCTS Method: ${config.mcts?.method || 'coarse-to-fine'}`);
      console.log(`  Skip Weights: ${config.weights?.skip || false}`);
      console.log(`  Skip MCTS: ${config.mcts?.skip || false}`);
      break;

    case 'collect':
      console.log(`  Games: ${config.games}`);
      console.log(`  Curriculum: ${config.curriculum}`);
      if (config.phase) console.log(`  Phase: ${config.phase}`);
      console.log(`  Export JSON: ${config.export?.json}`);
      console.log(`  Export Binary: ${config.export?.binary}`);
      break;

    case 'replay':
      console.log(`  Source: ${config.source}`);
      if (config.fromTurn) console.log(`  From Turn: ${config.fromTurn}`);
      if (config.watch?.enabled) console.log(`  Watch Mode: ${config.watch.delayMs || 500}ms`);
      break;
  }

  console.log('');
  console.log(`  Output: ${config.output?.directory}`);
  console.log(`  Level: ${config.output?.level}`);
  console.log(`  Formats: ${config.output?.formats?.join(', ')}`);
  console.log('');
}
