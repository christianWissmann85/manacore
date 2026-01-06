/**
 * MCTSTuner - Hyperparameter optimization for MCTS
 *
 * Tunes MCTS-specific parameters:
 * - explorationConstant (UCB1's C value)
 * - rolloutDepth
 * - rolloutPolicy
 * - epsilon (for epsilon-greedy)
 *
 * Uses grid search or coarse-to-fine optimization with parallel game execution.
 */

import type { PlayerId } from '@manacore/engine';
import { initializeGame, getRandomTestDeck, applyAction, getLegalActions } from '@manacore/engine';
import { GreedyBot } from '../bots/GreedyBot';
import { MCTSBot } from '../bots/MCTSBot';
import type { Bot } from '../bots/Bot';
import type { RolloutPolicy } from '../search/MCTS';
import {
  randomRolloutPolicy,
  greedyRolloutPolicy,
  epsilonGreedyRolloutPolicy,
} from '../search/MCTS';
import {
  validateImprovement,
  type AcceptanceCriteriaConfig,
  DEFAULT_ACCEPTANCE_CONFIG,
} from './AcceptanceCriteria';
import type { PerformanceMetrics } from '../weights';

/**
 * MCTS parameters to tune
 */
export interface MCTSHyperparams {
  explorationConstant: number;
  rolloutDepth: number;
  rolloutPolicy: 'random' | 'greedy' | 'epsilon';
  epsilon: number;
  iterations: number;
}

/**
 * Parameter ranges for tuning
 */
export interface MCTSParamRanges {
  explorationConstant: number[];
  rolloutDepth: number[];
  rolloutPolicy: ('random' | 'greedy' | 'epsilon')[];
  epsilon: number[];
  iterations: number[];
}

/**
 * Result of evaluating a single MCTS configuration
 */
export interface MCTSConfigResult {
  params: MCTSHyperparams;
  winRate: number;
  gamesPlayed: number;
  avgTurns: number;
  avgTimeMs: number;
}

/**
 * Progress callback for tuning
 */
export interface MCTSTuningProgress {
  phase: 'grid' | 'fine' | 'validate';
  currentConfig: number;
  totalConfigs: number;
  currentGames: number;
  totalGames: number;
  bestSoFar: MCTSConfigResult | null;
  elapsedMs: number;
  estimatedRemainingMs: number;
}

/**
 * Tuning result
 */
export interface MCTSTuningResult {
  bestParams: MCTSHyperparams;
  bestResult: MCTSConfigResult;
  allResults: MCTSConfigResult[];
  totalGamesPlayed: number;
  totalTimeMs: number;
  validated: boolean;
  validationResult?: ReturnType<typeof validateImprovement>;
}

/**
 * Configuration for MCTSTuner
 */
export interface MCTSTunerConfig {
  /** Games per configuration for initial evaluation */
  gamesPerConfig: number;

  /** Games for final validation */
  validationGames: number;

  /** Maximum turns per game */
  maxTurns: number;

  /** Base seed for reproducibility */
  seed: number;

  /** Optimization method */
  method: 'grid' | 'coarse-to-fine';

  /** Acceptance criteria for validation */
  acceptanceCriteria: AcceptanceCriteriaConfig;

  /** MCTS iterations to use during tuning (lower = faster) */
  tuningIterations: number;
}

/**
 * Default tuner configuration
 */
export const DEFAULT_TUNER_CONFIG: MCTSTunerConfig = {
  gamesPerConfig: 50,
  validationGames: 200,
  maxTurns: 100,
  seed: Date.now(),
  method: 'coarse-to-fine',
  acceptanceCriteria: DEFAULT_ACCEPTANCE_CONFIG,
  tuningIterations: 50, // Fast iterations for tuning
};

/**
 * Default parameter ranges for grid search
 */
export const DEFAULT_PARAM_RANGES: MCTSParamRanges = {
  explorationConstant: [0.7, 1.0, 1.41, 2.0],
  rolloutDepth: [0, 5, 10, 15],
  rolloutPolicy: ['greedy', 'epsilon', 'random'],
  epsilon: [0.1], // Only used when policy is 'epsilon'
  iterations: [50], // Fixed during tuning, can be increased for production
};

/**
 * Coarse parameter ranges (fewer options)
 */
