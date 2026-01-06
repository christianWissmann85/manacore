# Phase 3.0: MCTS Weight Tuning Pipeline

**Status:** Planning Complete, Ready for Implementation
**Created:** January 6, 2026
**Goal:** Create an automated, reproducible pipeline for optimizing MCTS performance

---

## Executive Summary

Phase 3.0 transforms our ad-hoc tuning experiments into a proper ML/AI research pipeline. We adopt **hierarchical tuning**: first optimize evaluation weights via fast GreedyBot proxy, then tune MCTS-specific hyperparameters.

### Key Decisions Made

| Question            | Decision                                                  |
| ------------------- | --------------------------------------------------------- |
| Tuning approach     | Hierarchical: weights first, then MCTS hyperparameters    |
| GreedyBot as proxy? | Yes, with experimental validation                         |
| MCTS fitness target | vs GreedyBot (target: 60%+ win rate)                      |
| Retuning triggers   | Engine changes, evaluation bugs, periodic, pre-experiment |
| Data collection     | Yes, enhanced replay for Phase 4 neural networks          |

---

## Implementation Steps

### Step 1: Weight Storage System

**Goal:** Move hardcoded weights to JSON for dynamic loading and versioning.

#### File Structure

```
packages/ai/
├── data/
│   ├── weights.json              # Current active weights
│   └── weights-history/
│       ├── 2026-01-05-tuned.json # Archived versions
│       └── manifest.json         # History index
```

#### weights.json Schema

```typescript
interface WeightsFile {
  version: string; // Semantic version
  created: string; // ISO date
  source: {
    method: 'local' | 'evolutionary' | 'manual';
    games: number;
    seed: number;
  };
  evaluation: {
    life: number;
    board: number;
    cards: number;
    mana: number;
    tempo: number;
  };
  mcts: {
    explorationConstant: number;
    rolloutDepth: number;
    rolloutPolicy: 'random' | 'greedy' | 'epsilon';
    epsilon?: number;
  };
  performance: {
    vsRandom: number; // Win rate [0,1]
    vsGreedy: number; // Win rate [0,1]
    elo: number; // Elo rating
    gamesPlayed: number;
  };
}
```

#### Implementation Tasks

- [x] Create `packages/ai/data/` directory structure
- [x] Write initial `weights.json` with TUNED_WEIGHTS
- [x] Create `WeightLoader.ts` utility
- [x] Modify `evaluate.ts` to use WeightLoader
- [x] Add fallback to hardcoded defaults if JSON missing
- [x] Create `archiveWeights()` function for history

---

### Step 2: Acceptance Criteria

**Goal:** Define what "better" means with statistical rigor.

#### Validation Requirements

```typescript
interface AcceptanceCriteria {
  // Minimum games for statistical validity
  minGames: 200;

  // Confidence level for comparison
  confidenceLevel: 0.95; // 95% confidence interval

  // Improvement thresholds
  thresholds: {
    vsGreedy: 0.02; // Must be 2% better (absolute)
    vsRandom: 0.01; // Must be 1% better
    eloDelta: 20; // Must gain 20+ Elo points
  };

  // Regression protection
  maxRegression: {
    vsGreedy: 0.01; // Can't lose more than 1%
    vsRandom: 0.005; // Can't lose more than 0.5%
  };
}
```

#### Statistical Validation

```typescript
function validateImprovement(
  oldWeights: WeightsFile,
  newWeights: WeightsFile,
  criteria: AcceptanceCriteria,
): ValidationResult {
  // Wilson score confidence intervals
  const oldCI = wilsonConfidenceInterval(old.vsGreedy, old.gamesPlayed, criteria.confidenceLevel);
  const newCI = wilsonConfidenceInterval(new.vsGreedy, new.gamesPlayed, criteria.confidenceLevel);

  // New lower bound must exceed old upper bound for significance
  const significant = newCI.lower > oldCI.upper;

  // Check improvement exceeds threshold
  const improved = new.vsGreedy - old.vsGreedy >= criteria.thresholds.vsGreedy;

  // Check no regression in other metrics
  const noRegression = old.vsRandom - new.vsRandom <= criteria.maxRegression.vsRandom;

  return {
    accepted: significant && improved && noRegression,
    details: { significant, improved, noRegression, oldCI, newCI },
  };
}
```

#### Implementation Tasks

- [x] Create `packages/ai/src/tuning/AcceptanceCriteria.ts`
- [x] Implement Wilson score confidence interval calculation
- [x] Create `validateImprovement()` function
- [x] Add validation step to tuning workflow
- [x] Create CLI flag `--validate-only` for testing without persisting

---

### Step 3: MCTS Hyperparameter Tuner

**Goal:** Optimize MCTS-specific parameters separately from evaluation weights.

#### Parameters to Tune

