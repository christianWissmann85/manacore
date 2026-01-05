# @manacore/cli-client

**Terminal interface for testing and simulation**

> A powerful command-line tool for running bot simulations, interactive gameplay, and performance benchmarking. Built for researchers and developers working with the ManaCore engine.

---

## 📦 Overview

The `@manacore/cli-client` package provides a **terminal-based interface** for interacting with the ManaCore game engine. It's designed for:

- 🤖 **Bot vs Bot Simulations** - Run hundreds of games to test AI strategies
- 🎮 **Interactive Play Mode** - Play against bots with ASCII art visualization
- 📊 **Performance Benchmarking** - Measure simulation speed and bot performance
- 🐛 **Debugging Tools** - Rich error snapshots and verbose logging

**Key Features:**
- 🎨 **ASCII Art Renderer** - Beautiful terminal-based game state visualization
- ⚡ **Batch Processing** - Simulate 100+ games in seconds
- 📈 **Statistical Analysis** - Deck performance, matchup win rates, turn distributions
- 🔍 **Error Diagnostics** - Detailed state snapshots when things go wrong
- 🎲 **Deterministic Replay** - Reproduce any game with seed values

---

## 🚀 Quick Start

### Installation

```bash
# From monorepo root
bun install

# Or directly in cli-client package
cd packages/cli-client
bun install
```

### Basic Commands

```bash
# Interactive play mode (Human vs Bot)
bun src/index.ts play

# Run 100 bot vs bot simulations
bun src/index.ts simulate 100

# Quick benchmark (GreedyBot vs RandomBot)
bun src/index.ts benchmark 10

# Get help
bun src/index.ts help
```

---

## 🎮 Commands

### `play` - Interactive Mode

Play against a bot with an ASCII art interface.

```bash
bun src/index.ts play
```

**Features:**
- Visual game state display with battlefield, hand, and zones
- Action menu with numbered choices
- Real-time updates as the bot plays
- Keyboard commands: `list`, `state`, `quit`

**Example Output:**
```
════════════════════════════════════════════════════════════════════════════════
 TURN 3 - PLAYER (main1/main)
════════════════════════════════════════════════════════════════════════════════

OPPONENT: ❤️  18 life | 💎 Mana Pool: Empty | ⚡ 3 untapped lands
  📚 Library: 53 | ✋ Hand: 5 | 🪦 Graveyard: 2

────────────────────────────────────────────────────────────────────────────────
BATTLEFIELD
────────────────────────────────────────────────────────────────────────────────
  Opponent's side:
    Lands: ISL ISL [ISL]
    Air Elemental (4/4) {Flying}

  Your side:
    Lands: FOR FOR [FOR]
    Grizzly Bears (2/2) [ATK]

────────────────────────────────────────────────────────────────────────────────
YOU: ❤️  20 life | 💎 Mana Pool: {1}{G} | ⚡ 2 untapped lands
  📚 Library: 50 | ✋ Hand: 4 | 🪦 Graveyard: 0

HAND:
  [0] Forest
  [1] Grizzly Bears {1}{G}
  [2] Giant Growth {G}
  [3] Llanowar Elves {G}

Your turn! Available actions:
  [0] Play land: Forest
  [1] Cast spell: Grizzly Bears
  [2] Cast spell: Llanowar Elves
  [3] Declare attackers
  [4] Pass priority
  [5] End turn
```

### `simulate` - Batch Simulations

Run multiple bot vs bot games and collect statistics.

```bash
# Basic usage
bun src/index.ts simulate [count]

# With options
bun src/index.ts sim 100 --p1 greedy --p2 random --turns 50 --verbose
```

**Options:**
- `--p1 <bot>` - Player 1 bot type (`random`, `greedy`)
- `--p2 <bot>` - Player 2 bot type (`random`, `greedy`)
- `--turns <n>` - Maximum turns per game (default: 100)
- `--verbose, -v` - Show detailed logs and error snapshots

