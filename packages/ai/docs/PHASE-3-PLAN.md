# Phase 3: Advanced MCTS - Implementation Plan

**Version:** 1.0.0
**Created:** January 6, 2026
**Status:** Planning Complete, Ready for Implementation

---

## Executive Summary

Phase 3 focuses on four improvements to MCTS that will transform it from underperforming (~40% vs GreedyBot) to competitive (target: 60%+):

| Phase | Feature              | Expected Impact    | Effort |
| ----- | -------------------- | ------------------ | ------ |
| 3.4   | Move Ordering        | Faster convergence | Low    |
| 3.1   | ISMCTS               | +5-10% win rate    | Medium |
| 3.2   | Transposition Tables | 2x speedup         | Medium |
| 3.3   | Parallel Search      | 3-4x speedup       | High   |

**Implementation Order:** 3.4 → 3.1 → 3.2 → 3.3

---

## Current State (January 6, 2026)

### Bot Performance

| Bot                  | vs RandomBot | vs GreedyBot | Games/sec |
| -------------------- | ------------ | ------------ | --------- |
| RandomBot            | 50%          | 36%          | 50+       |
| GreedyBot            | 64%          | 50%          | 4-5       |
| MCTSBot (eval-turbo) | ~57%         | **~40%**     | 0.7-0.8   |

### Key Issues

1. **MCTS loses to GreedyBot** - Single determinization doesn't handle hidden information well
2. **Slow** - 0.7 games/sec vs GreedyBot's 4-5 games/sec
3. **Random expansion** - Wastes iterations on unpromising actions

---

## Phase 3.4: Move Ordering

### Problem

MCTS expansion picks untried actions randomly. With MTG's high branching factor (~100 actions), many iterations are wasted exploring weak moves.

### Solution

Sort untried actions by type-based priority before expansion.

### Implementation

**File:** `packages/ai/src/search/MCTS.ts`

```typescript
// Action type priorities (higher = expand first)
const ACTION_PRIORITY: Record<string, number> = {
  CAST_SPELL: 100,
  ACTIVATE_ABILITY: 80,
  DECLARE_ATTACKERS: 60,
  DECLARE_BLOCKERS: 40,
  PLAY_LAND: 30,
  PASS_PRIORITY: 0,
};

function orderActions(actions: Action[]): Action[] {
  return [...actions].sort((a, b) => {
    const priorityA = ACTION_PRIORITY[a.type] ?? 20;
    const priorityB = ACTION_PRIORITY[b.type] ?? 20;
    return priorityB - priorityA;
  });
}

// In MCTSNode constructor:
this.untriedActions = orderActions(getLegalActions(state, playerId));
```

### Configuration

```typescript
interface MoveOrderingConfig {
  enabled: boolean;
  priorities: Record<string, number>;
  // Future: killer move tracking
  useKillerMoves: boolean;
  killerMoveBonus: number;
}
```

### Bot Type

- `mcts-ordered` - MCTS with type-based move ordering

### Success Criteria

- Same or better win rate with fewer iterations
- No performance regression (ordering is O(n log n) on action count)

### Benchmark

```bash
bun src/index.ts run experiments/phase3.4-move-ordering.json
```

---

## Phase 3.1: ISMCTS (Information Set MCTS)

### Problem

Current MCTS determinizes once per search - shuffles opponent's hand at the start, then treats it as known. This creates variance and doesn't properly handle uncertainty.

### Solution

Run multiple determinizations per search and aggregate statistics across all "possible worlds."

### Implementation

**File:** `packages/ai/src/search/ISMCTS.ts`

