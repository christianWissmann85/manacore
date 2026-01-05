# Weight Tuning (Phase 2.3)

Self-play optimization for evaluation function weights.

## Quick Start

```bash
cd packages/cli-client

# Quick local search (~2 min)
bun src/index.ts tune

# Evolutionary search (~5 min)
bun src/index.ts tune --method evolve
```

## Evaluation Weights

The AI evaluates board positions using 5 weighted factors:

| Weight  | Description                   | Default |
| ------- | ----------------------------- | ------- |
| `life`  | Life total differential       | 0.30    |
| `board` | Creature power on battlefield | 0.45    |
| `cards` | Hand size differential        | 0.10    |
| `mana`  | Lands on battlefield          | 0.10    |
| `tempo` | Untapped permanents           | 0.05    |

Weights are normalized to sum to 1.0.

## Fitness Metrics

Each weight configuration is evaluated on three metrics:

1. **vs Random** - Win rate against RandomBot
2. **vs Greedy** - Win rate against GreedyBot
3. **Elo** - Tournament rating from head-to-head matches

## Methods

### Local Search (default)

Hill climbing - perturbs one weight at a time, keeps improvements.

- Fast convergence
- May find local optima

### Evolutionary

Genetic algorithm with population, crossover, and mutation.

- Broader exploration
- Better for escaping local optima

## Options

```
--method <local|evolve>   Optimization method (default: local)
--generations <n>         Number of generations (default: 15)
--population <n>          Population size for evolve (default: 10)
--games-random <n>        Games vs RandomBot per eval (default: 30)
--games-greedy <n>        Games vs GreedyBot per eval (default: 20)
--seed <n>                Random seed for reproducibility
```

## Examples

```bash
# Production run with more games
bun src/index.ts tune --generations 20 --games-random 50 --games-greedy 30

# Evolutionary with larger population
bun src/index.ts tune --method evolve --population 15 --generations 20

# Reproducible run
bun src/index.ts tune --seed 12345
```

## Output

The optimizer outputs:

- Live dashboard with progress
- Best weights found
- Improvement over baseline
- Copy-paste code snippet for the optimized weights

## Optimized Weights (Phase 2.3 Results)

After running local search optimization (seed 42424, 4355 games):

```typescript
// Optimized weights - found via self-play tuning
export const TUNED_WEIGHTS: EvaluationWeights = {
  life: 0.31, // Life total differential
  board: 0.46, // Creature power (most important)
  cards: 0.09, // Hand size differential
  mana: 0.08, // Lands on battlefield
  tempo: 0.05, // Untapped permanents
};
```

**Key findings:**

- Board presence remains the dominant factor (~46%)
- Life and board together account for ~77% of evaluation
- Card advantage and mana are less important than expected
- Tempo (untapped permanents) provides a small edge

## Technical Notes

### Evaluation Approaches

Two evaluation styles exist in the codebase:

1. **Normalized (`evaluate()`)** - Returns [0,1] scores, good for MCTS backpropagation
2. **Raw (`quickEvaluate()`)** - Returns unbounded differentials, better for greedy action selection

The tuning system uses raw-style scoring with tunable coefficients for best results.

### Coefficients vs Weights

- **Weights** (normalized): Sum to 1.0, represent relative importance
- **Coefficients** (raw): Actual multipliers used in scoring, can be any positive value

Default coefficients in `quickEvaluate()`:

```typescript
life: 2.0; // Each life point difference
board: 5.0; // Each power point on battlefield
cards: 0.1; // Each card in hand
mana: 1.5; // Each land on battlefield
```