**Example Output:**
```
🎮 Running 100 games: GreedyBot vs RandomBot

  Progress: 0/100 games
  Progress: 10/100 games
  Progress: 20/100 games
  ...
  Progress: 90/100 games

════════════════════════════════════════════════════════════
  SIMULATION RESULTS
════════════════════════════════════════════════════════════
Games: 100/100 | Errors: 0
Turns: 5-42 (avg 18.3)

────────────────────────────────────────────────────────────
  OVERALL
────────────────────────────────────────────────────────────
P1 wins: 72 (72%) | P2 wins: 25 (25%) | Draws: 3 (3%)

────────────────────────────────────────────────────────────
  DECK PERFORMANCE
────────────────────────────────────────────────────────────
🟥 Red    15W-3L-1D (79%) [19 games]
🟩 Green  18W-6L-0D (75%) [24 games]
⬜ White  12W-8L-1D (57%) [21 games]
🟦 Blue   14W-10L-1D (56%) [25 games]
⬛ Black  8W-8L-0D (50%) [16 games]

────────────────────────────────────────────────────────────
  TOP MATCHUPS (P1 perspective)
────────────────────────────────────────────────────────────
red vs blue: 4W-1L-0D (80%) [5x]
green vs black: 3W-1L-0D (75%) [4x]
white vs red: 2W-2L-0D (50%) [4x]
════════════════════════════════════════════════════════════
✅ All games completed successfully!
```

### `benchmark` - Performance Testing

Run a quick benchmark to measure simulation speed and bot performance.

```bash
# Basic usage
bun src/index.ts benchmark [count]

# With debugging
bun src/index.ts bench 20 --turns 100 --debug
```

**Options:**
- `--debug, -d` - Enable debug mode for GreedyBot (shows decision stats)
- `--debug-verbose, -dv` - Show detailed progress for each game/turn
- `--turns <n>` - Maximum turns per game (default: 100)

**Example Output:**
```
🏆 ManaCore - Bot Benchmark

Running 10 games: GreedyBot vs RandomBot

🎮 Running 10 games: GreedyBot vs RandomBot

  Progress: 0/10 games

════════════════════════════════════════════════════════════
  SIMULATION RESULTS
════════════════════════════════════════════════════════════
Games: 10/10 | Errors: 0
Turns: 8-35 (avg 19.8)

────────────────────────────────────────────────────────────
  OVERALL
────────────────────────────────────────────────────────────
P1 wins: 7 (70%) | P2 wins: 3 (30%) | Draws: 0 (0%)

📊 GreedyBot Win Rate: 70.0%
⏱️  Total time: 2.3s (0.23s/game)
🧠 Decisions: 1247 | Actions evaluated: 18432 | Avg: 14.8/decision
```

---

## 🎨 ASCII Art Renderer

The cli-client includes a sophisticated ASCII art renderer that displays:

### Game State Components

```typescript
import { renderGameState } from '@manacore/cli-client';

// Render complete game state
const display = renderGameState(state, 'player');
console.log(display);
```

**Displays:**
- **Header** - Turn count, active player, phase/step
- **Opponent Summary** - Life, mana pool, untapped lands
- **Opponent Zones** - Library, hand, graveyard counts
- **Battlefield (Opponent)** - Creatures, lands, other permanents
- **Battlefield (Player)** - Your permanents
- **Stack** - Spells/abilities resolving (if any)
- **Player Summary** - Your life, mana, resources
- **Player Zones** - Your zone counts
- **Hand** - Your cards with mana costs

### Creature Display Format

```
[T] Grizzly Bears (2/2) (-1) {Flying, First Strike} [Regenerate]
│   │              │    │     │                      └─ Activated abilities
│   │              │    │     └─ Keywords
│   │              │    └─ Damage marked
│   │              └─ Power/Toughness
│   └─ Creature name
└─ Status flags: [T]=Tapped, [ATK]=Attacking, [BLK]=Blocking, [SICK]=Summoning sick
```

### Color-Coded Decks

```
⬜ White   🟦 Blue   ⬛ Black   🟥 Red   🟩 Green
```

---

## 📊 Statistics & Analysis

The simulation system tracks comprehensive statistics:

### Overall Statistics
- **Win/Loss/Draw counts** for each bot
- **Turn distributions** - min, max, average
- **Completion rate** - successful vs errored games

