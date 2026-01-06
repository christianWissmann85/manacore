/**
 * Tuning Pipeline Command
 *
 * Orchestrates the complete tuning workflow:
 * 1. Baseline - Assess current weights performance
 * 2. Tune Weights - Optimize evaluation weights via GreedyBot proxy
 * 3. Tune MCTS - Optimize MCTS hyperparameters
 * 4. Validate - Statistical validation of improvements
 * 5. Persist - Save to weights.json if accepted
 * 6. Document - Append to TUNING_LOG.md
 */

import {
  // Weight tuning
  LocalSearchOptimizer,
  EvolutionaryOptimizer,
  FitnessEvaluator,
  DEFAULT_WEIGHTS,
  type OptimizationResult,
  type EvaluationWeights,
  // MCTS tuning
  MCTSTuner,
  type MCTSTuningResult,
  // Validation
  validateImprovement,
  formatValidationResult,
  DEFAULT_ACCEPTANCE_CONFIG,
  RELAXED_ACCEPTANCE_CONFIG,
  type AcceptanceCriteriaConfig,
  // Weight storage
  loadWeights,
  saveWeights,
  bumpVersion,
  type WeightsFile,
  type PerformanceMetrics,
} from '@manacore/ai';
import { existsSync, appendFileSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { getTuningPaths } from '../output/paths';

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Seed for reproducibility */
  seed: number;

  /** Weight tuning method */
  weightMethod: 'local' | 'evolve';

  /** Generations for weight tuning */
  weightGenerations: number;

  /** Games per weight evaluation */
  weightGamesVsRandom: number;
  weightGamesVsGreedy: number;

  /** MCTS tuning method */
  mctsMethod: 'grid' | 'coarse-to-fine';

  /** Games per MCTS config */
  mctsGamesPerConfig: number;

  /** MCTS iterations during tuning */
  mctsTuningIterations: number;

  /** Validation games */
  validationGames: number;

  /** Acceptance criteria level */
  acceptanceLevel: 'relaxed' | 'default' | 'strict';

  /** Skip stages */
  skipWeights: boolean;
  skipMCTS: boolean;
  skipValidation: boolean;

  /** Force persist even if validation fails */
  force: boolean;

  /** Dry run - show what would happen */
  dryRun: boolean;

  /** Verbose output */
  verbose: boolean;
}

/**
 * Default pipeline configuration
 */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  seed: Date.now(),
  weightMethod: 'local',
  weightGenerations: 10,
  weightGamesVsRandom: 30,
  weightGamesVsGreedy: 20,
  mctsMethod: 'coarse-to-fine',
  mctsGamesPerConfig: 30,
  mctsTuningIterations: 50,
  validationGames: 200,
  acceptanceLevel: 'default',
  skipWeights: false,
  skipMCTS: false,
  skipValidation: false,
  force: false,
  dryRun: false,
  verbose: false,
};

/**
 * Pipeline stage result
 */
interface StageResult {
  success: boolean;
  message: string;
  data?: unknown;
  durationMs: number;
}

/**
 * Full pipeline result
 */
