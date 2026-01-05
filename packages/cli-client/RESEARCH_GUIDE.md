# ManaCore Research Guide

**Advanced Features for Reproducibility & Debugging**

This guide covers the research-focused features of ManaCore's CLI client, designed for rigorous testing, debugging, and reproducible experiments.

---

## 🎲 Seed Management

### Understanding Seeds

Every simulation in ManaCore uses a **base seed** that determines the random number generation. Each individual game within a simulation gets its own derived seed: `gameSeed = baseSeed + gameIndex`.

**Why this matters:**
- **Reproducibility**: Same seed = identical game
- **Debugging**: Replay exact failure scenarios
- **Research**: Compare AI performance under identical conditions

### Setting Seeds

```bash
# Use a specific base seed
bun src/index.ts benchmark 100 --seed 12345

# Default behavior: uses current timestamp (still reproducible)
bun src/index.ts benchmark 100
# Output: 🎲 Base Seed: 1736123456789
```

### Default Behavior
- If you **don't** specify `--seed`, the CLI uses `Date.now()` as the base seed
- The base seed is **always displayed** at the start of simulation
- This ensures every run is reproducible even when you forget to set a seed

---

## 🔄 Replay Failed Games

When a game fails, ManaCore records its seed for easy replay.

### Example Workflow

1. **Run a benchmark and observe a failure:**
```bash
$ bun src/index.ts benchmark 100

# ...
Error in game 39:
  INFINITE LOOP DETECTED!
  Seed: 12383 (use --verbose for full snapshot)
# ...

🔬 Failed Game Seeds (for replay):
   bun src/index.ts replay 12383 --verbose
```

2. **Replay the specific failed game:**
```bash
$ bun src/index.ts replay 12383 --verbose

🔄 ManaCore - Game Replay
Replaying game with seed: 12383

# Full game state and action history displayed
```

3. **Debug with full verbosity:**
```bash
$ bun src/index.ts replay 12383 --verbose --debug

# Shows:
# - Every action taken
# - Board state after each action
# - Bot decision-making process
```

---

## 📊 Simulation Results Tracking

### Game Records

Every simulation now tracks detailed per-game data:

```typescript
interface GameRecord {
  gameNumber: number;
  seed: number;
  winner: PlayerId | null;
  turns: number;
  playerDeck: string;
  opponentDeck: string;
  error?: string;
}
```

### Failed Seeds List

All failed games are tracked in `results.failedSeeds[]`:

```typescript
interface SimulationResults {
  // ... other fields
  gameRecords: GameRecord[];     // All games
  baseSeed: number;              // Base seed for reproduction
  failedSeeds: number[];         // Seeds that caused errors
}
```

---

## 🧪 Research Workflows

### 1. Regression Testing

After fixing a bug, verify it doesn't recur:

```bash
# Original failing seed
bun src/index.ts replay 12383

# Run broader test with same base seed
bun src/index.ts benchmark 100 --seed 12345

# All games use seeds 12345, 12346, 12347... 12444
```

### 2. Comparative Analysis

Compare two AI strategies under identical conditions:

```bash
# Test GreedyBot
bun src/index.ts benchmark 100 --seed 1000

# Test RandomBot (if you had a P1 bot selector)
bun src/index.ts simulate 100 --p1 random --p2 random --seed 1000
```

### 3. Edge Case Collection

Build a test suite from failures:

```bash
# Create a test file with known problematic seeds
cat > test-cases.txt <<EOF
12383  # Gorilla Chieftain regenerate loop
15672  # Combat damage ordering issue
28391  # Stack resolution edge case
EOF

# Replay each as part of CI
while read seed comment; do
  echo "Testing: $comment"
  bun src/index.ts replay $seed || exit 1
done < test-cases.txt
```

### 4. Statistical Significance

Ensure reproducibility in performance metrics:

```bash
# Run 1: Test new evaluation function
bun src/index.ts benchmark 1000 --seed 42
# GreedyBot Win Rate: 61.2%

# Run 2: Revert changes and verify
bun src/index.ts benchmark 1000 --seed 42
# GreedyBot Win Rate: 59.8%

# Same seed = Same opponents = Fair comparison
```

---

## 🐛 Debugging Failed Games

### Verbose Output

```bash
bun src/index.ts replay 12383 --verbose
```

**Shows:**
- Full game state at failure
- Last 10 actions taken
- Board state (all permanents)
- Stack contents
- Player life totals and hand sizes

### Debug Verbose

```bash
bun src/index.ts replay 12383 --debug-verbose
```

**Additional output:**
- Action-by-action game log
- Phase/step transitions
- Priority changes
- Bot decision process (if `--debug` is also used)

### State Snapshots

With `--verbose`, failed games save snapshots to disk:

```
📁 manacore/
  └─ results/
      └─ error-snapshots/
          ├─ game-39-seed-12383-2026-01-05T16-58-30.json
          └─ game-39-seed-12383-2026-01-05T16-58-30.txt
```

These files contain:
- **JSON**: Structured data for programmatic analysis
- **TXT**: Human-readable snapshot with ASCII visualization
- Complete game state
- Recent action history
- Error details
- Deck compositions

---

## 🎯 Command Reference

### Benchmark