```typescript
export interface ISMCTSConfig extends MCTSConfig {
  determinizations: number; // Default: 10
  aggregation: 'sum' | 'average'; // Default: 'sum'
}

export function runISMCTS(state: GameState, playerId: PlayerId, config: ISMCTSConfig): Action {
  // Aggregate action statistics across determinizations
  const actionStats = new Map<string, { visits: number; totalReward: number }>();

  const iterationsPerDet = Math.floor(config.iterations / config.determinizations);

  for (let d = 0; d < config.determinizations; d++) {
    // Create determinized view of the game
    const deterministicState = determinize(state, playerId);

    // Run standard MCTS on this determinization
    const root = buildMCTSTree(deterministicState, playerId, {
      ...config,
      iterations: iterationsPerDet,
    });

    // Aggregate statistics from root's children
    for (const child of root.children) {
      const key = actionKey(child.action);
      const existing = actionStats.get(key) || { visits: 0, totalReward: 0 };
      existing.visits += child.visits;
      existing.totalReward += child.totalReward;
      actionStats.set(key, existing);
    }
  }

  // Select action with best average reward across all determinizations
  let bestAction: Action | null = null;
  let bestScore = -Infinity;

  for (const [key, stats] of actionStats) {
    const avgReward = stats.totalReward / stats.visits;
    if (avgReward > bestScore) {
      bestScore = avgReward;
      bestAction = parseActionKey(key);
    }
  }

  return bestAction!;
}
```

### Configuration

```typescript
const DEFAULT_ISMCTS_CONFIG: ISMCTSConfig = {
  iterations: 1000, // Total budget
  determinizations: 10, // Split across 10 possible worlds
  aggregation: 'sum', // Sum visits/rewards before averaging
  rolloutDepth: 0, // Use evaluation function
  explorationConstant: 1.41,
  determinize: true, // Redundant but explicit
};
```

### Bot Type

- `mcts-ismcts` - MCTS with 10 determinizations

### Success Criteria

- +5% win rate vs GreedyBot (target: 45%+)
- More consistent decision-making under uncertainty

### Benchmark

```bash
bun src/index.ts run experiments/phase3.1-ismcts.json
```

---

## Phase 3.2: Transposition Tables

### Problem

MCTS re-explores equivalent positions. In MTG, passing priority creates many duplicate states.

### Solution

Hash game states by relevant features and share statistics between equivalent positions.

### Implementation

**File:** `packages/ai/src/search/TranspositionTable.ts`

```typescript
export interface TranspositionEntry {
  visits: number;
  totalReward: number;
  depth: number; // For age-based eviction
  lastAccess: number; // For LRU eviction
}

export class TranspositionTable {
  private entries = new Map<string, TranspositionEntry>();
  private maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize = 100_000) {
    this.maxSize = maxSize;
  }

  /**
   * Compute hash from relevant game features only.
   * Ignores: instance IDs, library order, exact mana pool breakdown
   */
  computeHash(state: GameState, playerId: PlayerId): string {
    const player = getPlayer(state, playerId);
    const opponent = getOpponent(state, playerId);

    // Hash relevant features
    const features = [
      // Life totals
      player.life,
      opponent.life,
      // Board presence (sorted card names for canonical form)
      this.hashZone(player.battlefield),
      this.hashZone(opponent.battlefield),
      // Hand sizes (not contents - hidden information)
      player.hand.length,
      opponent.hand.length,
      // Game phase
      state.phase,
      state.activePlayer,
      // Stack state
      state.stack.length > 0 ? 'stack' : 'empty',
    ];

    return features.join('|');
  }

  private hashZone(cards: CardInstance[]): string {
    return cards
      .map((c) => c.name)
      .sort()
      .join(',');
  }

  lookup(hash: string): TranspositionEntry | undefined {
    const entry = this.entries.get(hash);
    if (entry) {
      this.hits++;
      entry.lastAccess = Date.now();
      return entry;
    }
    this.misses++;
    return undefined;
  }

  store(hash: string, entry: TranspositionEntry): void {
    if (this.entries.size >= this.maxSize) {
      this.evictLRU();
    }
    this.entries.set(hash, entry);
  }

  private evictLRU(): void {
    // Evict 10% of entries with oldest lastAccess
    const entries = [...this.entries.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    const toEvict = Math.floor(this.maxSize * 0.1);
    for (let i = 0; i < toEvict; i++) {
      this.entries.delete(entries[i][0]);
    }
  }

  getStats() {
    return {
      size: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses),
    };
  }
}
```

