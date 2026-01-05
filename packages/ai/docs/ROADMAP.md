# ManaCore AI Package - Development Roadmap

**Version:** 0.3.0
**Last Updated:** January 5, 2026
**Status:** Phase 2.1 Complete, Phase 2.2 In Progress

---

## Executive Summary

The ManaCore AI package provides bot implementations for playing Magic: The Gathering. Our goal is to create increasingly sophisticated AI agents, culminating in a research-grade MCTS implementation suitable for AI/ML experiments.

### Current Bot Hierarchy

| Bot       | Strength       | Speed          | Description                     |
| --------- | -------------- | -------------- | ------------------------------- |
| RandomBot | Baseline       | ~50 games/sec  | Random legal actions            |
| GreedyBot | ~64% vs Random | ~4 games/sec   | 1-ply lookahead with evaluation |
| MCTSBot   | TBD vs Greedy  | ~0.1 games/sec | Monte Carlo Tree Search         |

---

## Completed Work

### Phase 1: Foundation (Complete)

- [x] Bot interface (`Bot.ts`)
- [x] RandomBot implementation
- [x] Integration with CLI simulator
- [x] 676 engine tests passing

### Phase 2.1: Basic MCTS (Complete - January 5, 2026)

- [x] MCTSNode data structure with UCB1 formula
- [x] MCTS core algorithm (select, expand, simulate, backprop)
- [x] MCTSBot wrapper with configurable iterations
- [x] Random rollout policy
- [x] Evaluation function for non-terminal states
- [x] 25 AI package tests passing
- [x] CLI integration (`--p1 mcts`, `--p1 mcts-fast`, `--p1 mcts-strong`)

**Key Files:**

- `src/search/MCTSNode.ts` - Node structure, UCB1, backpropagation
- `src/search/MCTS.ts` - Core MCTS algorithm
- `src/bots/MCTSBot.ts` - Bot wrapper with presets
- `src/evaluation/evaluate.ts` - Board evaluation function

**Lessons Learned:**

1. Rollouts rarely reach terminal states in MTG - evaluation function essential
2. `structuredClone` is expensive (~2-5ms per clone)
3. Backpropagation must correctly flip rewards based on player perspective

---

## Current Work

### Phase 2.2: Performance & Hidden Information (In Progress)

**Goals:**

- [ ] Improve MCTS speed (target: 1+ games/sec)
- [ ] Add determinization for opponent's hidden hand
- [ ] Switch to GreedyBot rollouts for better simulation quality
- [ ] Beat RandomBot 80%+ consistently

**Performance Bottlenecks Identified:**

1. **State cloning** - `structuredClone` takes ~2-5ms per call
2. **Rollout overhead** - Each rollout step requires getLegalActions + applyAction
3. **No parallelization** - Single-threaded execution

**Proposed Optimizations:**

```
Priority 1 (High Impact, Low Effort):
├── Reduce rollout depth further (10-15 steps)
├── Cache legal actions at nodes
└── Early termination when one action clearly dominates

Priority 2 (High Impact, Medium Effort):
├── Incremental state updates (undo stack instead of clone)
├── Greedy rollout policy (use GreedyBot's evaluation)
└── Time-based iteration limits

Priority 3 (Medium Impact, High Effort):
├── State hashing for transposition tables
├── Web Workers for parallel tree search
└── WASM-optimized state cloning
```

**Determinization for Hidden Information:**

```typescript
// Current: MCTS sees opponent's hand (cheating!)
// Target: Sample possible opponent hands

function determinize(state: GameState): GameState {
  const copy = structuredClone(state);

  // Shuffle unknown cards (opponent hand + both libraries)
  const unknownCards = [...copy.players.opponent.hand, ...copy.players.opponent.library];
  shuffle(unknownCards);

  // Redistribute
  const handSize = copy.players.opponent.hand.length;
  copy.players.opponent.hand = unknownCards.slice(0, handSize);
  copy.players.opponent.library = unknownCards.slice(handSize);

  return copy;
}
```

---

## Short-Term Goals (Next 1-2 Sessions)

### Phase 2.3: Greedy Rollouts

- [ ] Implement `greedyRolloutPolicy` using GreedyBot's evaluation
- [ ] Compare rollout quality: random vs greedy
- [ ] Measure win rate improvement

### Phase 2.4: Evaluation Tuning

- [ ] Self-play weight optimization
- [ ] Compare hand-tuned vs learned weights
- [ ] Document optimal weight configuration

### Phase 2.5: Benchmarking Suite

- [ ] Automated bot comparison tests
- [ ] Win rate matrix (all bots vs all bots)
- [ ] Performance profiling dashboard

---

## Medium-Term Goals (Next Month)

### Phase 3: Advanced MCTS

**3.1: ISMCTS (Information Set MCTS)**

- Multiple determinizations per search
- Aggregate results across possible worlds
- Handle hidden information properly

**3.2: Transposition Tables**