export interface PipelineResult {
  stages: {
    baseline?: StageResult;
    weights?: StageResult;
    mcts?: StageResult;
    validate?: StageResult;
    persist?: StageResult;
    document?: StageResult;
  };
  totalGamesPlayed: number;
  totalDurationMs: number;
  accepted: boolean;
  newVersion?: string;
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

/**
 * Print stage header
 */
function printStageHeader(stage: number, name: string): void {
  console.log('');
  console.log(`Stage ${stage}: ${name}`);
  console.log('─'.repeat(68));
}

/**
 * Print stage result
 */
function printStageResult(result: StageResult): void {
  const icon = result.success ? '✓' : '✗';
  console.log(`  ${icon} ${result.message} (${formatDuration(result.durationMs)})`);
}

/**
 * Get acceptance criteria config based on level
 */
function getAcceptanceCriteria(level: string): AcceptanceCriteriaConfig {
  switch (level) {
    case 'relaxed':
      return RELAXED_ACCEPTANCE_CONFIG;
    case 'strict':
      return {
        ...DEFAULT_ACCEPTANCE_CONFIG,
        minGames: 500,
        confidenceLevel: 0.99,
        thresholds: {
          ...DEFAULT_ACCEPTANCE_CONFIG.thresholds,
          vsGreedyImprovement: 0.03,
        },
      };
    default:
      return DEFAULT_ACCEPTANCE_CONFIG;
  }
}

/**
 * Run the complete tuning pipeline
 */
export async function runPipeline(config: Partial<PipelineConfig> = {}): Promise<PipelineResult> {
  const cfg = { ...DEFAULT_PIPELINE_CONFIG, ...config };
  const startTime = performance.now();
  let totalGamesPlayed = 0;

  const result: PipelineResult = {
    stages: {},
    totalGamesPlayed: 0,
    totalDurationMs: 0,
    accepted: false,
  };

  // Print header
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('                    MCTS TUNING PIPELINE v1.0');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Seed: ${cfg.seed}`);
  console.log(`  Weight Method: ${cfg.weightMethod}`);
  console.log(`  MCTS Method: ${cfg.mctsMethod}`);
  console.log(`  Acceptance Level: ${cfg.acceptanceLevel}`);
  if (cfg.skipWeights) console.log('  ⚠️  Skipping weight tuning');
  if (cfg.skipMCTS) console.log('  ⚠️  Skipping MCTS tuning');
  if (cfg.skipValidation) console.log('  ⚠️  Skipping validation');
  if (cfg.dryRun) console.log('  🔍 DRY RUN - no changes will be saved');
  console.log('');

  // Load current weights
  const currentWeights = loadWeights();
  console.log(`  Current weights version: ${currentWeights.version}`);
  console.log('');

  // ========== STAGE 1: BASELINE ==========
  printStageHeader(1, 'Baseline Assessment');
  const baselineStart = performance.now();

  let baselineMetrics: PerformanceMetrics;
  if (cfg.dryRun) {
    baselineMetrics = currentWeights.performance;
    result.stages.baseline = {
      success: true,
      message: `Baseline from weights.json: ${(baselineMetrics.vsGreedy * 100).toFixed(1)}% vs GreedyBot`,
      durationMs: performance.now() - baselineStart,
    };
  } else {
    const evaluator = new FitnessEvaluator({
      gamesVsRandom: Math.min(50, cfg.weightGamesVsRandom),
      gamesVsGreedy: Math.min(30, cfg.weightGamesVsGreedy),
      seed: cfg.seed,
    });

    const baselineFitness = evaluator.evaluate(currentWeights.evaluation);
    totalGamesPlayed += evaluator.getGamesPlayed();

    baselineMetrics = {
      vsRandom: baselineFitness.vsRandom,
      vsGreedy: baselineFitness.vsGreedy,
      elo: baselineFitness.elo,
      gamesPlayed: baselineFitness.gamesPlayed,
    };

    result.stages.baseline = {
      success: true,
      message: `Baseline: ${(baselineMetrics.vsGreedy * 100).toFixed(1)}% vs GreedyBot (${baselineMetrics.gamesPlayed} games)`,
      data: baselineMetrics,
      durationMs: performance.now() - baselineStart,
    };
  }
  printStageResult(result.stages.baseline);

  // ========== STAGE 2: TUNE WEIGHTS ==========
  let newWeights: EvaluationWeights = currentWeights.evaluation;
  let weightResult: OptimizationResult | null = null;

  if (!cfg.skipWeights) {
    printStageHeader(2, 'Evaluation Weight Optimization');
    const weightsStart = performance.now();

    if (cfg.dryRun) {
      result.stages.weights = {
        success: true,
        message: 'Would run weight optimization (dry run)',
        durationMs: performance.now() - weightsStart,
      };
    } else {
      const optimizerConfig = {
        fitness: {
          gamesVsRandom: cfg.weightGamesVsRandom,
          gamesVsGreedy: cfg.weightGamesVsGreedy,
          tournamentGames: 10,
          maxTurns: 100,
          seed: cfg.seed + 10000,
        },
        generations: cfg.weightGenerations,
        populationSize: 10,
        mutationRate: 0.3,
        mutationStrength: 0.15,
        verbose: cfg.verbose,
      };

      let lastProgress = 0;
      const progressCallback = (progress: { gamesCompleted: number; totalGames: number }) => {
        const pct = Math.floor((progress.gamesCompleted / progress.totalGames) * 100);
        if (pct >= lastProgress + 10) {
          process.stdout.write(`  Progress: ${pct}%\r`);
          lastProgress = pct;
        }
      };

      if (cfg.weightMethod === 'local') {
        const optimizer = new LocalSearchOptimizer(optimizerConfig);
        weightResult = optimizer.optimize(DEFAULT_WEIGHTS, progressCallback);
      } else {
        const optimizer = new EvolutionaryOptimizer(optimizerConfig);
        weightResult = optimizer.optimize(DEFAULT_WEIGHTS, progressCallback);
      }

      newWeights = weightResult.bestWeights;
      totalGamesPlayed += weightResult.totalGames;

      const improvement = weightResult.bestFitness.vsGreedy - weightResult.baselineFitness.vsGreedy;
      result.stages.weights = {
        success: true,
        message: `Best: ${(weightResult.bestFitness.vsGreedy * 100).toFixed(1)}% vs GreedyBot (${improvement >= 0 ? '+' : ''}${(improvement * 100).toFixed(1)}%)`,
        data: weightResult,
        durationMs: performance.now() - weightsStart,
      };
    }
    if (result.stages.weights) {
      printStageResult(result.stages.weights);
    }
  }

  // ========== STAGE 3: TUNE MCTS ==========
  let mctsResult: MCTSTuningResult | null = null;

  if (!cfg.skipMCTS) {
    printStageHeader(3, 'MCTS Hyperparameter Optimization');
    const mctsStart = performance.now();

    if (cfg.dryRun) {
      result.stages.mcts = {
        success: true,
        message: 'Would run MCTS optimization (dry run)',
        durationMs: performance.now() - mctsStart,
      };
    } else {
      const tuner = new MCTSTuner({
        gamesPerConfig: cfg.mctsGamesPerConfig,
        validationGames: cfg.validationGames,
        maxTurns: 100,
        seed: cfg.seed + 20000,
        method: cfg.mctsMethod,
        tuningIterations: cfg.mctsTuningIterations,
      });

      let lastProgress = 0;
      mctsResult = tuner.tune((progress) => {
        const pct = Math.floor((progress.currentGames / Math.max(1, progress.totalGames)) * 100);
        if (pct >= lastProgress + 10) {
          process.stdout.write(`  Progress: ${pct}% (${progress.phase})\r`);
          lastProgress = pct;
        }
      });

      totalGamesPlayed += mctsResult.totalGamesPlayed;

      result.stages.mcts = {
        success: true,
        message: `Best: C=${mctsResult.bestParams.explorationConstant} D=${mctsResult.bestParams.rolloutDepth} P=${mctsResult.bestParams.rolloutPolicy} → ${(mctsResult.bestResult.winRate * 100).toFixed(1)}%`,
        data: mctsResult,
        durationMs: performance.now() - mctsStart,
      };
    }
    if (result.stages.mcts) {
      printStageResult(result.stages.mcts);
    }
  }

  // ========== STAGE 4: VALIDATE ==========
  let validationPassed = false;

  if (cfg.dryRun && !cfg.skipValidation) {
    // In dry-run mode, assume validation would pass
    printStageHeader(4, 'Validation');
    result.stages.validate = {
      success: true,
      message: 'Would run validation (dry run)',
      durationMs: 0,
    };
    printStageResult(result.stages.validate);
    validationPassed = true;
  } else if (!cfg.skipValidation && (weightResult || mctsResult)) {
    printStageHeader(4, 'Validation');
    const validateStart = performance.now();

    // Get new metrics (use MCTS result if available, otherwise weight result)
    const newMetrics: PerformanceMetrics = mctsResult
      ? {
          vsRandom: 0.8, // Placeholder
          vsGreedy: mctsResult.bestResult.winRate,
          elo: 1500 + (mctsResult.bestResult.winRate - 0.5) * 600,
          gamesPlayed: mctsResult.totalGamesPlayed,
        }
      : weightResult
        ? {
            vsRandom: weightResult.bestFitness.vsRandom,
            vsGreedy: weightResult.bestFitness.vsGreedy,
            elo: weightResult.bestFitness.elo,
            gamesPlayed: weightResult.totalGames,
          }
        : baselineMetrics;

    const criteria = getAcceptanceCriteria(cfg.acceptanceLevel);
    const validation = validateImprovement(baselineMetrics, newMetrics, criteria);

    validationPassed = validation.accepted;

    if (cfg.verbose) {
      console.log(formatValidationResult(validation));
    }

    result.stages.validate = {
      success: validation.accepted,
      message: validation.summary,
      data: validation,
      durationMs: performance.now() - validateStart,
    };
    if (result.stages.validate) {
      printStageResult(result.stages.validate);
    }
  } else if (cfg.skipValidation) {
    validationPassed = true; // Skip means accept
  }

  // ========== STAGE 5: PERSIST ==========
  const shouldPersist = validationPassed || cfg.force;
  const hasResults = weightResult || mctsResult;

  if (cfg.dryRun && shouldPersist) {
    // In dry-run mode, show what would happen
    printStageHeader(5, 'Persisting');
    const newVersion = bumpVersion(currentWeights.version);
    result.stages.persist = {
      success: true,
      message: `Would save as v${newVersion} (dry run)`,
      durationMs: 0,
    };
    printStageResult(result.stages.persist);
    result.newVersion = newVersion;
    result.accepted = true;
  } else if (shouldPersist && hasResults) {
    printStageHeader(5, 'Persisting');
    const persistStart = performance.now();

    const newVersion = bumpVersion(currentWeights.version);

    const newWeightsFile: WeightsFile = {
      ...currentWeights,
      version: newVersion,
      created: new Date().toISOString(),
      description: `Pipeline tuning run (${totalGamesPlayed} games)`,
      source: {
        method: cfg.skipWeights
          ? 'mcts-tuned'
          : cfg.weightMethod === 'evolve'
            ? 'evolutionary'
            : cfg.weightMethod,
        games: totalGamesPlayed,
        seed: cfg.seed,
      },
      evaluation: newWeights,
      mcts: mctsResult
        ? {
            explorationConstant: mctsResult.bestParams.explorationConstant,
            rolloutDepth: mctsResult.bestParams.rolloutDepth,
            rolloutPolicy: mctsResult.bestParams.rolloutPolicy,
            epsilon: mctsResult.bestParams.epsilon,
          }
        : currentWeights.mcts,
      performance: {
        vsRandom: weightResult?.bestFitness.vsRandom ?? currentWeights.performance.vsRandom,
        vsGreedy:
          mctsResult?.bestResult.winRate ??
          weightResult?.bestFitness.vsGreedy ??
          currentWeights.performance.vsGreedy,
        elo: weightResult?.bestFitness.elo ?? currentWeights.performance.elo,
        gamesPlayed: currentWeights.performance.gamesPlayed + totalGamesPlayed,
      },
    };

    saveWeights(newWeightsFile);

    // Also copy to output/tuning/ for centralized output organization
    const tuningPaths = getTuningPaths();
    try {
      copyFileSync(tuningPaths.aiWeightsJson, tuningPaths.weightsJson);
    } catch {
      // Non-fatal - ai package location is the primary one
    }

    result.stages.persist = {
      success: true,
      message: `Saved weights.json v${newVersion}`,
      durationMs: performance.now() - persistStart,
    };
    result.newVersion = newVersion;
    printStageResult(result.stages.persist);
    result.accepted = true;
  } else if (!shouldPersist) {
    result.stages.persist = {
      success: false,
      message: 'Not persisting - validation failed',
      durationMs: 0,
    };
    printStageHeader(5, 'Persisting');
    printStageResult(result.stages.persist);
  }

  // ========== STAGE 6: DOCUMENT ==========
  if (cfg.dryRun && shouldPersist) {
    printStageHeader(6, 'Documentation');
    result.stages.document = {
      success: true,
      message: 'Would append to TUNING_LOG.md (dry run)',
      durationMs: 0,
    };
    printStageResult(result.stages.document);
  } else if (shouldPersist && hasResults) {
    printStageHeader(6, 'Documentation');
    const docStart = performance.now();

    try {
      appendToTuningLog(cfg, result, weightResult, mctsResult, baselineMetrics);
      result.stages.document = {
        success: true,
        message: 'Appended to TUNING_LOG.md',
        durationMs: performance.now() - docStart,
      };
    } catch (error) {
      result.stages.document = {
        success: false,
        message: `Failed to update log: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: performance.now() - docStart,
      };
    }
    printStageResult(result.stages.document);
  }

  // ========== SUMMARY ==========
  result.totalGamesPlayed = totalGamesPlayed;
  result.totalDurationMs = performance.now() - startTime;

  console.log('');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('                         PIPELINE COMPLETE');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`  Total time: ${formatDuration(result.totalDurationMs)}`);
  console.log(`  Games played: ${totalGamesPlayed}`);
  console.log(`  Result: ${result.accepted ? '✓ IMPROVED' : '✗ NO CHANGE'}`);
  if (result.newVersion) {
    console.log(`  New version: ${result.newVersion}`);
  }
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('');

  return result;
}