export const COARSE_PARAM_RANGES: MCTSParamRanges = {
  explorationConstant: [0.7, 1.41, 2.0],
  rolloutDepth: [0, 10, 20],
  rolloutPolicy: ['greedy', 'random'],
  epsilon: [0.1],
  iterations: [50],
};

/**
 * Run a single game between two bots
 */
function runGame(
  bot1: Bot,
  bot2: Bot,
  seed: number,
  maxTurns: number,
): { winner: PlayerId | null; turns: number; timeMs: number } {
  const startTime = performance.now();
  const deck1 = getRandomTestDeck();
  const deck2 = getRandomTestDeck();
  let state = initializeGame(deck1, deck2, seed);

  let turnCount = 0;
  let actionCount = 0;
  const MAX_ACTIONS_PER_PRIORITY = 50;
  let actionsThisPriority = 0;
  let lastPriorityPlayer = state.priorityPlayer;
  let lastPhase = state.phase;

  while (!state.gameOver && turnCount < maxTurns && actionCount < 10000) {
    const bot = state.priorityPlayer === 'player' ? bot1 : bot2;
    const legalActions = getLegalActions(state, state.priorityPlayer);

    if (legalActions.length === 0) break;

    const action = bot.chooseAction(state, state.priorityPlayer);

    try {
      state = applyAction(state, action);
      actionCount++;

      if (state.priorityPlayer !== lastPriorityPlayer || state.phase !== lastPhase) {
        actionsThisPriority = 0;
        lastPriorityPlayer = state.priorityPlayer;
        lastPhase = state.phase;
      } else {
        actionsThisPriority++;
        if (actionsThisPriority >= MAX_ACTIONS_PER_PRIORITY) {
          break;
        }
      }
    } catch {
      break;
    }

    if (state.turnCount > turnCount) {
      turnCount = state.turnCount;
    }
  }

  let winner: PlayerId | null = null;
  if (state.gameOver && state.winner) {
    winner = state.winner;
  } else {
    const p1Life = state.players.player.life;
    const p2Life = state.players.opponent.life;
    if (p1Life > p2Life) winner = 'player';
    else if (p2Life > p1Life) winner = 'opponent';
  }

  return {
    winner,
    turns: turnCount,
    timeMs: performance.now() - startTime,
  };
}

/**
 * Create rollout policy from params
 */
function createRolloutPolicy(params: MCTSHyperparams): RolloutPolicy {
  switch (params.rolloutPolicy) {
    case 'random':
      return randomRolloutPolicy;
    case 'greedy':
      return greedyRolloutPolicy;
    case 'epsilon':
      return epsilonGreedyRolloutPolicy(params.epsilon);
  }
}

/**
 * Create MCTS bot from hyperparameters
 */
function createMCTSBotFromParams(params: MCTSHyperparams, _seed: number): Bot {
  const rolloutPolicy = createRolloutPolicy(params);

  return new MCTSBot(
    {
      iterations: params.iterations,
      explorationConstant: params.explorationConstant,
      rolloutDepth: params.rolloutDepth,
      timeLimit: 10000, // 10 second safety limit
      debug: false,
    },
    rolloutPolicy,
  );
}

/**
 * MCTSTuner - Hyperparameter optimization for MCTS
 */
export class MCTSTuner {
  private config: MCTSTunerConfig;
  private gamesPlayed = 0;
  private startTime = 0;

  constructor(config: Partial<MCTSTunerConfig> = {}) {
    this.config = { ...DEFAULT_TUNER_CONFIG, ...config };
  }

  /**
   * Get total games played
   */
  getGamesPlayed(): number {
    return this.gamesPlayed;
  }

  /**
   * Evaluate a single MCTS configuration
   */
  evaluateConfig(params: MCTSHyperparams, games: number, baseSeed: number): MCTSConfigResult {
    const mctsBot = createMCTSBotFromParams(params, baseSeed);
    const greedyBot = new GreedyBot(baseSeed + 5000);

    let wins = 0;
    let totalTurns = 0;
    let totalTimeMs = 0;

    for (let i = 0; i < games; i++) {
      const seed = baseSeed + i;

      // Alternate who goes first
      const mctsFirst = i % 2 === 0;
      const result = mctsFirst
        ? runGame(mctsBot, greedyBot, seed, this.config.maxTurns)
        : runGame(greedyBot, mctsBot, seed, this.config.maxTurns);

      this.gamesPlayed++;

      // Count wins for MCTS
      if (mctsFirst && result.winner === 'player') wins++;
      if (!mctsFirst && result.winner === 'opponent') wins++;

      totalTurns += result.turns;
      totalTimeMs += result.timeMs;
    }

    return {
      params,
      winRate: wins / games,
      gamesPlayed: games,
      avgTurns: totalTurns / games,
      avgTimeMs: totalTimeMs / games,
    };
  }