```bash
bun src/index.ts benchmark <count> [options]

Options:
  --seed <n>              Base seed for reproducibility
  --debug                 Show bot reasoning
  --debug-verbose         Show turn-by-turn progress
  --turns <n>             Max turns per game (default: 100)
  --export-json           Export results as JSON
  --export-csv            Export results as CSV
  --export-path <path>    Custom output path (default: results/)
  --profile               Enable basic profiling
  --profile-detailed      Enable detailed profiling
```

### Simulate

```bash
bun src/index.ts simulate <count> [options]

Options:
  --seed <n>              Base seed for reproducibility
  --p1 <bot>              Player 1 bot (random, greedy)
  --p2 <bot>              Player 2 bot (random, greedy)
  --verbose               Show detailed logs
  --turns <n>             Max turns per game
  --export-json           Export results as JSON
  --export-csv            Export results as CSV
  --export-path <path>    Custom output path
  --profile               Enable profiling
```

### Replay

```bash
bun src/index.ts replay <seed> [options]

Options:
  --verbose            Show full game state
  --debug              Show bot decisions
```

---

## 💡 Best Practices

### 1. Always Log Base Seeds
When sharing results or filing bugs, include the base seed:

```bash
# ❌ Bad
"I found a bug in game 39"

# ✅ Good
"Game 39 with base seed 12345 (seed 12383) causes infinite loop"
```

### 2. Use Deterministic Seeds for CI/CD

```yaml
# .github/workflows/test.yml
- name: Run regression tests
  run: |
    bun src/index.ts benchmark 100 --seed 42
    bun src/index.ts replay 12383
    bun src/index.ts replay 15672
```

### 3. Document Known Issues

Maintain a list of problematic seeds:

```markdown
## Known Edge Cases

| Seed  | Issue | Status |
|-------|-------|--------|
| 12383 | Gorilla Chieftain regenerate loop | ✅ Fixed |
| 15672 | Combat damage to planeswalker | 🔧 In Progress |
```

### 4. Archive Research Results

Save complete simulation results in multiple formats:

```bash
# Export as JSON and CSV (auto-timestamped)
bun src/index.ts benchmark 1000 --seed $(date +%s) --export-json --export-csv

# Custom naming for experiments
bun src/index.ts benchmark 1000 --seed 42 --export-json --export-path experiments/greedy-baseline

# Also capture console output
bun src/index.ts benchmark 1000 --seed 42 --export-json | tee logs/experiment-$(date +%Y%m%d).log
```

**Result Files:**
```
results/
  ├─ experiments-greedy-baseline.json
  ├─ experiments-greedy-baseline.csv
logs/
  └─ experiment-20260105.log
```

---

## � Data Export (NEW!)

### JSON Export

Export complete simulation results as structured JSON:

```bash
# Export to default location (results/)
bun src/index.ts benchmark 100 --export-json

# Export to custom path
bun src/index.ts benchmark 100 --export-json --export-path my-experiment
```

**JSON Structure:**
```json
{
  "metadata": {
    "exportDate": "2026-01-05T16:56:21.123Z",
    "playerBot": "GreedyBot",
    "opponentBot": "RandomBot"
  },
  "results": {
    "totalGames": 100,
    "baseSeed": 42,
    "gameRecords": [...],
    "deckStats": {...},
    "failedSeeds": [...]
  }
}
```

### CSV Export

Export game-by-game data for spreadsheet analysis:

```bash
# Export to CSV
bun src/index.ts benchmark 100 --export-csv

# Export both JSON and CSV
bun src/index.ts benchmark 100 --export-json --export-csv
```

**CSV Columns:**
- `game_number`, `seed`, `winner`, `turns`, `player_deck`, `opponent_deck`, `duration_ms`, `error`

### Export Location

All exports default to `results/` in the project root:

```
manacore/
  └─ results/
      ├─ results-seed1000-2026-01-05T16-56-21.json
      ├─ results-seed1000-2026-01-05T16-56-21.csv
      └─ error-snapshots/
          └─ game-42-seed-12383-2026-01-05T16-58-30.json
```

**Tip:** Add `results/` to your analysis scripts' search path!

---

## ⚡ Performance Profiling (NEW!)

### Basic Profiling

```bash
# Enable profiling
bun src/index.ts benchmark 100 --profile
```

**Output:**
```
────────────────────────────────────────────────────────────
  PERFORMANCE PROFILE
────────────────────────────────────────────────────────────
Total Time: 2.34s
Avg Game: 23.4ms
Games/sec: 42.74
```

### Detailed Profiling

```bash
# Enable detailed profiling (includes phase breakdown)
bun src/index.ts benchmark 100 --profile-detailed
```

---

## 🔬 Future Enhancements

Completed features:

- [x] JSON export: `--export-json`
- [x] CSV export: `--export-csv`
- [x] Performance profiling: `--profile` / `--profile-detailed`
- [x] Centralized results directory: `results/`

Planned features:

- [ ] Replay from saved snapshots (JSON)
- [ ] Batch replay: `--replay-file failed-seeds.txt`
- [ ] Parallel execution: `--parallel 8`
- [ ] Live progress streaming: `--stream results.ndjson`

---

## 📚 Additional Resources

- [DEBUGGING.md](../../DEBUGGING.md) - Engine debugging guide
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - System architecture
- [AI package docs](../../packages/ai/README.md) - Bot implementation details

---

**Happy Researching! 🧪**