| Parameter             | Range      | Default  | Impact                      |
| --------------------- | ---------- | -------- | --------------------------- |
| `explorationConstant` | [0.5, 2.5] | 1.41     | Exploration vs exploitation |
| `rolloutDepth`        | [0, 30]    | 20       | Simulation depth            |
| `rolloutPolicy`       | enum       | 'greedy' | How to simulate             |
| `epsilon`             | [0.0, 0.3] | 0.1      | Random move probability     |

#### Speed Considerations

```
MCTS Tuning Speed Analysis:

Fast mode (mcts-fast, 50 iterations):
- ~0.3 games/sec
- 500 games = 28 minutes
- 2000 games = 2 hours

With 8 parallel workers:
- 500 games = 4 minutes
- 2000 games = 15 minutes ← Acceptable!

Recommendation: Use parallel execution + reduced game count
```

#### Optimization Approaches

**Approach A: Grid Search (Simple)**

```typescript
const grid = {
  explorationConstant: [0.7, 1.0, 1.41, 2.0],
  rolloutDepth: [5, 10, 15, 20],
  rolloutPolicy: ['random', 'greedy', 'epsilon'],
};
// 4 × 4 × 3 = 48 configurations
// 100 games each = 4800 games
// With parallelization: ~2-3 hours
```

**Approach B: Bayesian Optimization (Smart)**

```typescript
// Uses Gaussian Process to model parameter space
// Samples promising regions more densely
// Typically finds good solution in 20-30 evaluations
// 30 × 100 games = 3000 games
// With parallelization: ~1.5 hours
```

**Approach C: Coarse-to-Fine (Practical)**

```typescript
// Round 1: Coarse grid, 50 games each → find promising region
// Round 2: Fine grid in promising region, 100 games each
// Round 3: Validate top 3 with 200 games each
// Total: ~2000 games, ~1 hour with parallelization
```

#### MCTSTuner Architecture

```typescript
interface MCTSTunerConfig {
  // Base MCTS settings
  baseIterations: number; // 50 for fast tuning

  // Search space
  parameterRanges: {
    explorationConstant: [number, number];
    rolloutDepth: [number, number];
    policies: RolloutPolicy[];
    epsilon: [number, number];
  };

  // Evaluation settings
  gamesPerConfig: number; // 100 default
  opponent: 'greedy' | 'random'; // 'greedy' recommended
  maxTurns: number; // 100 default

  // Optimization settings
  method: 'grid' | 'bayesian' | 'coarse-to-fine';
  parallelWorkers: number; // default: CPU count - 1

  // Reproducibility
  seed: number;
}

class MCTSTuner {
  constructor(config: MCTSTunerConfig);

  async tune(
    baseWeights: EvaluationWeights,
    onProgress?: (progress: TuningProgress) => void,
  ): Promise<MCTSTuningResult>;

  async validate(params: MCTSParams, games: number): Promise<ValidationResult>;
}
```

#### Implementation Tasks

- [x] Create `packages/ai/src/tuning/MCTSTuner.ts`
- [x] Implement grid search (simplest first)
- [x] Add parallel game execution via worker threads
- [x] Create parameter space definition
- [x] Implement coarse-to-fine optimization
- [x] (Optional) Add Bayesian optimization
- [x] Add CLI command `bun tune-mcts [options]`

---

### Step 4: Pipeline Script

**Goal:** Single command to run the complete tuning workflow.

#### Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────┐
│                         TUNING PIPELINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Stage 1: BASELINE                                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • Load current weights from weights.json                   │ │
│  │ • Run baseline benchmark (200 games)                       │ │
│  │ • Record: vsRandom, vsGreedy, Elo                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  Stage 2: TUNE EVALUATION WEIGHTS                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • Run LocalSearch or Evolutionary optimizer                │ │
│  │ • Use GreedyBot as proxy (fast)                            │ │
│  │ • Output: candidate evaluation weights                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  Stage 3: TUNE MCTS HYPERPARAMETERS                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • Use new evaluation weights from Stage 2                  │ │
│  │ • Run MCTSTuner with coarse-to-fine search                 │ │
│  │ • Output: optimal {C, depth, policy, epsilon}              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  Stage 4: VALIDATE                                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • Run extended benchmark (500+ games)                      │ │
│  │ • Compare new vs baseline with confidence intervals        │ │
│  │ • Check acceptance criteria                                │ │
│  │ • FAIL if not statistically significant improvement        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  Stage 5: PERSIST (only if validated)                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • Archive current weights.json to history                  │ │
│  │ • Write new weights.json                                   │ │
│  │ • Update version number                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  Stage 6: DOCUMENT                                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • Append entry to TUNING_LOG.md                            │ │
│  │ • Export detailed results to results/tuning/               │ │
│  │ • Print summary to console                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### CLI Interface