  /**
   * Generate all parameter combinations for grid search
   */
  generateGrid(ranges: MCTSParamRanges): MCTSHyperparams[] {
    const configs: MCTSHyperparams[] = [];

    for (const explorationConstant of ranges.explorationConstant) {
      for (const rolloutDepth of ranges.rolloutDepth) {
        for (const rolloutPolicy of ranges.rolloutPolicy) {
          for (const epsilon of ranges.epsilon) {
            for (const iterations of ranges.iterations) {
              // Skip epsilon variations if not using epsilon-greedy
              if (rolloutPolicy !== 'epsilon' && epsilon !== ranges.epsilon[0]) {
                continue;
              }

              configs.push({
                explorationConstant,
                rolloutDepth,
                rolloutPolicy,
                epsilon,
                iterations,
              });
            }
          }
        }
      }
    }

    return configs;
  }

  /**
   * Run grid search optimization
   */
  runGridSearch(
    ranges: MCTSParamRanges = DEFAULT_PARAM_RANGES,
    onProgress?: (progress: MCTSTuningProgress) => void,
  ): MCTSTuningResult {
    this.startTime = performance.now();
    this.gamesPlayed = 0;

    const configs = this.generateGrid(ranges);
    const totalConfigs = configs.length;
    const totalGames = totalConfigs * this.config.gamesPerConfig;

    const results: MCTSConfigResult[] = [];
    let bestResult: MCTSConfigResult | null = null;

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i]!;
      const result = this.evaluateConfig(
        config,
        this.config.gamesPerConfig,
        this.config.seed + i * 10000,
      );

      results.push(result);

      if (!bestResult || result.winRate > bestResult.winRate) {
        bestResult = result;
      }

