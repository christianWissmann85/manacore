/**
 * LocalSearchOptimizer - Hill climbing weight optimization
 *
 * Starts from current weights and iteratively improves by:
 * 1. Perturbing one weight at a time
 * 2. Keeping changes that improve fitness
 * 3. Reducing step size when no improvement found
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

const DEFAULT_LOCAL_CONFIG: OptimizerConfig = {
  fitness: {
    gamesVsRandom: 30,
    gamesVsGreedy: 20,
    tournamentGames: 10,
    maxTurns: 100,
    seed: Date.now(),
  },
  generations: 20, // Number of improvement rounds
  populationSize: 1, // Not used for local search
  mutationRate: 1.0, // Always mutate in local search
  mutationStrength: 0.15, // Initial perturbation amount (±15%)
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
 * Perturb a single weight
 */
function perturbWeight(
  weights: EvaluationWeights,
  key: keyof EvaluationWeights,
  amount: number,
): EvaluationWeights {
  const newWeights = { ...weights };
  const current = newWeights[key];
  const delta = current * amount;

  // Apply perturbation (ensure non-negative)
  newWeights[key] = Math.max(0.01, current + delta);

  return normalizeWeights(newWeights);
}

export class LocalSearchOptimizer {
  private config: OptimizerConfig;
  private evaluator: FitnessEvaluator;
  private allCandidates: WeightCandidate[] = [];
  private startTime = 0;

  constructor(config: Partial<OptimizerConfig> = {}) {
    this.config = {
      ...DEFAULT_LOCAL_CONFIG,
      ...config,
      fitness: { ...DEFAULT_LOCAL_CONFIG.fitness, ...config.fitness },
    };
    this.evaluator = new FitnessEvaluator(this.config.fitness);
  }

  /**
   * Run local search optimization
   */
  optimize(
    startWeights: EvaluationWeights = DEFAULT_WEIGHTS,
    onProgress?: ProgressCallback,
  ): OptimizationResult {
    this.startTime = performance.now();
    this.allCandidates = [];
    this.evaluator.resetGamesPlayed();

    // Evaluate baseline
    let current = createCandidate(startWeights, 0);
    current.fitness = this.evaluator.evaluate(current.weights);
    this.allCandidates.push(current);

    const baselineFitness = current.fitness;
    let best = current;

    // Weight keys to optimize
    const weightKeys: (keyof EvaluationWeights)[] = ['life', 'board', 'cards', 'mana', 'tempo'];

    // Step sizes for each weight (starts at mutationStrength)
    const stepSizes = new Map<keyof EvaluationWeights, number>();
    for (const key of weightKeys) {
      stepSizes.set(key, this.config.mutationStrength);
    }

    // Minimum step size before giving up on a weight
    const minStepSize = 0.02;

    // Track total games for progress
    const gamesPerEval = this.config.fitness.gamesVsRandom + this.config.fitness.gamesVsGreedy;
    const estimatedTotalGames =
      gamesPerEval * (1 + this.config.generations * weightKeys.length * 2);

    for (let gen = 0; gen < this.config.generations; gen++) {
      let improved = false;

      // Try each weight
      for (const key of weightKeys) {
        const stepSize = stepSizes.get(key)!;
        if (stepSize < minStepSize) continue;

        // Try +step
        const plusWeights = perturbWeight(current.weights, key, stepSize);
        const plusCandidate = createCandidate(plusWeights, gen + 1);
        plusCandidate.fitness = this.evaluator.evaluate(plusCandidate.weights);
        this.allCandidates.push(plusCandidate);

        // Try -step
        const minusWeights = perturbWeight(current.weights, key, -stepSize);
        const minusCandidate = createCandidate(minusWeights, gen + 1);
        minusCandidate.fitness = this.evaluator.evaluate(minusCandidate.weights);
        this.allCandidates.push(minusCandidate);

        // Check for improvement
        const currentFitness = current.fitness!.combined;
        const plusFitness = plusCandidate.fitness.combined;
        const minusFitness = minusCandidate.fitness.combined;

        if (plusFitness > currentFitness && plusFitness >= minusFitness) {
          current = plusCandidate;
          improved = true;
          if (plusFitness > best.fitness!.combined) {
            best = plusCandidate;
          }
        } else if (minusFitness > currentFitness) {
          current = minusCandidate;
          improved = true;
          if (minusFitness > best.fitness!.combined) {
            best = minusCandidate;
          }
        } else {
          // No improvement - reduce step size for this weight
          stepSizes.set(key, stepSize * 0.7);
        }

        // Report progress
        if (onProgress) {
          const elapsed = performance.now() - this.startTime;
          const gamesPlayed = this.evaluator.getGamesPlayed();
          const gamesPerSecond = gamesPlayed / (elapsed / 1000);
          const remainingGames = estimatedTotalGames - gamesPlayed;
          const etaSeconds = remainingGames / gamesPerSecond;

          onProgress({
            generation: gen + 1,
            totalGenerations: this.config.generations,
            gamesCompleted: gamesPlayed,
            totalGames: estimatedTotalGames,
            bestCandidate: best,
            improvement: {
              vsRandom: (best.fitness!.vsRandom - baselineFitness.vsRandom) * 100,
              vsGreedy: (best.fitness!.vsGreedy - baselineFitness.vsGreedy) * 100,
            },
            gamesPerSecond,
            etaSeconds: Math.max(0, etaSeconds),
            phase: `Gen ${gen + 1}: ${improved ? 'Improved!' : 'Exploring'} (${key})`,
          });
        }
      }

      // If no weight improved this generation, we may be at a local optimum
      // Double-check with smaller steps
      if (!improved) {
        let anyStepLeft = false;
        for (const key of weightKeys) {
          if (stepSizes.get(key)! >= minStepSize) {
            anyStepLeft = true;
            break;
          }
        }
        if (!anyStepLeft) {
          // All step sizes exhausted - we're done
          break;
        }
      }
    }

    // Sort all candidates by fitness
    this.allCandidates.sort((a, b) => {
      if (!a.fitness || !b.fitness) return 0;
      return b.fitness.combined - a.fitness.combined;
    });

    const totalTimeMs = performance.now() - this.startTime;

    return {
      bestWeights: best.weights,
      bestFitness: best.fitness!,
      baselineWeights: normalizeWeights(startWeights),
      baselineFitness,
      allCandidates: this.allCandidates,
      totalGames: this.evaluator.getGamesPlayed(),
      totalTimeMs,
      method: 'local',
    };
  }
}
