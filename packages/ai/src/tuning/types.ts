/**
 * Weight Tuning Types
 *
 * Interfaces for self-play weight optimization.
 */

import type { EvaluationWeights } from '../evaluation/evaluate';

/**
 * Fitness scores from evaluating a weight configuration
 */
export interface FitnessScores {
  /** Win rate vs RandomBot [0, 1] */
  vsRandom: number;
  /** Win rate vs GreedyBot [0, 1] */
  vsGreedy: number;
  /** Tournament Elo rating */
  elo: number;
  /** Combined fitness score [0, 1] */
  combined: number;
  /** Number of games played for this evaluation */
  gamesPlayed: number;
}

/**
 * A weight configuration with its fitness scores
 */
export interface WeightCandidate {
  /** The weights being evaluated */
  weights: EvaluationWeights;
  /** Fitness scores (null if not yet evaluated) */
  fitness: FitnessScores | null;
  /** Generation this candidate was created */
  generation: number;
  /** Unique ID for tracking */
  id: string;
}

/**
 * Deck tier weights for AI training (re-exported from engine)
 */
export interface DeckTierWeights {
  mono: number;
  twoColor: number;
  competitive: number;
  special: number;
}

/**
 * Configuration for the fitness evaluator
 */
export interface FitnessConfig {
  /** Games to play vs RandomBot */
  gamesVsRandom: number;
  /** Games to play vs GreedyBot */
  gamesVsGreedy: number;
  /** Games for head-to-head tournament (per matchup) */
  tournamentGames: number;
  /** Max turns per game */
  maxTurns: number;
  /** Base seed for reproducibility */
  seed: number;
  /** Deck selection weights (optional - defaults to uniform) */
  deckWeights?: DeckTierWeights;
}

/**
 * Configuration for optimizers
 */
export interface OptimizerConfig {
  /** Fitness evaluation config */
  fitness: FitnessConfig;
  /** Number of generations (for evolutionary) */
  generations: number;
  /** Population size (for evolutionary) */
  populationSize: number;
  /** Mutation rate [0, 1] */
  mutationRate: number;
  /** Mutation strength (how much to perturb) */
  mutationStrength: number;
  /** Enable verbose logging */
  verbose: boolean;
}

/**
 * Progress update from optimizer
 */
export interface OptimizationProgress {
  /** Current generation */
  generation: number;
  /** Total generations */
  totalGenerations: number;
  /** Games completed */
  gamesCompleted: number;
  /** Total games to play */
  totalGames: number;
  /** Current best candidate */
  bestCandidate: WeightCandidate | null;
  /** Improvement from baseline */
  improvement: {
    vsRandom: number;
    vsGreedy: number;
  };
  /** Games per second */
  gamesPerSecond: number;
  /** Estimated time remaining (seconds) */
  etaSeconds: number;
  /** Current phase description */
  phase: string;
}

/**
 * Result of optimization run
 */
export interface OptimizationResult {
  /** Best weights found */
  bestWeights: EvaluationWeights;
  /** Fitness scores of best weights */
  bestFitness: FitnessScores;
  /** Baseline (starting) weights */
  baselineWeights: EvaluationWeights;
  /** Baseline fitness scores */
  baselineFitness: FitnessScores;
  /** All candidates evaluated (sorted by fitness) */
  allCandidates: WeightCandidate[];
  /** Total games played */
  totalGames: number;
  /** Total time in milliseconds */
  totalTimeMs: number;
  /** Optimization method used */
  method: 'local' | 'evolve';
}

/**
 * Callback for progress updates
 */
export type ProgressCallback = (progress: OptimizationProgress) => void;

/**
 * Default fitness config
 */
export const DEFAULT_FITNESS_CONFIG: FitnessConfig = {
  gamesVsRandom: 50,
  gamesVsGreedy: 30,
  tournamentGames: 20,
  maxTurns: 100,
  seed: Date.now(),
};

/**
 * Default optimizer config
 */
export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = {
  fitness: DEFAULT_FITNESS_CONFIG,
  generations: 20,
  populationSize: 10,
  mutationRate: 0.3,
  mutationStrength: 0.15,
  verbose: false,
};