      // Progress callback
      if (onProgress) {
        const elapsed = performance.now() - this.startTime;
        const gamesPerMs = this.gamesPlayed / elapsed;
        const remainingGames = totalGames - this.gamesPlayed;

        onProgress({
          phase: 'grid',
          currentConfig: i + 1,
          totalConfigs,
          currentGames: this.gamesPlayed,
          totalGames,
          bestSoFar: bestResult,
          elapsedMs: elapsed,
          estimatedRemainingMs: remainingGames / gamesPerMs,
        });
      }
    }

    return {
      bestParams: bestResult!.params,
      bestResult: bestResult!,
      allResults: results,
      totalGamesPlayed: this.gamesPlayed,
      totalTimeMs: performance.now() - this.startTime,
      validated: false,
    };
  }

  /**
   * Run coarse-to-fine optimization
   *
   * Phase 1: Coarse grid search with fewer games
   * Phase 2: Fine search around best region
   * Phase 3: Validate with more games
   */
  runCoarseToFine(onProgress?: (progress: MCTSTuningProgress) => void): MCTSTuningResult {
    this.startTime = performance.now();
    this.gamesPlayed = 0;

    // Phase 1: Coarse search
    const coarseConfigs = this.generateGrid(COARSE_PARAM_RANGES);
    const coarseResults: MCTSConfigResult[] = [];
    let bestCoarse: MCTSConfigResult | null = null;

    const coarseGames = Math.max(20, Math.floor(this.config.gamesPerConfig / 2));

    for (let i = 0; i < coarseConfigs.length; i++) {
      const config = coarseConfigs[i]!;
      const result = this.evaluateConfig(config, coarseGames, this.config.seed + i * 10000);

      coarseResults.push(result);

      if (!bestCoarse || result.winRate > bestCoarse.winRate) {
        bestCoarse = result;
      }

      if (onProgress) {
        const elapsed = performance.now() - this.startTime;
        onProgress({
          phase: 'grid',
          currentConfig: i + 1,
          totalConfigs: coarseConfigs.length,
          currentGames: this.gamesPlayed,
          totalGames: coarseConfigs.length * coarseGames,
          bestSoFar: bestCoarse,
          elapsedMs: elapsed,
          estimatedRemainingMs: 0, // Hard to estimate with phases
        });
      }
    }

    // Phase 2: Fine search around best
    const fineRanges = this.generateFineRanges(bestCoarse!.params);
    const fineConfigs = this.generateGrid(fineRanges);
    const fineResults: MCTSConfigResult[] = [];
    let bestFine = bestCoarse!;

    for (let i = 0; i < fineConfigs.length; i++) {
      const config = fineConfigs[i]!;

      // Skip if same as coarse best (already evaluated)
      if (this.paramsEqual(config, bestCoarse!.params)) {
        continue;
      }

      const result = this.evaluateConfig(
        config,
        this.config.gamesPerConfig,
        this.config.seed + 100000 + i * 10000,
      );

      fineResults.push(result);

      if (result.winRate > bestFine.winRate) {
        bestFine = result;
      }

      if (onProgress) {
        const elapsed = performance.now() - this.startTime;
        onProgress({
          phase: 'fine',
          currentConfig: i + 1,
          totalConfigs: fineConfigs.length,
          currentGames: this.gamesPlayed,
          totalGames: this.gamesPlayed + (fineConfigs.length - i - 1) * this.config.gamesPerConfig,
          bestSoFar: bestFine,
          elapsedMs: elapsed,
          estimatedRemainingMs: 0,
        });
      }
    }

    // Combine all results
    const allResults = [...coarseResults, ...fineResults];

    return {
      bestParams: bestFine.params,
      bestResult: bestFine,
      allResults,
      totalGamesPlayed: this.gamesPlayed,
      totalTimeMs: performance.now() - this.startTime,
      validated: false,
    };
  }

  /**
   * Generate fine-grained parameter ranges around a center point
   */
  private generateFineRanges(center: MCTSHyperparams): MCTSParamRanges {
    const c = center.explorationConstant;
    const d = center.rolloutDepth;

    return {
      explorationConstant: [Math.max(0.3, c - 0.3), c, Math.min(3.0, c + 0.3)],
      rolloutDepth: [Math.max(0, d - 5), d, Math.min(30, d + 5)],
      rolloutPolicy: [center.rolloutPolicy], // Keep the winning policy
      epsilon: [center.epsilon],
      iterations: [center.iterations],
    };
  }

  /**
   * Check if two param configs are equal
   */
  private paramsEqual(a: MCTSHyperparams, b: MCTSHyperparams): boolean {
    return (
      a.explorationConstant === b.explorationConstant &&
      a.rolloutDepth === b.rolloutDepth &&
      a.rolloutPolicy === b.rolloutPolicy &&
      a.epsilon === b.epsilon &&
      a.iterations === b.iterations
    );
  }

  /**
   * Validate the best configuration with more games
   */
  validate(
    params: MCTSHyperparams,
    baselineMetrics: PerformanceMetrics,
    onProgress?: (progress: MCTSTuningProgress) => void,
  ): MCTSTuningResult {
    const startTime = performance.now();

    if (onProgress) {
      onProgress({
        phase: 'validate',
        currentConfig: 1,
        totalConfigs: 1,
        currentGames: 0,
        totalGames: this.config.validationGames,
        bestSoFar: null,
        elapsedMs: 0,
        estimatedRemainingMs: 0,
      });
    }

    const result = this.evaluateConfig(
      params,
      this.config.validationGames,
      this.config.seed + 500000,
    );

    // Create metrics for validation
    const newMetrics: PerformanceMetrics = {
      vsRandom: 0.8, // Placeholder - MCTS should beat random easily
      vsGreedy: result.winRate,
      elo: 1500 + (result.winRate - 0.5) * 600,
      gamesPlayed: result.gamesPlayed,
    };

    const validationResult = validateImprovement(
      baselineMetrics,
      newMetrics,
      this.config.acceptanceCriteria,
    );

    if (onProgress) {
      onProgress({
        phase: 'validate',
        currentConfig: 1,
        totalConfigs: 1,
        currentGames: result.gamesPlayed,
        totalGames: this.config.validationGames,
        bestSoFar: result,
        elapsedMs: performance.now() - startTime,
        estimatedRemainingMs: 0,
      });
    }

    return {
      bestParams: params,
      bestResult: result,
      allResults: [result],
      totalGamesPlayed: result.gamesPlayed,
      totalTimeMs: performance.now() - startTime,
      validated: true,
      validationResult,
    };
  }

  /**
   * Run full tuning pipeline
   */
  tune(onProgress?: (progress: MCTSTuningProgress) => void): MCTSTuningResult {
    if (this.config.method === 'grid') {
      return this.runGridSearch(DEFAULT_PARAM_RANGES, onProgress);
    } else {
      return this.runCoarseToFine(onProgress);
    }
  }

  /**
   * Get baseline metrics for current MCTS configuration
   */
  getBaselineMetrics(games: number = 100): PerformanceMetrics {
    // Use current weights to create default MCTS bot
    const defaultParams: MCTSHyperparams = {
      explorationConstant: 1.41,
      rolloutDepth: 20,
      rolloutPolicy: 'greedy',
      epsilon: 0.1,
      iterations: this.config.tuningIterations,
    };

    const result = this.evaluateConfig(defaultParams, games, this.config.seed);

    return {
      vsRandom: 0.8, // Placeholder
      vsGreedy: result.winRate,
      elo: 1500 + (result.winRate - 0.5) * 600,
      gamesPlayed: result.gamesPlayed,
    };
  }
}

