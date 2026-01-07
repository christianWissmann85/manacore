# Deck Baseline Benchmark - Quick Start

## What is this?

A comprehensive benchmark that tests all 26 deck archetypes in ManaCore against each other using GreedyBot for consistent, reproducible results. This establishes baseline performance metrics for each deck.

## Decks Tested

### Mono-Color (5)

- white, blue, black, red, green

### Dual-Color (10)

- azorius (W/U), orzhov (W/B), boros (W/R), selesnya (W/G)
- dimir (U/B), izzet (U/R), simic (U/G)
- rakdos (B/R), golgari (B/G)
- gruul (R/G)

### Competitive (5)

- white_weenie, blue_control, black_aggro, red_burn, green_midrange

### Special Coverage (6)

- artifact, colorhate, artifacts2, spells, creatures, uncovered

**Total: 26 decks × 25 opponents = 650 matchups**

## Usage

### Quick Test (Recommended First)

```bash
bun scripts/benchmark-all-decks.ts --quick
```

- 10 games per matchup
- ~3-5 minutes
- Good for testing the script works

### Fast Benchmark

```bash
bun scripts/benchmark-all-decks.ts --games 50
```

- 50 games per matchup (32,500 total games)
- ~15-20 minutes
- Good balance of speed and statistical significance

### Full Benchmark (Recommended for Publication)

```bash
bun scripts/benchmark-all-decks.ts
```

- 100 games per matchup (65,000 total games)
- ~30-45 minutes
- High statistical confidence

### Custom Game Count

```bash
bun scripts/benchmark-all-decks.ts --games 200
```

## Output

Results are automatically exported to `output/baseline/`:

1. **JSON** (`deck-baseline-{timestamp}.json`)
   - Complete structured data
   - All matchup results
   - Per-deck statistics
   - Import into analysis tools

2. **Markdown** (`deck-baseline-{timestamp}.md`)
   - Human-readable report
   - Ranked deck list
   - Top matchup analysis
   - Ready for documentation

3. **CSV** (`deck-baseline-{timestamp}.csv`)
   - Spreadsheet format
   - Easy graphing
   - Statistical analysis

## Example Output

```
╔════════════════════════════════════════════════════════════╗
║                    DECK RANKINGS                          ║
╚════════════════════════════════════════════════════════════╝

Rank  Deck                      Win Rate    W-L      Games
────────────────────────────────────────────────────────────
  1.  blue_control              58.2%     1455-1045   2500
  2.  white_weenie              56.8%     1420-1080   2500
  3.  black_aggro               55.3%     1382-1118   2500
  ...
```

## Why GreedyBot?

- **Fast**: ~100-200 games/second
- **Deterministic**: Same strategy every time
- **Baseline**: Good reference point (better than random, worse than MCTS)
- **Deck-focused**: Performance differences reflect deck strength, not bot variance

## What This Tells You

1. **Deck Power Levels**: Which decks are inherently stronger
2. **Color Balance**: Are some colors over/under-powered?
3. **Archetype Performance**: Do aggro/control/midrange perform as expected?
4. **Matchup Spread**: Which decks are feast-or-famine vs consistent?
5. **Design Insights**: Where to focus balance/tuning efforts

## Next Steps

After establishing the baseline, you can:

1. **Test with Stronger Bots**: Run same benchmark with MCTS to see if rankings change
2. **Balance Adjustments**: Identify under-performing decks for buffs
3. **ML Training**: Use results to weight training data collection
4. **Meta Analysis**: Understand which strategies dominate

## Troubleshooting

### Script Not Found

```bash
# Make sure you're in the project root
cd /home/chris/manacore
bun scripts/benchmark-all-decks.ts
```

### Out of Memory

- Use `--quick` or fewer games
- Close other applications
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096 bun scripts/benchmark-all-decks.ts`

### Too Slow

- Use `--quick` for testing
- Enable parallel mode (future enhancement)
- Run on faster hardware

## Configuration

Edit [baseline-all-decks.json](./baseline-all-decks.json) to document your experiment parameters. The JSON file serves as documentation - the actual execution uses the TypeScript script.

## Documentation

See [experiments/README.md](./README.md) for full experiment system documentation.
