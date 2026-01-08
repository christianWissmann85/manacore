# ManaCore - Project Guide

## Project Overview

ManaCore is a high-fidelity Magic: The Gathering simulation built as an **AI Research Platform**. We're not building a game—we're building a laboratory for studying:

- **Reinforcement Learning**: Can agents master MTG from scratch?
- **Large Language Models**: Can semantic understanding beat brute-force search?
- **AI Creativity**: Can AI invent new strategies and deck archetypes?

### Core Principles

1. **Correctness**: Faithful MTG rules implementation (302+ cards from 6th Edition)
2. **Performance**: 1,000+ games/second for AI training
3. **Research-First**: Every feature serves the AI research mission
4. **Accessibility**: Easy entry for ML researchers (`pip install manacore-gym`)

---

## Roadmap v2.0 - "A New Hope"

Development follows four parallel tracks:

| Track | Focus | Status |
|-------|-------|--------|
| [🏛️ Track A](docs/TRACK_A_INFRASTRUCTURE.md) | Gym bridge, data pipeline, orchestrator | 🔜 Phase 1 |
| [🧠 Track B](docs/TRACK_B_AGENTS.md) | Neural nets, PPO, Llama-Mage | Planned |
| [🧪 Track C](docs/TRACK_C_EXPERIMENTS.md) | Research questions, papers | Planned |
| [🔮 Track D](docs/TRACK_D_METAGAME.md) | Deck building, creativity | Stretch |

### Current Phase: Phase 1 - The Gym Bridge

**Goal**: Create Python bindings so ML researchers can train agents with standard tools.

**Key Deliverables**:
- `packages/gym-server/` - HTTP server exposing engine API
- `packages/python-gym/` - Gymnasium environment (PyPI package)
- Example PPO training scripts with Stable Baselines3

See [ROADMAP.md](ROADMAP.md) for full phase details.

---

## Architecture

### Design Principles

1. **Pure Functions**: Immutable state transformations
2. **Zero UI Dependencies**: Engine has no UI dependencies
3. **Type Safety**: Comprehensive TypeScript types
4. **Testability**: 1,267+ automated tests
5. **Simulation-First**: Optimized for thousands of games

### Core Concepts

```
Action → Validator → Reducer → New State
```

- **GameState**: Immutable snapshot (cloned via `structuredClone`)
- **Actions**: Typed commands (PLAY_LAND, CAST_SPELL, etc.)
- **Validators**: Check if actions are legal
- **Reducers**: Apply actions to produce new state
- **getLegalActions()**: Returns all valid actions (critical for AI)

### Package Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Clients                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ CLI Client   │  │ MCP Server   │  │ Gym Server   │ ← NEW    │
│  │  (readline)  │  │  (Claude)    │  │  (Python)    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼─────────────────┼─────────────────┼──────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Package                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │ RandomBot  │  │ GreedyBot  │  │  MCTSBot   │  │ NeuralBot│ │
│  │ (baseline) │  │ (heuristic)│  │  (search)  │  │  (NEW)   │ │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘ │
│                                                                  │
│  ┌────────────────────┐  ┌─────────────────────────────────┐   │
│  │ Evaluation Function│  │ Training Data Collector         │   │
│  │ (5 tuned weights)  │  │ (25-dim features + reasoning)   │   │
│  └────────────────────┘  └─────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Engine Package (STABLE)                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │   State    │  │  Actions   │  │   Rules    │  │  Cards   │ │
│  │ Management │  │ & Reducers │  │  Engine    │  │  (302+)  │ │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Development

### Current Agents

| Agent | Type | Speed | Strength | Status |
|-------|------|-------|----------|--------|
| RandomBot | Random | 1000+ g/s | Baseline | ✅ Complete |
| GreedyBot | Heuristic | 100-200 g/s | Medium | ✅ Complete |
| MCTSBot | Search | 3-30 g/s | Strong | ✅ Complete (frozen) |

### Planned Agents (Track B)

| Agent | Type | Phase | Purpose |
|-------|------|-------|---------|
| NeuralImitator | Behavior Cloning | 2 | Validate ML pipeline |
| PPO Specialists | RL | 3 | Deck-specific agents |
| Llama-Mage | Fine-tuned LLM | 5 | Interpretable reasoning |
| AlphaCore | Self-play NN | 6 | Peak performance |

### Bot Interface

All bots implement the `Bot` interface in `packages/ai/src/bots/Bot.ts`:

```typescript
export interface Bot {
  getName(): string;
  chooseAction(state: GameState, playerId: PlayerId): Action;
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
  getLegalActions,    // Returns Action[] - ALL valid moves
  applyAction,        // Returns new GameState (immutable)
  validateAction,     // Returns string[] of errors

  // Game setup
  initializeGame,
  getRandomTestDeck,
  ALL_TEST_DECKS,
} from '@manacore/engine';
```

### Evaluation Function

The evaluation function uses 5 tuned weights:

```typescript
TUNED_WEIGHTS = {
  life: 0.31,    // Life differential
  board: 0.46,  // Creature power/toughness
  cards: 0.09,  // Hand size advantage
  mana: 0.08,   // Land count
  tempo: 0.05,  // Untapped permanents
}
```

### Training Data Collection

The `TrainingDataCollector` captures 25-dimensional feature vectors:

```typescript
// Features extracted per decision
interface StateFeatures {
  // Life (normalized)
  playerLife, opponentLife, lifeDelta

  // Board state
  playerCreatureCount, opponentCreatureCount
  playerTotalPower, opponentTotalPower
  // ... 18 more features
}
```

