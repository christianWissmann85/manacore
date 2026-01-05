# ManaCore CLI: Seed Management & Reproducibility

## Summary of Enhancements

This update adds comprehensive seed management and reproducibility features to the ManaCore CLI, essential for a research platform studying game theory and AI.

---

## ✨ New Features

### 1. **Seed Parameter Support**

- Add `--seed <n>` flag to all simulation commands
- Default to `Date.now()` for automatic reproducibility
- Display base seed at simulation start
- Derive per-game seeds: `gameSeed = baseSeed + gameIndex`

### 2. **Replay Command**

```bash
bun src/index.ts replay <seed> [--verbose] [--debug]
```

- Replay any game by its exact seed
- Perfect for debugging specific failures
- Supports full verbosity and debug modes

### 3. **Enhanced Error Tracking**

- Track all failed game seeds in `results.failedSeeds[]`
- Display replay commands for failures:
  ```
  🔬 Failed Game Seeds (for replay):
     bun src/index.ts replay 12383 --verbose
  ```
- Per-game records with seed, winner, turns, decks

### 4. **Detailed Game Records**

```typescript
interface SimulationResults {
  gameRecords: GameRecord[]; // Complete game history
  baseSeed: number; // For full reproduction
  failedSeeds: number[]; // Easy error replay
}
```

---

## 🎯 Research Use Cases

### Regression Testing

```bash
# Test known problematic seed after bug fix
bun src/index.ts replay 12383

# Verify fix across multiple games
bun src/index.ts benchmark 100 --seed 12345
```

### Performance Comparison

```bash
# Test strategy A
bun src/index.ts benchmark 1000 --seed 42
# Win rate: 61.2%

# Test strategy B with SAME opponents
bun src/index.ts benchmark 1000 --seed 42
# Win rate: 59.8%
```

### Bug Reproduction

```bash
# User reports issue
"Game crashed at seed 12383"

# Developer reproduces exactly
bun src/index.ts replay 12383 --verbose
```

### CI/CD Integration

```yaml
- name: Regression Tests
  run: |
    bun src/index.ts replay 12383  # Known edge case
    bun src/index.ts replay 15672  # Another test case
    bun src/index.ts benchmark 100 --seed 42  # Deterministic suite
```

---

## 📊 Example Output

```bash
$ bun src/index.ts benchmark 100 --seed 1000

🏆 ManaCore - Bot Benchmark

Running 100 games: GreedyBot vs RandomBot
🎲 Base Seed: 1000

🎮 Running 100 games: GreedyBot vs RandomBot
  Progress: 0/100 games
  Progress: 10/100 games
  ...
  Progress: 90/100 games

  Error in game 39:
    INFINITE LOOP DETECTED!
    Seed: 1038 (use --verbose for full snapshot)

════════════════════════════════════════════════════════════
  SIMULATION RESULTS
════════════════════════════════════════════════════════════
Games: 99/100 | Errors: 1

────────────────────────────────────────────────────────────
  OVERALL
────────────────────────────────────────────────────────────
P1 wins: 60 (61%) | P2 wins: 27 (27%) | Draws: 12 (12%)

════════════════════════════════════════════════════════════
⚠️  1 games encountered errors

🔬 Failed Game Seeds (for replay):
   bun src/index.ts replay 1038 --verbose

📊 GreedyBot Win Rate: 60.6%
⏱️  Total time: 24.0s (0.24s/game)
```

---

## 🔧 Implementation Details

### Files Modified

1. **`index.ts`** - CLI argument parsing
   - Added `--seed` parameter
   - Implemented `replay` command
   - Updated help text

2. **`simulate.ts`** - Simulation engine
   - Added `gameRecords` tracking
   - Added `failedSeeds` array
   - Enhanced error reporting with seed info
   - Display replay commands for failures

### Data Structures

```typescript
interface SimulationOptions {
  seed?: number; // Base seed (defaults to Date.now())
  // ... existing options
}

interface GameRecord {
  gameNumber: number;
  seed: number; // Exact seed for this game
  winner: PlayerId | null;
  turns: number;
  playerDeck: string;
  opponentDeck: string;
  error?: string;
}

interface SimulationResults {
  baseSeed: number; // Original base seed
  gameRecords: GameRecord[]; // All game details
  failedSeeds: number[]; // Seeds that errored
  // ... existing fields
}
```

---

## 🎓 Best Practices

1. **Always log seeds**: Include in bug reports and research notes
2. **Use fixed seeds for CI**: Ensures deterministic test suite
3. **Document edge cases**: Maintain list of problematic seeds
4. **Archive results**: Save simulation logs with seeds for reproducibility

---

## 📝 Updated Commands

```bash
# Benchmark with specific seed
bun src/index.ts benchmark 100 --seed 12345

# Simulate with seed
bun src/index.ts simulate 50 --p1 greedy --seed 42

# Replay failed game
bun src/index.ts replay 12383 --verbose

# Get help
bun src/index.ts help
```

---

## 🚀 Future Enhancements

Potential additions:

- JSON/CSV export for data analysis
- Batch replay from file
- Performance profiling
- Parallel execution
- State snapshot save/load

---

## 📚 Documentation

- **User Guide**: [RESEARCH_GUIDE.md](./RESEARCH_GUIDE.md)
- **Example Workflows**: See guide for detailed examples
- **Integration**: Works seamlessly with existing verbose/debug modes

---

**Status**: ✅ Complete and tested
**Impact**: Essential for research reproducibility and debugging
