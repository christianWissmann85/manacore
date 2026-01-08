# Training Data Generation Pipeline

Generate high-quality MTG training data using Claude models as the "human" player via the MCP Server. Each game captures strategic reasoning for every decision.

## Overview

```
┌─────────────────────────────────────────────────────────┐
│           Batch Orchestrator                             │
│  (scripts/generate-training-data.ts)                    │
│  • Generates game queue (deck × opponent × model)       │
│  • Spawns Claude CLI in parallel                        │
│  • Tracks progress for resume capability                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│           Claude Code CLI (--print mode)                │
│  • Plays game via MCP tools                             │
│  • Provides reasoning for each decision                 │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│           MCP Server + TrainingDataCollector            │
│  • Records (state, action, reasoning) per move          │
│  • Auto-saves to packages/ai/data/human-training/       │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Generate 15 games (test run with default sonnet)
bun scripts/generate-training-data.ts --games 15 --parallel 1

# Generate 100 games with opus (highest quality)
bun scripts/generate-training-data.ts --games 100 --model opus

# Generate 100 games with haiku (fast & cheap)
bun scripts/generate-training-data.ts --games 100 --model haiku

# Generate 1000 games with mixed models (balanced cost/quality)
bun scripts/generate-training-data.ts --games 1000 --model mix

# Custom mix ratio (10% opus, 50% sonnet, 40% haiku)
bun scripts/generate-training-data.ts --games 1000 --model mix --mix-ratio 10:50:40

# Check progress (can resume if interrupted)
cat packages/ai/data/human-training/batch-progress.json | jq '.stats'

# Generate coverage report
bun scripts/generate-coverage-report.ts
```

## Model Selection

Choose the right model for your use case:

| Model  | Quality | Speed  | Cost/Game | Best For                        |
| ------ | ------- | ------ | --------- | ------------------------------- |
| opus   | Highest | Slow   | ~$0.20    | High-quality reasoning samples  |
| sonnet | Great   | Medium | ~$0.10    | Balanced quality/cost (default) |
| haiku  | Good    | Fast   | ~$0.02    | Large datasets, quick iteration |
| mix    | Varied  | Varied | ~$0.06    | Cost-effective diverse data     |

### Mix Mode

Mix mode distributes models across games based on a ratio. Default is `20:40:40` (opus:sonnet:haiku).

```bash
# Default mix: 20% opus, 40% sonnet, 40% haiku
bun scripts/generate-training-data.ts --games 1000 --model mix

# Custom mix: 10% opus, 60% sonnet, 30% haiku
bun scripts/generate-training-data.ts --games 1000 --model mix --mix-ratio 10:60:30

# Heavy haiku for speed: 5% opus, 15% sonnet, 80% haiku
bun scripts/generate-training-data.ts --games 1000 --model mix --mix-ratio 5:15:80
```

## Configuration Matrix

The pipeline generates games across all matchups:

| Decks (5)                      | Opponents (3)        | Total Matchups |
| ------------------------------ | -------------------- | -------------- |
| white, blue, black, red, green | random, greedy, mcts | 15             |

For 1000 games: ~67 games per matchup, evenly distributed.

## Training Data Format

Each game is saved as `game-{timestamp}.json`:

```json
{
  "gameId": "game-1767869041645-1767869041647",
  "timestamp": "2026-01-08T10:44:01.647Z",
  "seed": 1767869041645,
  "playerBot": "human",
  "opponentBot": "greedy",
  "outcome": 1,
  "turns": 8,
  "totalActions": 25,
  "samples": [
    {
      "features": {
        "playerLife": 1.0,
        "opponentLife": 0.85,
        "boardAdvantage": 0.3,
        "cardAdvantage": -0.14,
        ...
      },
      "actionIndex": 0,
      "legalActionCount": 5,
      "actionType": "CAST_SPELL",
      "turn": 3,
      "phase": "main1",
      "playerId": "player",
      "reasoning": "Cast Giant Spider - a 2/4 with reach is excellent defense against flyers."
    }
  ]
}
```

### Feature Vector (25 dimensions)

| Feature             | Range  | Description                  |
| ------------------- | ------ | ---------------------------- |
| playerLife          | [0,1]  | Normalized life total        |
| opponentLife        | [0,1]  | Opponent's normalized life   |
| lifeDelta           | [-1,1] | Life advantage               |
| playerCreatureCount | [0,1]  | Creatures on battlefield     |
| boardAdvantage      | [-1,1] | Board presence difference    |
| cardAdvantage       | [-1,1] | Hand size difference         |
| playerLandsTotal    | [0,1]  | Mana development             |
| turnNumber          | [0,1]  | Game progression             |
| isPlayerTurn        | bool   | Active player flag           |
| phase               | [0-6]  | Game phase encoding          |
| ...                 |        | See TrainingDataCollector.ts |

