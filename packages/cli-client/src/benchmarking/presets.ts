/**
 * Benchmark Presets
 *
 * Predefined bot configurations for different benchmark scenarios.
 */

import type { BotType } from '../botFactory';
import type { BenchmarkPreset } from './types';

/**
 * Preset configuration
 */
export interface PresetConfig {
  /** Bot types to benchmark */
  bots: BotType[];
  /** Games per matchup */
  gamesPerMatchup: number;
  /** Human-readable description */
  description: string;
  /** Estimated time to complete */
  estimatedTime: string;
}

/**
 * Available benchmark presets
 */
export const BENCHMARK_PRESETS: Record<Exclude<BenchmarkPreset, 'custom'>, PresetConfig> = {
  /**
   * Quick preset - fast iteration, basic comparison
   * 4 bots = 16 matchups (including mirrors) x 50 games = 800 games
   */
  quick: {
    bots: ['random', 'greedy', 'mcts-eval-fast', 'mcts-eval'],
    gamesPerMatchup: 50,
    description: 'Quick comparison (4 bots, ~800 games)',
    estimatedTime: '~5-10 min',
  },

  /**
   * Standard preset - balanced comparison
   * 5 bots = 25 matchups x 100 games = 2,500 games
   */
  standard: {
    bots: ['random', 'greedy', 'mcts-eval-fast', 'mcts-eval', 'mcts-eval-strong'],
    gamesPerMatchup: 100,
    description: 'Standard comparison (5 bots, ~2,500 games)',
    estimatedTime: '~20-40 min',
  },

  /**
   * Comprehensive preset - all bots
   * 7 bots = 49 matchups x 100 games = 4,900 games
   */
  comprehensive: {
    bots: [
      'random',
      'greedy',
      'mcts-eval-fast',
      'mcts-eval',
      'mcts-eval-strong',
      'mcts-eval-turbo',
      'mcts-ordered',
    ],
    gamesPerMatchup: 100,
    description: 'Full comparison (7 bots, ~4,900 games)',
    estimatedTime: '~1-2 hours',
  },
};

/**
 * Get a preset configuration by name
 */
export function getPreset(name: BenchmarkPreset): PresetConfig | undefined {
  if (name === 'custom') return undefined;
  return BENCHMARK_PRESETS[name];
}

/**
 * Get all available bot types
 */
export function getAllBotTypes(): BotType[] {
  return BENCHMARK_PRESETS.comprehensive.bots;
}

/**
 * Get preset names for help text
 */
export function getPresetNames(): string[] {
  return Object.keys(BENCHMARK_PRESETS);
}

/**
 * Validate bot type string
 */
export function isValidBotType(type: string): type is BotType {
  return getAllBotTypes().includes(type as BotType);
}

/**
 * Parse bot list from comma-separated string
 */
export function parseBotList(input: string): BotType[] {
  const bots = input.split(',').map((b) => b.trim().toLowerCase());
  const valid: BotType[] = [];

  for (const bot of bots) {
    if (isValidBotType(bot)) {
      valid.push(bot);
    } else {
      console.warn(`Warning: Unknown bot type '${bot}', skipping`);
    }
  }

  return valid;
}