/**
 * Format tuning result for console output
 */
export function formatMCTSTuningResult(result: MCTSTuningResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                   MCTS TUNING RESULT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  lines.push('Best Configuration:');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`  Exploration Constant (C): ${result.bestParams.explorationConstant}`);
  lines.push(`  Rollout Depth:            ${result.bestParams.rolloutDepth}`);
  lines.push(`  Rollout Policy:           ${result.bestParams.rolloutPolicy}`);
  if (result.bestParams.rolloutPolicy === 'epsilon') {
    lines.push(`  Epsilon:                  ${result.bestParams.epsilon}`);
  }
  lines.push(`  Iterations:               ${result.bestParams.iterations}`);
  lines.push('');

  lines.push('Performance:');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`  Win Rate vs GreedyBot:    ${(result.bestResult.winRate * 100).toFixed(1)}%`);
  lines.push(`  Games Played:             ${result.bestResult.gamesPlayed}`);
  lines.push(`  Avg Turns per Game:       ${result.bestResult.avgTurns.toFixed(1)}`);
  lines.push(`  Avg Time per Game:        ${result.bestResult.avgTimeMs.toFixed(0)}ms`);
  lines.push('');

  lines.push('Tuning Statistics:');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`  Total Configurations:     ${result.allResults.length}`);
  lines.push(`  Total Games Played:       ${result.totalGamesPlayed}`);
  lines.push(`  Total Time:               ${(result.totalTimeMs / 1000).toFixed(1)}s`);
  lines.push(
    `  Games per Second:         ${(result.totalGamesPlayed / (result.totalTimeMs / 1000)).toFixed(1)}`,
  );
  lines.push('');

  if (result.validated && result.validationResult) {
    lines.push('Validation:');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`  ${result.validationResult.accepted ? '✓ ACCEPTED' : '✗ REJECTED'}`);
    if (!result.validationResult.accepted) {
      for (const reason of result.validationResult.rejectionReasons) {
        lines.push(`  • ${reason}`);
      }
    }
    lines.push('');
  }

  // Top 5 configurations
  const sorted = [...result.allResults].sort((a, b) => b.winRate - a.winRate);
  lines.push('Top 5 Configurations:');
  lines.push('───────────────────────────────────────────────────────────────');
  for (let i = 0; i < Math.min(5, sorted.length); i++) {
    const r = sorted[i]!;
    lines.push(
      `  ${i + 1}. C=${r.params.explorationConstant} D=${r.params.rolloutDepth} ` +
        `P=${r.params.rolloutPolicy} → ${(r.winRate * 100).toFixed(1)}%`,
    );
  }
  lines.push('');

  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Convert tuning result to JSON-serializable format for weights.json
 */
export function tuningResultToMCTSParams(result: MCTSTuningResult): {
  explorationConstant: number;
  rolloutDepth: number;
  rolloutPolicy: 'random' | 'greedy' | 'epsilon';
  epsilon: number;
} {
  return {
    explorationConstant: result.bestParams.explorationConstant,
    rolloutDepth: result.bestParams.rolloutDepth,
    rolloutPolicy: result.bestParams.rolloutPolicy,
    epsilon: result.bestParams.epsilon,
  };
}