## Scripts Reference

### generate-training-data.ts

Main orchestrator script.

```bash
bun scripts/generate-training-data.ts [options]

Options:
  -g, --games <n>       Number of games (default: 15)
  -p, --parallel <n>    Parallel workers (default: 3)
  -m, --model <model>   Model: opus, sonnet, haiku, or mix (default: sonnet)
  --mix-ratio <O:S:H>   Mix ratio as opus:sonnet:haiku (default: 20:40:40)
  -h, --help            Show help
```

Features:

- **Model selection**: Choose opus, sonnet, haiku, or mix for cost/quality balance
- **Resume capability**: Interrupted batches continue from last progress
- **Progress tracking**: `batch-progress.json` updated after each game
- **Parallel execution**: Run multiple games simultaneously
- **Real-time status**: Shows running games with elapsed time and ETA
- **Error handling**: Failed games logged, can retry

### generate-coverage-report.ts

Analyze training data quality.

```bash
bun scripts/generate-coverage-report.ts [options]

Options:
  -d, --dir <path>    Data directory
  -o, --output <path> Save report to JSON
  -h, --help          Show help
```

Output includes:

- Total games and samples
- Matchup breakdown (games per deck × opponent)
- Win rates and average game length
- Reasoning coverage percentage
- Action type distribution
- Quality issues (short games, missing data)

## Data Utilities

The `@manacore/ai` package provides utilities for working with training data:

```typescript
import {
  mergeTrainingData, // Combine multiple game files
  toTensorFormat, // Export to ML-ready arrays
  TrainingDataCollector,
  type GameTrainingData,
  type TrainingSample,
} from '@manacore/ai';

// Load and merge games
const games: GameTrainingData[] = loadGameFiles('packages/ai/data/human-training');
const merged = mergeTrainingData(games);
console.log(`Total samples: ${merged.metadata.totalSamples}`);

// Export to tensor format
const tensors = toTensorFormat(games[0]);
// tensors.features: number[][] - [samples, 25]
// tensors.actions: number[]    - action indices
// tensors.outcomes: number[]   - game outcomes
```

## Cost Estimates

### By Model (per game)

| Model  | Input Tokens | Output Tokens | Cost/Game |
| ------ | ------------ | ------------- | --------- |
| opus   | ~8,000       | ~3,000        | ~$0.20    |
| sonnet | ~8,000       | ~3,000        | ~$0.10    |
| haiku  | ~8,000       | ~3,000        | ~$0.02    |

### By Scale (using default sonnet)

| Scale  | Games | Est. Cost | Time (3 workers) |
| ------ | ----- | --------- | ---------------- |
| Test   | 15    | ~$1.50    | ~15 min          |
| Small  | 100   | ~$10      | ~1.5 hr          |
| Medium | 500   | ~$50      | ~7 hr            |
| Full   | 1000  | ~$100     | ~14 hr           |

### By Scale (using mix mode 20:40:40)

| Scale  | Games | Est. Cost | Time (3 workers) |
| ------ | ----- | --------- | ---------------- |
| Test   | 15    | ~$1       | ~12 min          |
| Small  | 100   | ~$6       | ~1 hr            |
| Medium | 500   | ~$30      | ~5 hr            |
| Full   | 1000  | ~$60      | ~10 hr           |

## Troubleshooting

### Batch stuck or slow

```bash
# Check progress
cat packages/ai/data/human-training/batch-progress.json | jq '.stats'

# View running games
ps aux | grep claude
```

### Resume interrupted batch

The script automatically resumes from `batch-progress.json`:

```bash
# Just run the same command again
bun scripts/generate-training-data.ts --games 1000 --parallel 3
```

### Clear and restart

```bash
# Remove progress file to start fresh
rm packages/ai/data/human-training/batch-progress.json
```

### Check for issues

```bash
# Generate report to find problems
bun scripts/generate-coverage-report.ts
```

## File Locations

| File                                                  | Purpose               |
| ----------------------------------------------------- | --------------------- |
| `scripts/generate-training-data.ts`                   | Batch orchestrator    |
| `scripts/generate-coverage-report.ts`                 | Coverage analysis     |
| `scripts/prompts/play-mtg-game.txt`                   | Agent prompt template |
| `packages/ai/data/human-training/`                    | Training data output  |
| `packages/ai/data/human-training/batch-progress.json` | Batch state           |
| `packages/ai/src/training/TrainingDataCollector.ts`   | Core collector        |

## Future Enhancements

- **Curriculum learning**: Progress from random → greedy → MCTS opponents
- **Reasoning quality scoring**: Rate and filter by reasoning usefulness
- **Active learning**: Focus on uncertain/interesting positions
- **Streaming export**: Direct export to training frameworks
