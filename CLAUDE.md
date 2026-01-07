# ManaCore - Project Guide

## Project Overview

ManaCore is a high-fidelity implementation of Magic: The Gathering rules, built specifically for AI research. The project prioritizes:

- **Correctness**: Faithful MTG rules implementation
- **Performance**: 1,000+ games/second for AI training
- **Simplicity**: Pure functions, immutable state, zero UI dependencies

---

## Architecture

### Design Principles

1. **Pure Functions**: The game engine uses pure, immutable state transformations
2. **Zero UI Dependencies**: Engine package has zero dependencies on UI libraries
3. **Type Safety**: Comprehensive TypeScript types throughout
4. **Testability**: Every feature backed by automated tests
5. **Simulation-First**: Optimized for running thousands of games for AI training

### Core Concepts

```
Action → Validator → Reducer → New State
```

- **GameState**: Immutable snapshot of the entire game (cloned via `structuredClone`)
- **Actions**: Typed commands representing player choices (PLAY_LAND, CAST_SPELL, etc.)
- **Validators**: Pure functions that check if actions are legal
- **Reducers**: Pure functions that apply actions to produce new state
- **getLegalActions()**: Returns all valid actions for current player (critical for AI)

### Package Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Clients                              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │  CLI Client    │  │  Web Client    │  │ Data Scraper │  │
│  │   (readline)   │  │    (React)     │  │  (Scryfall)  │  │
│  └────────┬───────┘  └────────┬───────┘  └──────┬───────┘  │
└───────────┼──────────────────┼──────────────────┼──────────┘
            │                  │                  │
┌───────────┼──────────────────┼──────────────────┘
│           ▼                  ▼
│  ┌─────────────────────────────────────┐
│  │          AI Package                 │
│  │  ┌──────────┐  ┌──────────────┐   │
│  │  │ Bot      │  │  MCTS/       │   │
│  │  │ Interface│  │  Evaluation  │   │
│  │  └──────────┘  └──────────────┘   │
│  └────────────────┬────────────────────┘
│                   │
│                   ▼
│  ┌─────────────────────────────────────────────────┐
│  │            Engine Package (STABLE)              │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │  │   State    │  │  Actions   │  │  Rules   │ │
│  │  │ Management │  │ & Reducers │  │  Engine  │ │
│  │  └────────────┘  └────────────┘  └──────────┘ │
│  └─────────────────────────────────────────────────┘
└──────────────────────────────────────────
```

---

## Development Phases

### ✅ Phase 0: Foundation COMPLETE

### ✅ Phase 1: Core MTG Rules COMPLETE

### ✅ Phase 1.5: Integration Testing & Documentation COMPLETE

### ✅ Phase 2: Hidden Information & Smart AI COMPLETE

### Phase 2.5: The Bridge 🛠️ NEXT

### 🔜 Phase 3-5: Visualization, Research Tools, Machine Learning

See ROADMAP.md for full details.

---

## Phase 2 Focus: AI Development

### Bot Interface

All bots implement the `Bot` interface in `packages/ai/src/bots/Bot.ts`:

```typescript
export interface Bot {
  getName(): string;
  decide(state: GameState): Action;
}
```

### Key Engine APIs for AI

```typescript
import {
  // State
  GameState,
  getPlayer,
  getOpponent,

  // Actions
  getLegalActions, // Returns Action[] - ALL valid moves
  applyAction, // Returns new GameState (immutable)
  validateAction, // Returns string[] of errors

  // Game setup
  initializeGame,
  getRandomTestDeck,
  ALL_TEST_DECKS,
} from '@manacore/engine';
```

### MCTS Implementation Notes

1. **State Cloning**: Use `structuredClone(state)` for tree nodes
2. **Legal Actions**: `getLegalActions(state)` returns all valid moves
3. **Terminal Detection**: Check `state.gameOver` and `state.winner`
4. **Hidden Information**: Opponent's hand is in `state.players.opponent.hand`
   - For determinization, shuffle unknown cards into possible positions

### Evaluation Function Inputs

Key state properties for heuristics:

```typescript
// Life totals
state.players.player.life;
state.players.opponent.life;

// Board presence
state.players.player.battlefield; // CardInstance[]
state.players.opponent.battlefield;

// Card advantage
state.players.player.hand.length;
state.players.opponent.hand.length;

// Mana available
state.players.player.manaPool;

// Game progression
state.turnNumber;
state.phase; // 'main1' | 'combat' | 'main2' | etc.
```

### Running AI Experiments

```bash
# Run bot simulations
cd packages/cli-client
bun src/index.ts simulate 1000

