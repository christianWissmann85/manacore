# ManaCore 🎴🤖

**AI Research Platform for Magic: The Gathering**

> Train reinforcement learning agents, fine-tune LLMs, and discover novel strategies in the complex environment of Magic: The Gathering.

![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-Research%20Platform-purple)
![Simulation Speed](https://img.shields.io/badge/sim%20speed-1000%2B%20games%2Fsec-green)
![Cards](https://img.shields.io/badge/cards-302%2B%20implemented-orange)

---

## Vision

ManaCore is an **AI Research Laboratory** disguised as a card game engine. We're exploring fundamental questions in artificial intelligence:

| Research Question                      | Approach                                 |
| -------------------------------------- | ---------------------------------------- |
| Can RL agents master MTG from scratch? | PPO specialists with curriculum learning |
| Can LLMs beat brute-force search?      | Fine-tuned Llama vs MCTS showdown        |
| Can AI invent new strategies?          | Genetic algorithms for deck evolution    |

**This is not a consumer game client.** It's a high-fidelity simulation optimized for running millions of training games.

---

## Features

### Engine

- **302+ cards** from 6th Edition with faithful rules implementation
- **1,000+ games/second** simulation speed
- **Deterministic replay** with seed-based RNG
- **1,267 automated tests** ensuring correctness

### AI Agents

| Agent           | Type                   | Strength | Status      |
| --------------- | ---------------------- | -------- | ----------- |
| RandomBot       | Baseline               | Weak     | ✅ Complete |
| GreedyBot       | Heuristic              | Medium   | ✅ Complete |
| MCTSBot         | Search                 | Strong   | ✅ Complete |
| NeuralBot       | Neural Network         | TBD      | 🔜 Phase 2  |
| PPO Specialists | Reinforcement Learning | TBD      | 🔜 Phase 3  |
| Llama-Mage      | Fine-tuned LLM         | TBD      | 🔜 Phase 5  |

### Infrastructure

- **MCP Server** - Claude Code can play MTG interactively
- **Training Data Collector** - 25-dimensional feature vectors with LLM reasoning
- **Experiment Runner** - JSON-based reproducible research configs
- **Gym Bridge** - Python bindings for ML frameworks (coming in Phase 1)

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- Basic TypeScript/Python knowledge

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/manacore.git
cd manacore

# Install dependencies
bun install

# Fetch card data (required, not distributed)
bun run fetch-cards
```

### Run Your First Experiment

```bash
cd packages/cli-client

# Bot vs bot simulation (100 games)
bun src/index.ts run ../../experiments/simulate-mcts-vs-greedy.json

# Interactive play against AI
bun src/index.ts play
```

### Coming Soon: Python Gym

```python
# Phase 1 deliverable
import gymnasium as gym
import manacore_gym

env = gym.make("ManaCore-v0", opponent="mcts")
obs, info = env.reset()

# Train with Stable Baselines3
from sb3_contrib import MaskablePPO
model = MaskablePPO("MlpPolicy", env)
model.learn(total_timesteps=100_000)
```

### Jupyter Notebooks

Try ManaCore in interactive notebooks:

```bash
# One-line setup with uv
./scripts/setup-notebooks.sh

# Or manually
cd packages/python-gym
uv sync --extra notebook
```

Then open [packages/python-gym/notebooks/01_getting_started.ipynb](packages/python-gym/notebooks/01_getting_started.ipynb) in VS Code and select the `.venv` kernel.

---

## Research Roadmap

ManaCore follows a multi-track development approach:

| Track                 | Focus                                       | Current Phase |
| --------------------- | ------------------------------------------- | ------------- |
| 🏛️ **Infrastructure** | Gym bridge, data pipeline, LLM orchestrator | Phase 1       |
| 🧠 **Agents**         | Neural nets, PPO, Llama-Mage, AlphaZero     | Phase 2+      |
| 🧪 **Experiments**    | LLM vs MCTS, transfer learning, papers      | Phase 5+      |
| 🔮 **Meta-Game**      | GA deck building, AI creativity             | Phase 8+      |

### Phase 1: The Gym Bridge (Current)

Creating Python bindings for ML researchers:

- `packages/gym-server/` - HTTP server exposing engine API
- `packages/python-gym/` - Gymnasium environment  
- Example training scripts with Stable Baselines3

See [ROADMAP.md](ROADMAP.md) for full details.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Clients                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ CLI Client │  │ MCP Server │  │ Gym Server │  ← NEW     │
│  │            │  │  (Claude)  │  │  (Python)  │            │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘            │
└────────┼───────────────┼───────────────┼────────────────────┘
         │               │               │
         ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI Package                                │
│  RandomBot │ GreedyBot │ MCTSBot │ NeuralBot │ Llama-Mage  │
│                                                              │
│  Evaluation Function (tuned) │ Training Data Collector      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Engine Package (302+ cards)                     │
│  State Management │ Actions & Reducers │ Rules Engine       │
└─────────────────────────────────────────────────────────────┘
```

---

## Experiment Templates

| Template                       | Purpose                        |
| ------------------------------ | ------------------------------ |
| `simulate-mcts-vs-greedy.json` | Bot vs bot matchup             |
| `benchmark-all-bots.json`      | Full comparison with ELO       |
| `collect-training-fast.json`   | ML training data (GreedyBot)   |
| `collect-training-mcts.json`   | ML training data (MCTS)        |
| `tune-weights-evolve.json`     | Evaluation weight optimization |

```bash
# Run any experiment
cd packages/cli-client
bun src/index.ts run ../../experiments/<template>.json
```

---

## Training Data

ManaCore generates high-quality training data with:

- **25-dimensional state features** (normalized for neural networks)
- **Action selection context** (legal actions, chosen action)
- **Strategic reasoning** (when generated via Claude/Gemini)

```bash
# Generate training data with LLM reasoning
bun scripts/generate-training-data.ts --games 100

# Check data quality
bun scripts/generate-coverage-report.ts
```

---

## Documentation

| Document                                  | Description                     |
| ----------------------------------------- | ------------------------------- |
| [ROADMAP.md](ROADMAP.md)                  | Master roadmap (v2.0)           |
| [CLAUDE.md](CLAUDE.md)                    | Project guide for AI assistants |
| [Track A](docs/TRACK_A_INFRASTRUCTURE.md) | Infrastructure details          |
| [Track B](docs/TRACK_B_AGENTS.md)         | Agent development               |
| [Track C](docs/TRACK_C_EXPERIMENTS.md)    | Research experiments            |
| [Track D](docs/TRACK_D_METAGAME.md)       | Deck building & creativity      |

---

## Performance

| Metric            | Value               |
| ----------------- | ------------------- |
| Simulation speed  | 1,000+ games/second |
| Action resolution | <1ms typical        |
| Full game         | <30ms (50 turns)    |
| Cards implemented | 302+ (6th Edition)  |
| Test coverage     | 1,267 tests         |

---

## Contributing

ManaCore is designed for AI researchers:

1. **Easy Entry**: `pip install manacore-gym` (coming Phase 1)
2. **Reproducible**: Seed-based determinism, JSON experiment configs
3. **Extensible**: Add your own agents via the Bot interface
4. **Documented**: Comprehensive guides for each track

---

## Legal Disclaimer

**ManaCore is a non-commercial, open-source research project.**

**Wizards of the Coast Fan Content Policy:**
ManaCore is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

**Asset Policy:**
This repository does not contain or distribute card images or copyrighted text. All game data is fetched locally by the user via the Scryfall API for personal research purposes only.

---

## Citation

If you use ManaCore in your research, please cite:

```bibtex
@software{manacore2026,
  title = {ManaCore: AI Research Platform for Magic: The Gathering},
  year = {2026},
  url = {https://github.com/christianWissmann85/manacore}
}
```

---

**Built with ❤️ for AI Research**

_"The only way to win is to play a million games."_