```bash
# Full pipeline
bun run pipeline

# With options
bun run pipeline --method evolve --generations 20 --seed 12345

# Skip stages
bun run pipeline --skip-mcts          # Skip MCTS hyperparameter tuning
bun run pipeline --weights-only       # Only tune evaluation weights
bun run pipeline --validate-only      # Just validate current weights

# Dry run
bun run pipeline --dry-run            # Show what would happen

# Force persist (skip validation)
bun run pipeline --force              # Dangerous: persist even if not better
```

#### Pipeline Output

```
══════════════════════════════════════════════════════════════════
                    MCTS TUNING PIPELINE v1.0
══════════════════════════════════════════════════════════════════

Stage 1: Baseline Assessment
────────────────────────────────────────────────────────────────────
  Current weights: v1.2.0 (2026-01-05)
  Running 200 games vs GreedyBot...
  ✓ Baseline: 52.5% ± 3.2% (95% CI)

Stage 2: Evaluation Weight Optimization
────────────────────────────────────────────────────────────────────
  Method: evolutionary (15 generations, population 12)
  [████████████████████████████████████████] 100% | Gen 15/15
  ✓ Best weights found: L=0.29 B=0.48 C=0.09 M=0.08 T=0.06
  ✓ Improvement: +4.2% vs GreedyBot

Stage 3: MCTS Hyperparameter Optimization
────────────────────────────────────────────────────────────────────
  Method: coarse-to-fine (parallel: 7 workers)
  [████████████████████████████████████████] 100% | Config 24/24
  ✓ Best params: C=1.2, depth=12, policy=greedy
  ✓ Improvement: +3.1% vs baseline MCTS

Stage 4: Validation
────────────────────────────────────────────────────────────────────
  Running 500 validation games...
  ✓ New: 59.8% ± 2.1% vs GreedyBot
  ✓ Old: 52.5% ± 3.2% vs GreedyBot
  ✓ Improvement: +7.3% (statistically significant, p < 0.01)
  ✓ ACCEPTED

Stage 5: Persisting
────────────────────────────────────────────────────────────────────
  ✓ Archived: weights-history/2026-01-05-v1.2.0.json
  ✓ Updated: weights.json (v1.3.0)

Stage 6: Documentation
────────────────────────────────────────────────────────────────────
  ✓ Appended to: TUNING_LOG.md
  ✓ Exported to: results/tuning/2026-01-06-pipeline-run.json

══════════════════════════════════════════════════════════════════
                         PIPELINE COMPLETE
══════════════════════════════════════════════════════════════════
  Total time: 47 minutes
  Games played: 8,234
  Result: IMPROVED (+7.3% vs GreedyBot)
══════════════════════════════════════════════════════════════════
```

#### Implementation Tasks

- [x] Create `packages/cli-client/src/commands/pipeline.ts`
- [x] Implement stage orchestration with progress tracking
- [x] Add stage skip/only flags
- [x] Create `TUNING_LOG.md` template and append logic
- [x] Add dry-run mode
- [x] Handle failures gracefully (resume from last stage?)
- [x] Export detailed results JSON

---

### Step 5: Data Collection for ML

**Goal:** Capture training data for Phase 4 neural network evaluation.

#### Data Types to Collect

```typescript
interface TrainingExample {
  // Unique identifier
  id: string;
  gameId: string;

  // State features (input to neural network)
  features: StateFeatures;

  // Labels (what we want to predict)
  labels: {
    outcome: 'win' | 'loss' | 'draw'; // Game result for this player
    turnsRemaining: number; // How many turns until game end
    winProbability: number; // Retrospective: did this player win?
  };

  // Context
  context: {
    turn: number;
    phase: Phase;
    activePlayer: PlayerId;
    actionTaken?: Action; // What happened next
    evaluation: number; // What our evaluator thought
  };
}

interface StateFeatures {
  // Life totals (normalized)
  myLife: number; // 0-1, where 1 = 20 life
  opponentLife: number;

  // Board state
  myCreatureCount: number;
  myTotalPower: number;
  myTotalToughness: number;
  opponentCreatureCount: number;
  opponentTotalPower: number;
  opponentTotalToughness: number;

  // Hand/resources
  myHandSize: number;
  opponentHandSize: number;
  myLandCount: number;
  opponentLandCount: number;
  myUntappedLands: number;

  // Game progress
  turnNumber: number; // Normalized 0-1 (0=early, 1=late)

  // Advanced features (Phase 4.2+)
  // myCreatureTypes: number[];  // One-hot encoding
  // stackSize: number;
  // etc.
}
```

#### Collection Points