### Deck Performance
- **Per-color win rates** - Which decks perform best
- **Games played** - Sample size for each color
- **Win-Loss-Draw records** - Complete statistics

### Matchup Analysis
- **Head-to-head records** - How each deck fares against others
- **Matchup frequency** - Most common pairings
- **Asymmetric analysis** - Different from P1 vs P2 perspective

### Bot Metrics (GreedyBot)
- **Total decisions made** - How many times the bot chose an action
- **Actions evaluated** - Total number of actions considered
- **Average branching factor** - Actions per decision point

---

## 🛠️ API Reference

### Commands Module

#### `runSimulation()`

Run multiple games between two bots.

```typescript
import { runSimulation } from '@manacore/cli-client';
import { RandomBot, GreedyBot } from '@manacore/ai';

const results = await runSimulation(
  new GreedyBot(),
  new RandomBot(),
  {
    gameCount: 100,
    maxTurns: 100,
    verbose: false,
    seed: 12345,
  }
);

console.log(`Win rate: ${results.playerWins / results.gamesCompleted}`);
```

**Options:**
```typescript
interface SimulationOptions {
  gameCount: number;        // Number of games to run
  maxTurns?: number;        // Max turns per game (default: 100)
  verbose?: boolean;        // Show detailed logs (default: false)
  debugVerbose?: boolean;   // Show per-turn progress (default: false)
  seed?: number;            // RNG seed for reproducibility
}
```

**Returns:**
```typescript
interface SimulationResults {
  totalGames: number;
  playerWins: number;
  opponentWins: number;
  draws: number;
  averageTurns: number;
  minTurns: number;
  maxTurns: number;
  errors: number;
  gamesCompleted: number;
  deckStats: Record<DeckColor, DeckStats>;
  matchups: Record<string, MatchupStats>;
}
```

#### `printResults()`

Pretty-print simulation results to console.

```typescript
import { printResults } from '@manacore/cli-client';

printResults(results, 'GreedyBot', 'RandomBot');
```

#### `playGame()`

Start an interactive game against a bot.

```typescript
import { playGame } from '@manacore/cli-client';
import { RandomBot } from '@manacore/ai';

await playGame(new RandomBot());
```

### Display Module

#### `renderGameState()`

Render complete game state as ASCII art.

```typescript
import { renderGameState } from '@manacore/cli-client';

const display = renderGameState(state, 'player');
console.log(display);
```

#### Utility Functions

```typescript
import {
  clearScreen,      // Clear the terminal
  printSeparator,   // Print a line separator
  printError,       // Print error message with ❌
  printSuccess,     // Print success message with ✅
  printInfo,        // Print info message with ℹ️
} from '@manacore/cli-client';

clearScreen();
printSeparator(80);
printError('Something went wrong!');
printSuccess('Action completed!');
printInfo('Opponent is thinking...');
```

---

## 🐛 Debugging & Error Diagnostics

### Error Snapshots

When errors occur in verbose mode, the cli-client generates detailed snapshots:

```
════════════════════════════════════════════════════════════════════════════════
  ERROR STATE SNAPSHOT
════════════════════════════════════════════════════════════════════════════════

ERROR:
  No legal actions for player (phase=main1, step=main)

GAME STATE:
  Turn: 5
  Phase: main1
  Step: main
  Active Player: player
  Priority Player: player
  Game Over: false
  Winner: none

PLAYER:
  Life: 18
  Hand: 3 cards
  Library: 45 cards
  Graveyard: 2 cards
  Battlefield: 5 permanents
    Permanents:
      - Forest
      - Forest (tapped)
      - Mountain (tapped)
      - Grizzly Bears (tapped, attacking)
      - Lightning Bolt

RECENT ACTIONS (last 10):
  1. [player] Play land: Forest
  2. [player] Cast spell: Grizzly Bears
  3. [player] Pass priority
  4. [opponent] Pass priority
  5. [player] Declare attackers: Grizzly Bears
  ...

LEGAL ACTIONS FOR PRIORITY PLAYER:
  (NONE - this is the problem!)
```

