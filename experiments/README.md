# ManaCore Experiments

Configuration-based experiment runner for reproducible AI research.

## Quick Start

```bash
# From packages/cli-client/
bun src/index.ts run ../../experiments/simulate-mcts-vs-greedy.json
```

## Why Config Files?

- **Reproducible**: Configs document exactly what ran
- **No flag memorization**: JSON schema is self-documenting
- **Shareable**: Commit experiments to git
- **Paper-ready**: Cite exact config used for results

## Available Templates

| Template                       | Command      | Description                        |
| ------------------------------ | ------------ | ---------------------------------- |
| `simulate-mcts-vs-greedy.json` | simulate     | Bot vs bot simulation              |
| `benchmark-all-bots.json`      | benchmark    | Multi-bot comparison matrix        |
| `baseline-all-decks.json`      | (script)     | All decks baseline (see below)     |
| `tune-weights-evolve.json`     | tune-weights | Evaluation weight optimization     |
| `tune-mcts-grid.json`          | tune-mcts    | MCTS hyperparameter tuning         |
| `pipeline-full.json`           | pipeline     | Complete tuning workflow           |
| `collect-training-fast.json`   | collect      | ML training data (fast, GreedyBot) |
| `collect-training-mcts.json`   | collect      | ML training data (MCTS quality)    |
| `replay-game.json`             | replay       | Replay specific games              |

---

## Special: Deck Baseline Benchmark

The `baseline-all-decks.json` configuration documents a comprehensive deck benchmark that tests all 25+ deck archetypes against each other using GreedyBot. This provides baseline performance data.

**Usage:**

```bash
# Run from project root
bun scripts/benchmark-all-decks.ts

# Options:
bun scripts/benchmark-all-decks.ts --games 50     # Faster, fewer games
bun scripts/benchmark-all-decks.ts --quick        # Quick test (10 games)
bun scripts/benchmark-all-decks.ts --help         # Show all options
```

**What it does:**

- Tests all 26 deck archetypes (mono, dual-color, competitive, special)
- Runs each matchup with GreedyBot vs GreedyBot for consistency
- Generates comprehensive statistics:
  - Overall deck win rates
  - Head-to-head matchup records
  - Deck rankings by performance
- Exports results in JSON, CSV, and Markdown formats

**Output:**

- `output/baseline/deck-baseline-{timestamp}.json` - Full results data
- `output/baseline/deck-baseline-{timestamp}.md` - Readable report
- `output/baseline/deck-baseline-{timestamp}.csv` - Spreadsheet format

**Estimated time:**

- 100 games per matchup: ~30-45 minutes (650 matchups × 100 games = 65,000 games)
- 50 games per matchup: ~15-20 minutes
- Quick mode (10 games): ~3-5 minutes

---

## Config Reference

### Common Fields

All configs share these fields:

```json
{
  "command": "simulate", // Required: command type
  "name": "my-experiment", // Required: experiment name (used in output)
  "seed": "timestamp", // Optional: number or "timestamp"
  "output": {
    "directory": "results", // Output directory
    "level": "minimal", // quiet | minimal | normal | verbose
    "formats": ["json"] // json | csv | markdown
  }
}
```

---

### Simulate

Run bot vs bot games.

```json
{
  "command": "simulate",
  "name": "mcts-vs-greedy-test",
  "games": 100,
  "p1": { "type": "mcts-eval-fast" },
  "p2": { "type": "greedy" },
  "seed": "timestamp",
  "maxTurns": 100,
  "parallel": true,
  "output": {
    "directory": "results",
    "level": "minimal",
    "formats": ["json"]
  }
}
```

**Bot Types:**

- `random` - Random legal actions
- `greedy` - 1-ply lookahead
- `mcts-eval-fast` - 50 iterations, no rollout (recommended)
- `mcts-eval` - 200 iterations, no rollout
- `mcts-eval-strong` - 500 iterations, no rollout
- `mcts-eval-turbo` - 1000 iterations, no rollout
- `mcts-shallow-fast` - 50 iterations, shallow greedy rollout

---

### Benchmark

Compare multiple bots in a round-robin tournament.

```json
{
  "command": "benchmark",
  "name": "full-comparison",
  "bots": ["random", "greedy", "mcts-eval-fast", "mcts-eval"],
  "gamesPerMatchup": 50,
  "seed": "timestamp",
  "calculateElo": true,
  "output": {
    "directory": "results/benchmarks",
    "level": "normal",
    "formats": ["json", "markdown"]
  }
}
```

---

### Tune Weights

Optimize evaluation function weights.