---

## Monorepo Structure

```
manacore/
├── packages/
│   ├── engine/              # Pure game logic (STABLE)
│   │   ├── src/
│   │   │   ├── state/       # GameState, PlayerState
│   │   │   ├── actions/     # Action types, validators, reducers
│   │   │   ├── rules/       # Stack, combat, triggers
│   │   │   └── utils/       # Game initialization
│   │   ├── data/cards/      # 6ed.json (342 cards)
│   │   └── tests/           # 1,267 tests
│   │
│   ├── ai/                  # AI implementations
│   │   ├── src/
│   │   │   ├── bots/        # RandomBot, GreedyBot, MCTSBot
│   │   │   ├── evaluation/  # Board evaluation (tuned)
│   │   │   ├── search/      # MCTS implementation
│   │   │   └── training/    # TrainingDataCollector
│   │   └── data/
│   │       └── human-training/  # LLM-generated training data
│   │
│   ├── mcp-server/          # Claude Code integration
│   ├── cli-client/          # Command-line interface
│   ├── orchestrator/        # Multi-provider LLM API (Phase 4)
│   ├── gym-server/          # HTTP server for Python (Phase 1)
│   └── python-gym/          # Gymnasium environment (Phase 1)
│
├── docs/
│   ├── TRACK_A_INFRASTRUCTURE.md
│   ├── TRACK_B_AGENTS.md
│   ├── TRACK_C_EXPERIMENTS.md
│   └── TRACK_D_METAGAME.md
│
├── experiments/             # JSON experiment configs
├── scripts/                 # Utility scripts
├── ROADMAP.md              # Master roadmap (v2.0)
├── CLAUDE.md               # This file
└── ARCHITECTURE.md         # Detailed architecture
```

---

## Development Commands

### Runtime: Bun

```bash
bun install                  # Install dependencies
bun run check               # TypeScript + ESLint + Prettier
bun test                    # Run all tests
bun test:quiet              # Quiet mode (hide passing tests)
```

### Running Experiments

```bash
cd packages/cli-client

# Run from config files (recommended)
bun src/index.ts run ../../experiments/simulate-mcts-vs-greedy.json

# Quick commands
bun src/index.ts simulate 100 --p1 mcts-eval --p2 greedy
bun src/index.ts play        # Interactive play
```

### MCP Server (Claude Code Integration)

The MCP server allows Claude to play MTG interactively:

```bash
# Tools available:
# manacore_start_game, manacore_get_game, manacore_play_action,
# manacore_inspect_card, manacore_resign
```

**Note**: Full games require playing in the main conversation (not Task agents) due to token limits.

### Training Data Generation

```bash
# Generate training data with LLM reasoning
bun scripts/generate-training-data.ts --games 100 --parallel 3

# Check coverage and quality
bun scripts/generate-coverage-report.ts
```

---

## Performance

ManaCore is optimized for AI training:

| Metric | Current | Notes |
|--------|---------|-------|
| Games/second | 1,000+ | Engine simulation |
| Action time | <1ms | Typical moves |
| Full game | <30ms | 50 turns, 100 actions |
| MCTS iterations | 500 | Frozen baseline |

---

## Quality Gates

Every feature must pass:

1. **Unit Tests**: `bun test:quiet` passes
2. **Linting**: `bun run check` passes
3. **Simulation**: 100+ bot games without errors

---

## Key File Locations

| What | Where |
|------|-------|
| Bot interface | `packages/ai/src/bots/Bot.ts` |
| MCTS implementation | `packages/ai/src/search/MCTS.ts` |
| Evaluation function | `packages/ai/src/evaluation/evaluate.ts` |
| Training data collector | `packages/ai/src/training/TrainingDataCollector.ts` |
| Game state types | `packages/engine/src/state/` |
| Legal actions | `packages/engine/src/actions/getLegalActions.ts` |
| MCP server | `packages/mcp-server/src/index.ts` |
| Experiment configs | `experiments/*.json` |

---

## Documentation

### Roadmap & Tracks
- [ROADMAP.md](ROADMAP.md) - Master roadmap (v2.0)
- [Track A: Infrastructure](docs/TRACK_A_INFRASTRUCTURE.md) - Gym, data, orchestrator
- [Track B: Agents](docs/TRACK_B_AGENTS.md) - Neural nets, PPO, LLM agents
- [Track C: Experiments](docs/TRACK_C_EXPERIMENTS.md) - Research questions
- [Track D: Meta-Game](docs/TRACK_D_METAGAME.md) - Deck building, creativity

### Technical
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [packages/engine/docs/CARD_STATUS.md](packages/engine/docs/CARD_STATUS.md) - Card implementation
- [experiments/README.md](experiments/README.md) - Experiment runner guide

### Archives
- [docs/archive/ROADMAP_v1_GAME_ERA.md](docs/archive/ROADMAP_v1_GAME_ERA.md) - Original roadmap

---

## Research Goals

1. **Can RL agents learn MTG from scratch?**
   - Train PPO specialists through curriculum learning
   - Target: Beat MCTSBot-500 consistently

2. **Can LLMs play MTG better than search?**
   - Fine-tune Llama on Claude reasoning data
   - Target: Competitive win rate with interpretable decisions

3. **Can AI invent new strategies?**
   - Use genetic algorithms to evolve decks
   - Target: Discover novel archetypes

---

**Welcome to the AI Research Era! 🎴🤖**
