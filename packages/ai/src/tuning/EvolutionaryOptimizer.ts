/**
 * EvolutionaryOptimizer - Genetic algorithm for weight optimization
 *
 * Uses a population-based approach:
 * 1. Initialize population with random variations
 * 2. Evaluate fitness through gameplay
 * 3. Select top performers
 * 4. Create next generation through crossover + mutation
 * 5. Repeat for N generations
 */

import type { EvaluationWeights } from '../evaluation/evaluate';
import { DEFAULT_WEIGHTS } from '../evaluation/evaluate';
import { FitnessEvaluator } from './FitnessEvaluator';
import { normalizeWeights } from './TunableBot';
import type {
  WeightCandidate,
  OptimizationResult,
  ProgressCallback,
  OptimizerConfig,
} from './types';

const DEFAULT_EVOLVE_CONFIG: OptimizerConfig = {
  fitness: {
    gamesVsRandom: 30,
    gamesVsGreedy: 20,
    tournamentGames: 10,
    maxTurns: 100,
    seed: Date.now(),
  },
  generations: 15,
  populationSize: 12,
  mutationRate: 0.3,
  mutationStrength: 0.2,
  verbose: false,
};

/**
 * Generate a unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Create a candidate from weights
 */
function createCandidate(weights: EvaluationWeights, generation: number): WeightCandidate {
  return {
    weights: normalizeWeights(weights),
    fitness: null,
    generation,
    id: generateId(),
  };
}

/**
 * Create a random variation of weights
 */
function randomizeWeights(
  base: EvaluationWeights,
  strength: number,
  rng: () => number,
): EvaluationWeights {
  const keys: (keyof EvaluationWeights)[] = ['life', 'board', 'cards', 'mana', 'tempo'];
  const result = { ...base };

  for (const key of keys) {
    const delta = (rng() * 2 - 1) * strength * base[key];
    result[key] = Math.max(0.01, base[key] + delta);
  }

  return normalizeWeights(result);
}

/**
 * Mutate weights
 */
function mutate(
  weights: EvaluationWeights,
  rate: number,
  strength: number,
  rng: () => number,
): EvaluationWeights {
  const keys: (keyof EvaluationWeights)[] = ['life', 'board', 'cards', 'mana', 'tempo'];
  const result = { ...weights };

  for (const key of keys) {
    if (rng() < rate) {
      const delta = (rng() * 2 - 1) * strength * weights[key];
      result[key] = Math.max(0.01, weights[key] + delta);
    }
  }

  return normalizeWeights(result);
}

/**
 * Crossover two parent weights
 */
function crossover(
  parent1: EvaluationWeights,
  parent2: EvaluationWeights,
  rng: () => number,
): EvaluationWeights {
  const keys: (keyof EvaluationWeights)[] = ['life', 'board', 'cards', 'mana', 'tempo'];
  const result: EvaluationWeights = { life: 0, board: 0, cards: 0, mana: 0, tempo: 0 };

  // Uniform crossover with blending
  for (const key of keys) {
    if (rng() < 0.5) {
      // Blend: weighted average with random blend factor
      const blend = rng();
      result[key] = parent1[key] * blend + parent2[key] * (1 - blend);
    } else {
      // Direct copy from one parent
      result[key] = rng() < 0.5 ? parent1[key] : parent2[key];
    }
  }

  return normalizeWeights(result);
}

/**
 * Tournament selection - pick best from random subset
 */
function tournamentSelect(
  population: WeightCandidate[],
  tournamentSize: number,
  rng: () => number,
): WeightCandidate {
  const candidates: WeightCandidate[] = [];

  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(rng() * population.length);
    candidates.push(population[idx]!);
  }

  candidates.sort((a, b) => {
    if (!a.fitness || !b.fitness) return 0;
    return b.fitness.combined - a.fitness.combined;
  });

  return candidates[0]!;
}