```json
{
  "command": "tune-weights",
  "name": "weight-evolution",
  "method": "evolve",
  "generations": 20,
  "population": 20,
  "gamesRandom": 50,
  "gamesGreedy": 50,
  "seed": "timestamp",
  "output": {
    "directory": "results/tuning",
    "level": "normal"
  }
}
```

**Methods:**

- `local` - Hill climbing (fast, local optima)
- `evolve` - Evolutionary search (slower, better exploration)

---

### Tune MCTS

Optimize MCTS hyperparameters.

```json
{
  "command": "tune-mcts",
  "name": "mcts-optimization",
  "method": "coarse-to-fine",
  "gamesPerConfig": 50,
  "validationGames": 100,
  "seed": "timestamp",
  "skipValidation": false,
  "output": {
    "directory": "results/tuning",
    "level": "normal"
  }
}
```

**Methods:**

- `grid` - Full grid search (thorough, slow)
- `coarse-to-fine` - Adaptive search (faster, recommended)

---

### Pipeline

Run complete tuning workflow (weights + MCTS + validation).

```json
{
  "command": "pipeline",
  "name": "full-tuning",
  "seed": "timestamp",
  "weights": {
    "method": "evolve",
    "generations": 20,
    "skip": false
  },
  "mcts": {
    "method": "coarse-to-fine",
    "games": 50,
    "validation": 100,
    "skip": false
  },
  "acceptance": "default",
  "output": {
    "directory": "results/pipeline",
    "level": "normal"
  }
}
```

**Acceptance Levels:**

- `relaxed` - Lower thresholds for accepting changes
- `default` - Standard thresholds
- `strict` - Higher thresholds, more conservative

---

### Collect Training Data

Generate ML training datasets with curriculum learning.

```json
{
  "command": "collect",
  "name": "training-dataset-v1",
  "games": 500,
  "curriculum": "fast",
  "seed": "timestamp",
  "maxTurns": 100,
  "export": {
    "json": true,
    "binary": true
  },
  "output": {
    "directory": "training-data",
    "level": "minimal"
  }
}
```

**Curricula:**

- `fast` - GreedyBot vs Random/Greedy (fast, ~1 game/sec)
- `default` - MCTS-Eval vs Random/Greedy/MCTS (~3 sec/game)

**Single Phase:**

```json
{
  "phase": "easy" // easy | medium | hard | fast-easy | fast-medium
}
```

---

### Replay

Replay recorded games or re-run by seed.

```json
{
  "command": "replay",
  "name": "replay-analysis",
  "source": 12345,
  "fromTurn": 1,
  "watch": {
    "enabled": false,
    "delayMs": 500
  },
  "verify": true,
  "output": {
    "level": "verbose"
  }
}
```

**Source:**

- Number (seed): Re-runs simulation with that seed
- String (path): Loads replay file from path

---

## Creating Custom Experiments

1. Copy a template that matches your command
2. Modify parameters as needed
3. Save with descriptive name: `experiments/my-experiment-name.json`
4. Run: `bun src/index.ts run ../../experiments/my-experiment-name.json`

### Naming Convention

```
<command>-<variant>-<details>.json

Examples:
  simulate-mcts-ablation.json
  benchmark-final-comparison.json
  collect-training-large-dataset.json
  pipeline-paper-submission.json
```

---

## Output Structure

All experiment output goes to a centralized `output/` directory at project root:

```
output/
├── simulations/                    # simulate command
│   ├── {name}-{seed}.json          # Results (uses experiment name!)
│   └── logs/
│       └── {name}-{seed}-{timestamp}.log
│
├── benchmarks/                     # benchmark command
│   ├── {name}-{timestamp}.json
│   └── {name}-{timestamp}.md
│
├── training-data/                  # collect-training command
│   └── {name}-{timestamp}/
│       ├── games/                  # Individual game files
│       ├── tensors.json            # Merged tensor data
│       ├── tensors.bin.json        # Binary format
│       └── stats.json              # Collection statistics
│
├── tuning/                         # tune-weights, tune-mcts, pipeline
│   ├── weights.json                # Copy of current best
│   ├── weights-history/
│   └── TUNING_LOG.md
│
├── errors/                         # Error snapshots for debugging
│
└── replays/                        # Saved game replays
```

**Note**: The experiment `name` field is used in output filenames for easy identification!

---

## Tips

1. **Start with templates** - Copy and modify existing configs
2. **Use descriptive names** - Makes results easy to find
3. **Commit configs** - Track what experiments you ran
4. **Use timestamps** - Set `"seed": "timestamp"` for unique runs
5. **Fixed seeds for reproduction** - Set `"seed": 12345` to reproduce exact results