### Integration with MCTS

```typescript
// In runMCTS:
const table = config.transpositionTable || new TranspositionTable();

// During selection, check table for existing statistics
const hash = table.computeHash(node.state, playerId);
const cached = table.lookup(hash);
if (cached) {
  // Use cached statistics as prior
  node.visits += cached.visits;
  node.totalReward += cached.totalReward;
}

// During backpropagation, update table
table.store(hash, {
  visits: node.visits,
  totalReward: node.totalReward,
  depth: node.depth,
  lastAccess: Date.now(),
});
```

### Configuration

```typescript
interface TranspositionConfig {
  enabled: boolean;
  tableSize: number; // Default: 100,000
  hashFeatures: string[]; // Which features to hash
  evictionPolicy: 'lru' | 'depth'; // Default: 'lru'
}
```

### Bot Type

- `mcts-transposition` - MCTS with transposition table

### Success Criteria

- 2x speedup (measured in games/sec)
- Cache hit rate > 20% in typical games
- No win rate regression

### Benchmark

```bash
bun src/index.ts run experiments/phase3.2-transposition.json
```

---

## Phase 3.3: Parallel Search

### Problem

MCTS is single-threaded. Modern machines have 4-16+ cores sitting idle.

### Solution

Root parallelization - run independent MCTS trees in parallel, merge at root.

### Implementation

**File:** `packages/ai/src/search/ParallelMCTS.ts`

```typescript
import { Worker } from 'worker_threads';

export interface ParallelMCTSConfig extends MCTSConfig {
  workers: number | 'auto'; // 'auto' = navigator.hardwareConcurrency
  mergeStrategy: 'sum' | 'majority'; // Default: 'sum'
}

export async function runParallelMCTS(
  state: GameState,
  playerId: PlayerId,
  config: ParallelMCTSConfig,
): Promise<Action> {
  const workerCount =
    config.workers === 'auto' ? navigator.hardwareConcurrency || 4 : config.workers;

  const iterationsPerWorker = Math.floor(config.iterations / workerCount);

  // Spawn workers
  const workerPromises = Array.from({ length: workerCount }, (_, i) =>
    runWorkerMCTS(state, playerId, {
      ...config,
      iterations: iterationsPerWorker,
      seed: config.seed ? config.seed + i : undefined,
    }),
  );

  // Wait for all workers to complete
  const results = await Promise.all(workerPromises);

  // Merge root statistics
  const actionStats = new Map<string, { visits: number; totalReward: number }>();

  for (const result of results) {
    for (const [key, stats] of result.actionStats) {
      const existing = actionStats.get(key) || { visits: 0, totalReward: 0 };
      existing.visits += stats.visits;
      existing.totalReward += stats.totalReward;
      actionStats.set(key, existing);
    }
  }

  // Select best action
  return selectBestFromStats(actionStats);
}

// Worker implementation
async function runWorkerMCTS(
  state: GameState,
  playerId: PlayerId,
  config: MCTSConfig,
): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./mctsWorker.js', {
      workerData: { state, playerId, config },
    });

    worker.on('message', resolve);
    worker.on('error', reject);
  });
}
```

**File:** `packages/ai/src/search/mctsWorker.ts`

```typescript
import { parentPort, workerData } from 'worker_threads';
import { runMCTS } from './MCTS';

const { state, playerId, config } = workerData;
const result = runMCTS(state, playerId, config);

// Send back action statistics from root
const actionStats = new Map();
for (const child of result.root.children) {
  actionStats.set(actionKey(child.action), {
    visits: child.visits,
    totalReward: child.totalReward,
  });
}

parentPort?.postMessage({ actionStats, bestAction: result.action });
```

### Configuration

```typescript
const DEFAULT_PARALLEL_CONFIG: ParallelMCTSConfig = {
  iterations: 1000,
  workers: 'auto', // Use all available cores
  mergeStrategy: 'sum', // Sum statistics before selecting
  rolloutDepth: 0,
  explorationConstant: 1.41,
};
```