/**
 * Append entry to TUNING_LOG.md
 */
function appendToTuningLog(
  config: PipelineConfig,
  result: PipelineResult,
  weightResult: OptimizationResult | null,
  mctsResult: MCTSTuningResult | null,
  baseline: PerformanceMetrics,
): void {
  const logPath = join(__dirname, '..', '..', '..', 'ai', 'docs', 'TUNING_LOG.md');

  // Create file if it doesn't exist
  if (!existsSync(logPath)) {
    const dir = dirname(logPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const header = `# Tuning Log

This file records all tuning runs from the pipeline.

---

`;
    appendFileSync(logPath, header);
  }

  // Build entry
  const date = new Date().toISOString().split('T')[0];
  const lines: string[] = [];

  lines.push(`## ${date} - v${result.newVersion}`);
  lines.push('');
  lines.push(`**Seed:** ${config.seed}`);
  lines.push(`**Duration:** ${formatDuration(result.totalDurationMs)}`);
  lines.push(`**Games:** ${result.totalGamesPlayed}`);
  lines.push('');

  // Baseline
  lines.push('### Baseline');
  lines.push(`- vs GreedyBot: ${(baseline.vsGreedy * 100).toFixed(1)}%`);
  lines.push(`- vs RandomBot: ${(baseline.vsRandom * 100).toFixed(1)}%`);
  lines.push('');

  // Weight tuning
  if (weightResult) {
    lines.push('### Weight Tuning');
    lines.push(`- Method: ${config.weightMethod}`);
    lines.push(`- Generations: ${config.weightGenerations}`);
    lines.push('- Best weights:');
    lines.push(`  - life: ${weightResult.bestWeights.life.toFixed(4)}`);
    lines.push(`  - board: ${weightResult.bestWeights.board.toFixed(4)}`);
    lines.push(`  - cards: ${weightResult.bestWeights.cards.toFixed(4)}`);
    lines.push(`  - mana: ${weightResult.bestWeights.mana.toFixed(4)}`);
    lines.push(`  - tempo: ${weightResult.bestWeights.tempo.toFixed(4)}`);
    lines.push(`- vs GreedyBot: ${(weightResult.bestFitness.vsGreedy * 100).toFixed(1)}%`);
    lines.push('');
  }

  // MCTS tuning
  if (mctsResult) {
    lines.push('### MCTS Tuning');
    lines.push(`- Method: ${config.mctsMethod}`);
    lines.push(`- Best params:`);
    lines.push(`  - C: ${mctsResult.bestParams.explorationConstant}`);
    lines.push(`  - Depth: ${mctsResult.bestParams.rolloutDepth}`);
    lines.push(`  - Policy: ${mctsResult.bestParams.rolloutPolicy}`);
    lines.push(`- Win rate: ${(mctsResult.bestResult.winRate * 100).toFixed(1)}%`);
    lines.push('');
  }

  // Result
  lines.push('### Result');
  lines.push(`- **${result.accepted ? 'ACCEPTED' : 'REJECTED'}**`);
  lines.push('');
  lines.push('---');
  lines.push('');

  appendFileSync(logPath, lines.join('\n'));
}

/**
 * Parse command line arguments
 */
export function parsePipelineArgs(args: string[]): Partial<PipelineConfig> {
  const config: Partial<PipelineConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--seed':
        config.seed = parseInt(args[++i] || String(Date.now()), 10);
        break;
      case '--weight-method': {
        const wm = args[++i];
        if (wm === 'local' || wm === 'evolve') {
          config.weightMethod = wm;
        }
        break;
      }
      case '--mcts-method': {
        const mm = args[++i];
        if (mm === 'grid' || mm === 'coarse-to-fine') {
          config.mctsMethod = mm;
        }
        break;
      }
      case '--generations':
        config.weightGenerations = parseInt(args[++i] || '10', 10);
        break;
      case '--games': {
        const games = parseInt(args[++i] || '30', 10);
        config.weightGamesVsGreedy = games;
        config.mctsGamesPerConfig = games;
        break;
      }
      case '--validation':
        config.validationGames = parseInt(args[++i] || '200', 10);
        break;
      case '--acceptance': {
        const level = args[++i];
        if (level === 'relaxed' || level === 'default' || level === 'strict') {
          config.acceptanceLevel = level;
        }
        break;
      }
      case '--skip-weights':
        config.skipWeights = true;
        break;
      case '--skip-mcts':
        config.skipMCTS = true;
        break;
      case '--skip-validation':
        config.skipValidation = true;
        break;
      case '--weights-only':
        config.skipMCTS = true;
        break;
      case '--mcts-only':
        config.skipWeights = true;
        break;
      case '--force':
        config.force = true;
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
    }
  }

  return config;
}