/**
 * Create seeded RNG
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export class EvolutionaryOptimizer {
  private config: OptimizerConfig;
  private evaluator: FitnessEvaluator;
  private allCandidates: WeightCandidate[] = [];
  private startTime = 0;
  private rng: () => number;

  constructor(config: Partial<OptimizerConfig> = {}) {
    this.config = {
      ...DEFAULT_EVOLVE_CONFIG,
      ...config,
      fitness: { ...DEFAULT_EVOLVE_CONFIG.fitness, ...config.fitness },
    };
    this.evaluator = new FitnessEvaluator(this.config.fitness);
    this.rng = createSeededRandom(this.config.fitness.seed);
  }

  /**
   * Run evolutionary optimization
   */
  optimize(
    startWeights: EvaluationWeights = DEFAULT_WEIGHTS,
    onProgress?: ProgressCallback,
  ): OptimizationResult {
    this.startTime = performance.now();
    this.allCandidates = [];
    this.evaluator.resetGamesPlayed();

    const { populationSize, generations, mutationRate, mutationStrength } = this.config;

    // Initialize population
    let population: WeightCandidate[] = [];

    // Always include the baseline
    const baseline = createCandidate(startWeights, 0);
    population.push(baseline);

    // Fill rest with random variations
    for (let i = 1; i < populationSize; i++) {
      const variant = randomizeWeights(startWeights, 0.5, this.rng);
      population.push(createCandidate(variant, 0));
    }

    // Evaluate initial population
    population = this.evaluator.evaluateAll(population);
    this.allCandidates.push(...population);

    // Get baseline fitness
    const baselineFitness = population[0]!.fitness!;

    // Track best overall
    let best = population.reduce((a, b) => {
      if (!a.fitness || !b.fitness) return a;
      return a.fitness.combined > b.fitness.combined ? a : b;
    });

    // Estimate total games
    const gamesPerEval = this.config.fitness.gamesVsRandom + this.config.fitness.gamesVsGreedy;
    const gamesPerGeneration = gamesPerEval * populationSize;
    const estimatedTotalGames = gamesPerGeneration * (generations + 1);

    // Evolution loop
    for (let gen = 0; gen < generations; gen++) {
      // Sort by fitness
      population.sort((a, b) => {
        if (!a.fitness || !b.fitness) return 0;
        return b.fitness.combined - a.fitness.combined;
      });

      // Update best
      if (population[0]!.fitness!.combined > best.fitness!.combined) {
        best = population[0]!;
      }

      // Create next generation
      const nextGen: WeightCandidate[] = [];

      // Elitism: keep top 2
      nextGen.push(createCandidate(population[0]!.weights, gen + 1));
      nextGen.push(createCandidate(population[1]!.weights, gen + 1));

      // Fill rest through crossover + mutation
      while (nextGen.length < populationSize) {
        // Tournament selection
        const parent1 = tournamentSelect(population, 3, this.rng);
        const parent2 = tournamentSelect(population, 3, this.rng);

        // Crossover
        let child = crossover(parent1.weights, parent2.weights, this.rng);

        // Mutation
        child = mutate(child, mutationRate, mutationStrength, this.rng);

        nextGen.push(createCandidate(child, gen + 1));
      }

      // Evaluate next generation
      population = this.evaluator.evaluateAll(nextGen);
      this.allCandidates.push(...population);

      // Report progress
      if (onProgress) {
        const elapsed = performance.now() - this.startTime;
        const gamesPlayed = this.evaluator.getGamesPlayed();
        const gamesPerSecond = gamesPlayed / (elapsed / 1000);
        const remainingGames = estimatedTotalGames - gamesPlayed;
        const etaSeconds = remainingGames / gamesPerSecond;

        // Find current generation best
        const genBest = population.reduce((a, b) => {
          if (!a.fitness || !b.fitness) return a;
          return a.fitness.combined > b.fitness.combined ? a : b;
        });

        onProgress({
          generation: gen + 1,
          totalGenerations: generations,
          gamesCompleted: gamesPlayed,
          totalGames: estimatedTotalGames,
          bestCandidate: best,
          improvement: {
            vsRandom: (best.fitness!.vsRandom - baselineFitness.vsRandom) * 100,
            vsGreedy: (best.fitness!.vsGreedy - baselineFitness.vsGreedy) * 100,
          },
          gamesPerSecond,
          etaSeconds: Math.max(0, etaSeconds),
          phase: `Gen ${gen + 1}: Best=${(genBest.fitness!.combined * 100).toFixed(1)}%`,
        });
      }
    }

    // Final sort
    this.allCandidates.sort((a, b) => {
      if (!a.fitness || !b.fitness) return 0;
      return b.fitness.combined - a.fitness.combined;
    });

    // Update best from final candidates
    if (this.allCandidates[0]!.fitness!.combined > best.fitness!.combined) {
      best = this.allCandidates[0]!;
    }

    const totalTimeMs = performance.now() - this.startTime;

    return {
      bestWeights: best.weights,
      bestFitness: best.fitness!,
      baselineWeights: normalizeWeights(startWeights),
      baselineFitness,
      allCandidates: this.allCandidates,
      totalGames: this.evaluator.getGamesPlayed(),
      totalTimeMs,
      method: 'evolve',
    };
  }
}