### Bot Type

- `mcts-parallel` - Root-parallel MCTS using all cores

### Success Criteria

- 3-4x speedup on 4-core machine
- Near-linear scaling with core count
- No win rate regression

### Benchmark

```bash
bun src/index.ts run experiments/phase3.3-parallel.json
```

---

## Testing Strategy

### Unit Tests

Each phase should have dedicated tests:

```typescript
// packages/ai/tests/phase3.test.ts

describe('Phase 3.4: Move Ordering', () => {
  test('orders actions by type priority', () => {
    const actions = [passAction, castSpellAction, attackAction];
    const ordered = orderActions(actions);
    expect(ordered[0].type).toBe('CAST_SPELL');
    expect(ordered[1].type).toBe('DECLARE_ATTACKERS');
    expect(ordered[2].type).toBe('PASS_PRIORITY');
  });
});

describe('Phase 3.1: ISMCTS', () => {
  test('aggregates statistics across determinizations', () => {
    const result = runISMCTS(state, playerId, { determinizations: 3 });
    expect(result).toBeDefined();
  });
});

describe('Phase 3.2: Transposition', () => {
  test('computes consistent hash for equivalent states', () => {
    const table = new TranspositionTable();
    const hash1 = table.computeHash(state1, 'player');
    const hash2 = table.computeHash(state2, 'player'); // Same relevant features
    expect(hash1).toBe(hash2);
  });
});

describe('Phase 3.3: Parallel', () => {
  test('merges worker results correctly', () => {
    // Mock worker results
    const results = [workerResult1, workerResult2];
    const merged = mergeWorkerResults(results);
    expect(merged.totalVisits).toBe(results.reduce((s, r) => s + r.visits, 0));
  });
});
```

### Integration Tests

```bash
# Run baseline benchmark
bun src/index.ts run experiments/phase3-baseline.json

# After each phase, run A/B test
bun src/index.ts run experiments/phase3.4-move-ordering.json
bun src/index.ts run experiments/phase3.1-ismcts.json
bun src/index.ts run experiments/phase3.2-transposition.json
bun src/index.ts run experiments/phase3.3-parallel.json

# Final comprehensive benchmark
bun src/index.ts run experiments/phase3-final.json
```

---

## Bot Factory Updates

After implementing each phase, add new bot types to `botFactory.ts`:

```typescript
export type BotType =
  | 'random'
  | 'greedy'
  // ... existing types ...
  // Phase 3 additions:
  | 'mcts-ordered' // 3.4: Move ordering
  | 'mcts-ismcts' // 3.1: Information Set MCTS
  | 'mcts-transposition' // 3.2: Transposition tables
  | 'mcts-parallel'; // 3.3: Parallel search
```

---

## Timeline & Milestones

| Phase | Milestone                 | Verification                    |
| ----- | ------------------------- | ------------------------------- |
| 3.4   | Move ordering implemented | A/B test passes                 |
| 3.1   | ISMCTS with 10 det.       | +5% vs GreedyBot                |
| 3.2   | Transposition table       | 2x speedup, >20% hit rate       |
| 3.3   | Root parallelization      | 3-4x speedup                    |
| Final | All improvements          | 60%+ vs GreedyBot, 2+ games/sec |

---

## Risk Assessment

| Risk                            | Mitigation                                        |
| ------------------------------- | ------------------------------------------------- |
| ISMCTS overhead exceeds benefit | Start with 10 det., tune down if needed           |
| Transposition collisions        | Use comprehensive hash, monitor collision rate    |
| Worker communication overhead   | Use SharedArrayBuffer if structuredClone too slow |
| Parallel bugs (race conditions) | Root parallelization has no shared state          |

---

## References

- [ISMCTS Paper](http://www.aifactory.co.uk/newsletter/2013_01_reduce_burden.htm)
- [Parallel MCTS Survey](https://www.aaai.org/Papers/AIIDE/2008/AIIDE08-036.pdf)
- [Transposition Tables in MCTS](https://www.chessprogramming.org/Transposition_Table)