- State hashing for position deduplication
- Share statistics between equivalent positions
- Memory-bounded table with LRU eviction

**3.3: Parallel Search**

- Root parallelization (multiple trees)
- Tree parallelization (shared tree with locks)
- Web Worker implementation

**3.4: Move Ordering**

- Prioritize promising actions in expansion
- Use evaluation function for action sorting
- Killer move heuristic

---

## Long-Term Goals (Future Phases)

### Phase 4: Neural Network Evaluation

**4.1: Training Data Collection**

- Record games with action + outcome pairs
- Generate 100,000+ training examples
- Balance across deck types and game stages

**4.2: Network Architecture**

```
Input Layer:
├── Board state encoding (creatures, lands, etc.)
├── Hand information (card types, mana costs)
├── Game phase and turn number
└── Life totals and mana pools

Hidden Layers:
├── 3x Dense layers (512 → 256 → 128)
├── ReLU activation
└── Dropout for regularization

Output Layer:
└── Win probability [0, 1]
```

**4.3: Training Pipeline**

- Supervised learning from expert games
- Self-play reinforcement learning
- AlphaZero-style training loop

### Phase 5: Genetic Deck Building

- Evolve deck compositions through tournament selection
- Discover novel strategies
- Meta-game analysis

### Phase 6: Transfer Learning Experiments

- Train on 6th Edition, test on Urza's Saga
- Measure adaptation speed to new card pools
- Research paper: "Plasticity of MCTS Agents in Evolving TCG Environments"

---

## Architecture Overview

```
packages/ai/
├── src/
│   ├── bots/
│   │   ├── Bot.ts           # Interface
│   │   ├── RandomBot.ts     # Baseline
│   │   ├── GreedyBot.ts     # 1-ply lookahead
│   │   └── MCTSBot.ts       # Tree search
│   │
│   ├── evaluation/
│   │   └── evaluate.ts      # Board evaluation function
│   │
│   ├── search/
│   │   ├── MCTSNode.ts      # Node structure, UCB1
│   │   └── MCTS.ts          # Core algorithm
│   │
│   └── index.ts             # Package exports
│
├── tests/
│   ├── GreedyBot.test.ts
│   ├── evaluate.test.ts
│   └── MCTS.test.ts
│
└── docs/
    ├── MCTS-ARCHITECTURE.md  # Algorithm whitepaper
    └── ROADMAP.md            # This file
```

---

## Key Metrics

### Current Performance (January 5, 2026)

| Metric         | RandomBot | GreedyBot | MCTSBot-50 |
| -------------- | --------- | --------- | ---------- |
| vs RandomBot   | 50%       | 64%       | TBD        |
| vs GreedyBot   | 36%       | 50%       | ~33%       |
| Games/second   | 50+       | 4-5       | 0.05-0.1   |
| Decisions/game | ~100      | ~100      | ~100       |
| ms/decision    | <1        | 5-10      | 200-500    |

### Target Performance (Phase 2 Complete)

| Metric               | Target |
| -------------------- | ------ |
| MCTSBot vs RandomBot | 80%+   |
| MCTSBot vs GreedyBot | 60%+   |
| Games/second         | 0.5+   |
| ms/decision          | <200   |

---

## Research Questions

1. **Evaluation Function Design**
   - What features matter most for MTG position evaluation?
   - Can we learn weights from self-play?

2. **Hidden Information Handling**
   - How many determinizations are needed for reliable decisions?
   - Does opponent modeling improve play?

3. **Rollout Policy Impact**
   - Random vs Greedy vs Epsilon-Greedy rollouts?
   - Optimal rollout depth for MTG?

4. **Scaling Behavior**
   - How does win rate scale with iterations?
   - Diminishing returns threshold?

---

## CLI Quick Reference

```bash
# Bot benchmarks
bun src/index.ts sim 100 --p1 mcts --p2 random
bun src/index.ts sim 100 --p1 mcts-fast --p2 greedy
bun src/index.ts sim 100 --p1 mcts-strong --p2 mcts

# Debug mode (shows MCTS stats)
bun src/index.ts sim 10 --p1 mcts --p2 random --debug

# GreedyBot benchmark
bun src/index.ts benchmark 100
```

---

## Contributing

When working on the AI package:

1. **Tests First** - Add tests before implementing features
2. **Benchmark Changes** - Measure performance impact
3. **Document Decisions** - Update this roadmap with learnings
4. **Small Commits** - One feature per commit

---

## References

- [MCTS Survey Paper](https://www.cs.swarthmore.edu/~bryce/cs63/s16/reading/mcts.pdf)
- [AlphaZero Paper](https://arxiv.org/abs/1712.01815)
- [ISMCTS for Card Games](https://ieeexplore.ieee.org/document/6203567)

---

**Next Session Goals:**

1. Profile MCTS to identify specific bottlenecks
2. Implement greedy rollout policy
3. Add determinization for hidden information
4. Target: MCTSBot beats RandomBot 70%+