# Run with specific decks (modify simulate.ts)
# Compare win rates between bot implementations
```

---

## Monorepo Structure

```
manacore/
├── packages/
│   ├── engine/              # Pure game logic (STABLE - don't modify)
│   │   ├── src/
│   │   │   ├── state/       # GameState, PlayerState, CardInstance
│   │   │   ├── actions/     # Action types, validators, reducers
│   │   │   ├── rules/       # Game rules (stack, combat, triggers)
│   │   │   ├── spells/      # Spell implementations
│   │   │   ├── cards/       # CardLoader
│   │   │   └── utils/       # Game initialization, deck building
│   │   ├── data/cards/      # 6ed.json (342 cards)
│   │   ├── tests/           # 676 tests
│   │   └── docs/            # CARD_STATUS.md, EDGE_CASES.md
│   │
│   ├── ai/                  # AI implementations (PHASE 2 FOCUS)
│   │   ├── src/
│   │   │   ├── bots/        # RandomBot, MCTSBot, etc.
│   │   │   ├── evaluation/  # Board evaluation functions
│   │   │   ├── search/      # MCTS implementation
│   │   │   └── simulation/  # Self-play, tournaments
│   │   └── tests/
│   │
│   ├── cli-client/          # Command-line interface
│   │   └── src/commands/    # play, simulate
│   │
│   └── web-client/          # React dashboard (Phase 3)
│
├── CLAUDE.md                # This file
├── ROADMAP.md               # Full project roadmap
└── ARCHITECTURE.md          # Detailed architecture docs
```

---

## Technical Stack

### Runtime: Bun

```bash
bun <file>                    # Run TypeScript directly
bun test                      # Run tests - verbose output
bun run check                 # TypeScript + ESLint + Prettier
bun install                   # Install dependencies
```

### Testing

```bash
cd packages/engine && bun test          # Run all tests
bun test --watch                        # Watch mode
bun test -t "pattern"                   # Run specific tests                                        
bun test:quiet                          # Hides all successful and skipped tests to avoid bloating your logs.
```

### Simulations

```bash
cd packages/cli-client
bun src/index.ts simulate 1000          # Run 1000 bot games
bun src/index.ts play                   # Interactive play
```

### MCP Server (Claude Code Integration)

The MCP server at `packages/mcp-server/` allows Claude Code to play MTG games interactively.

```bash
# Configuration in .mcp.json (already set up)
# Tools: manacore_start_game, manacore_get_state, manacore_list_actions,
#        manacore_play_action, manacore_inspect_card, manacore_resign
```

**Important: Task Agent Limitations**

MTG games are tool-call-heavy (~50-100+ tool calls per game). Task agents have token limits that cause them to terminate early without warning after ~7 turns.

- **For short tests (5-7 turns)**: Task agents work fine
- **For full games (15+ turns)**: Play in the main conversation directly
- The MCP server itself works perfectly - it's the agent token budget that's limiting

---

## Performance Considerations

ManaCore is designed for **AI training**, which requires:

- Running 10,000+ games for evaluation
- Simulating thousands of possible futures (MCTS)
- Training neural networks with millions of game states

**Current Performance:**

- **1,000+ games/second** in simulation mode
- **<1ms per action** for typical moves
- **<30ms for full game** (50 turns, 100 actions)

**Optimization Opportunities for MCTS:**

1. Incremental state updates instead of full clone
2. Legal action caching between similar states
3. Transposition tables with state hashing
4. Parallel tree search with web workers

---

## Quality Gates

Every feature must pass:

1. **Unit Tests**: `bun test:quiet` passes
2. **Linting**: `bun run check` passes
3. **Simulation**: 100+ bot games without errors

---

## Quick Reference

### Commands

```bash
# Development
bun install                              # Install dependencies
bun run check                           # Full check (types + lint + format)
cd packages/engine && bun test:quiet          # Run engine tests

# AI Development
# From packages/cli-client/
bun src/index.ts run ../../experiments/simulate-mcts-vs-greedy.json
```

### Key File Locations

| What                                                                | Where                                            |
| ------------------------------------------------------------------- | ------------------------------------------------ |
| Bot interface                                                       | `packages/ai/src/bots/Bot.ts`                    |
| RandomBot                                                           | `packages/ai/src/bots/RandomBot.ts`              |
| Game state types                                                    | `packages/engine/src/state/`                     |
| Legal actions                                                       | `packages/engine/src/actions/getLegalActions.ts` |
| Action reducer                                                      | `packages/engine/src/actions/reducer.ts`         |
| Test decks                                                          | `packages/engine/src/utils/gameInit.ts`          |
| Card data                                                           | `packages/engine/data/cards/6ed.json`            |
| Engine tests                                                        | `packages/engine/tests/`                         |
| Card status                                                         | `packages/engine/docs/CARD_STATUS.md`            |
| Edge cases                                                          | `packages/engine/docs/EDGE_CASES.md`             |
| Configuration-based experiment runner for reproducible AI research. | `experiments/README.md`                          |
| MCP Server for Claude Code integration                              | `packages/mcp-server/src/index.ts`               |

---

## Documentation

- **ROADMAP.md**: Full project roadmap and phase details
- **ARCHITECTURE.md**: Detailed architecture documentation
- **packages/engine/docs/CARD_STATUS.md**: Card implementation status
- **packages/engine/docs/EDGE_CASES.md**: Known limitations and quirks

**Happy AI training! 🤖🎴**