```
Game Flow with Data Collection:

┌─────────────────┐
│   Game Start    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────────────────────┐
│  Priority Pass  │ ──► │ COLLECT: state features         │
│  (decision pt)  │     │ Record: turn, phase, board      │
└────────┬────────┘     └─────────────────────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────────────────────┐
│  Action Taken   │ ──► │ COLLECT: action taken           │
│                 │     │ Record: action type, target     │
└────────┬────────┘     └─────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│   Game End      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────────────────────┐
│  Backfill       │ ──► │ UPDATE: all examples with       │
│  Outcomes       │     │ outcome, turns remaining        │
└─────────────────┘     └─────────────────────────────────┘
```

#### Storage Format

```
packages/ai/data/training/
├── manifest.json           # Index of all training files
├── batch-001.jsonl         # JSONL format (one example per line)
├── batch-002.jsonl
└── ...

# JSONL format for easy streaming:
{"id":"g1-t5","features":{...},"labels":{...},"context":{...}}
{"id":"g1-t6","features":{...},"labels":{...},"context":{...}}
```

#### Collection Configuration

```typescript
interface DataCollectionConfig {
  // What to collect
  collectEveryNTurns: number; // 1 = every turn, 2 = every other
  collectPhases: Phase[]; // ['main1', 'combat', 'main2']

  // Storage
  outputDir: string; // 'packages/ai/data/training'
  batchSize: number; // Examples per file (10000)
  format: 'jsonl' | 'parquet'; // JSONL for simplicity

  // Filtering
  minTurns: number; // Skip very short games
  maxTurns: number; // Skip stalled games

  // Sampling
  sampleRate: number; // 1.0 = all, 0.1 = 10%
}
```

#### Enhanced Replay Format

```typescript
interface EnhancedReplayFile extends ReplayFile {
  // Existing fields...

  // NEW: Training data
  trainingExamples: TrainingExample[];

  // NEW: Evaluation history
  evaluations: {
    turn: number;
    phase: Phase;
    player: PlayerId;
    score: number; // What evaluate() returned
    features: StateFeatures;
  }[];
}
```

#### Implementation Tasks

- [x] Create `packages/ai/src/training/StateFeatureExtractor.ts`
- [x] Create `packages/ai/src/training/TrainingDataCollector.ts`
- [x] Create `packages/ai/src/training/types.ts`
- [x] Enhance `ReplayRecorder` to capture evaluations
- [x] Add `--collect-training-data` flag to simulate command
- [x] Create batch writing logic (JSONL format)
- [x] Add manifest management
- [x] Create data validation/statistics tool

---

## Implementation Order

```
Week 1: Foundation
├── Step 1: Weight Storage (2-3 hours)
│   └── JSON structure, loader, evaluate.ts integration
├── Step 2: Acceptance Criteria (2-3 hours)
│   └── Wilson intervals, validation logic
└── Test: Verify weights load correctly, validation works

Week 2: MCTS Tuning
├── Step 3: MCTSTuner (4-6 hours)
│   ├── Grid search implementation
│   ├── Parallel execution
│   └── CLI integration
└── Test: Run sample tuning, verify results

Week 3: Pipeline & Data
├── Step 4: Pipeline Script (3-4 hours)
│   └── Stage orchestration, logging, persistence
├── Step 5: Data Collection (3-4 hours)
│   └── Feature extraction, JSONL writing
└── Test: Full pipeline run, verify data output

Week 4: Validation & Documentation
├── Run comprehensive tuning session
├── Validate improvements
├── Update ROADMAP.md
└── Write research notes
```

---

## Success Criteria

Phase 3.0 is complete when:

- [ ] `bun run pipeline` executes end-to-end without errors
- [ ] Weights are stored in JSON and loaded dynamically
- [ ] MCTS hyperparameters are tunable via CLI
- [ ] Statistical validation prevents regression
- [ ] Training data is collected for Phase 4
- [ ] MCTSBot achieves 60%+ vs GreedyBot
- [ ] All tuning runs are reproducible via seed
- [ ] TUNING_LOG.md documents all tuning sessions

--

## Appendix: File Locations

| Component           | Location                                            |
| ------------------- | --------------------------------------------------- |
| Weight storage      | `packages/ai/data/weights.json`                     |
| Weight history      | `packages/ai/data/weights-history/`                 |
| Weight loader       | `packages/ai/src/weights/WeightLoader.ts`           |
| Acceptance criteria | `packages/ai/src/tuning/AcceptanceCriteria.ts`      |
| MCTS tuner          | `packages/ai/src/tuning/MCTSTuner.ts`               |
| Pipeline command    | `packages/cli-client/src/commands/pipeline.ts`      |
| Feature extractor   | `packages/ai/src/training/StateFeatureExtractor.ts` |
| Training collector  | `packages/ai/src/training/TrainingDataCollector.ts` |
| Training data       | `packages/ai/data/training/`                        |
| Tuning log          | `packages/ai/docs/TUNING_LOG.md`                    |

---

_Document created: January 6, 2026_
_Ready for implementation!_