**Snapshot Features:**
- Complete game state at time of error
- Recent action history (last 50 actions)
- Player states (life, zones, battlefield)
- Legal actions available
- Seed value for reproducibility
- Automatic file export (`error-snapshot-game42-2026-01-05.txt`)

### Debug Verbose Mode

Track game progress in real-time:

```bash
bun src/index.ts simulate 10 --debug-verbose
```

**Shows:**
- Turn transitions
- Phase changes
- Action counts
- Infinite loop detection (warns at 500+ actions/turn)

---

## 🔬 Research Use Cases

### 1. Bot Strategy Comparison

```bash
# Compare different bot strategies
bun src/index.ts sim 100 --p1 greedy --p2 random
bun src/index.ts sim 100 --p1 greedy --p2 greedy
```

### 2. Deck Balance Testing

```bash
# Run large simulation to identify overpowered decks
bun src/index.ts simulate 1000 --turns 50
```

Analyze the "DECK PERFORMANCE" section to see which colors dominate.

### 3. Performance Profiling

```bash
# Measure simulation speed
bun src/index.ts benchmark 100

# Compare with different turn limits
bun src/index.ts benchmark 100 --turns 20
bun src/index.ts benchmark 100 --turns 100
```

### 4. Deterministic Debugging

When you find a bug, capture the seed:

```typescript
// In your test or simulation
const results = await runSimulation(bot1, bot2, {
  gameCount: 1,
  seed: 12345, // Use this to reproduce the exact game
  verbose: true,
});
```

Then replay the exact same game:
```bash
# Modify simulate.ts to use seed: 12345
bun src/index.ts simulate 1 --verbose
```

### 5. Interactive Testing

Use play mode to manually test specific scenarios:

```bash
bun src/index.ts play
```

Useful for:
- Understanding bot decision-making
- Testing new card implementations
- Debugging specific game situations
- Learning the engine's behavior

---

## 🎯 Advanced Usage

### Custom Bot Integration

```typescript
import type { Bot } from '@manacore/ai';
import type { GameState, Action } from '@manacore/engine';
import { playGame } from '@manacore/cli-client';

class MyCustomBot implements Bot {
  getName(): string {
    return 'MyBot v1.0';
  }

  chooseAction(state: GameState, playerId: PlayerId): Action {
    // Your bot logic here
    const actions = getLegalActions(state, playerId);
    return actions[0];
  }
}

// Test your bot
await playGame(new MyCustomBot());
```

### Programmatic Simulation

```typescript
import { runSimulation } from '@manacore/cli-client';
import { GreedyBot, RandomBot } from '@manacore/ai';

async function analyzeStrategy() {
  const results = await runSimulation(
    new GreedyBot(),
    new RandomBot(),
    { gameCount: 1000, maxTurns: 50 }
  );

  // Export results to CSV
  const csv = convertToCSV(results);
  await Bun.write('results.csv', csv);

  // Calculate confidence intervals
  const winRate = results.playerWins / results.gamesCompleted;
  const stdErr = Math.sqrt((winRate * (1 - winRate)) / results.gamesCompleted);
  console.log(`Win rate: ${(winRate * 100).toFixed(1)}% ± ${(stdErr * 100).toFixed(1)}%`);
}
```

---

## 🧪 Testing

The cli-client itself doesn't have extensive tests (it's primarily a UI/tool), but you can test it manually:

```bash
# Test all commands
bun src/index.ts help
bun src/index.ts play     # Press 'q' to quit quickly
bun src/index.ts sim 1
bun src/index.ts bench 1
```

---

## 🤝 Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

### CLI-Specific Guidelines

1. **Keep ASCII art readable** - Test on different terminal sizes
2. **Preserve error context** - Always capture game state on failures
3. **Add progress indicators** - Long operations should show progress
4. **Test cross-platform** - Verify on Linux, macOS, Windows
5. **Document new commands** - Update this README and help text

---

## 📚 Further Reading

- [Engine README](../engine/README.md) - Core game logic
- [AI Package README](../ai/README.md) - Bot implementations
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - Overall system design

---

## 📝 License

MIT © 2026 ManaCore

**Disclaimer:** This is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
