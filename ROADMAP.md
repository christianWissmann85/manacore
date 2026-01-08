# ManaCore: AI Research Platform Roadmap

**Version:** 2.0.0 - "A New Hope"
**Last Updated:** January 8, 2026
**Approach:** Multi-track parallel development, research-first

---

## Vision

ManaCore is a high-fidelity Magic: The Gathering simulation built for AI research. Our mission is to create a platform that enables:

- **Reinforcement Learning** agents that master MTG from scratch (AlphaZero-style)
- **Large Language Model** agents that "understand" cards semantically
- **Comparative studies** between classical search, neural networks, and language models
- **Novel strategy discovery** through genetic algorithms and self-play

This is not just a game engine - it's an **AI research laboratory**.

---

## Research Tracks

Development is organized into four parallel tracks:

| Track                                                        | Focus                                   | Lead Phase | Status  |
| ------------------------------------------------------------ | --------------------------------------- | ---------- | ------- |
| [🏛️ Track A: Infrastructure](docs/TRACK_A_INFRASTRUCTURE.md) | Gym bridge, data pipeline, orchestrator | Phase 1-2  | 🔜 Next |
| [🧠 Track B: Agents](docs/TRACK_B_AGENTS.md)                 | Neural nets, PPO, Llama-Mage            | Phase 2-6  | Planned |
| [🧪 Track C: Experiments](docs/TRACK_C_EXPERIMENTS.md)       | Research questions, papers              | Phase 5+   | Planned |
| [🔮 Track D: Meta-Game](docs/TRACK_D_METAGAME.md)            | Deck building, balance                  | Phase 8+   | Stretch |

---

## Phase Overview

### Foundation Era (Completed)

| Phase | Name              | Status  | Key Deliverable             |
| ----- | ----------------- | ------- | --------------------------- |
| 0     | Foundation        | ✅ Done | Monorepo, basic game loop   |
| 0.5   | Core Rules        | ✅ Done | Stack, combat, mana system  |
| 0.6   | Card Library      | ✅ Done | 302+ cards from 6th Edition |
| 0.7   | MCTS & Evaluation | ✅ Done | MCTSBot, tuned evaluation   |
| 0.8   | MCP Integration   | ✅ Done | Claude Code can play MTG    |

### Research Era (Current)

| Phase  | Name                      | Track | Status  | Key Deliverable                   |
| ------ | ------------------------- | ----- | ------- | --------------------------------- |
| **1**  | **The Gym Bridge**        | A     | 🔜 Next | Python `manacore-gym` package     |
| **2**  | **Data Factory**          | A+B   | Planned | 10K game dataset, Neural Imitator |
| **3**  | **PPO Specialists**       | B     | Planned | Agent Ignis, Agent Aqua           |
| **4**  | **LLM Training Pipeline** | A     | Planned | Multi-provider orchestrator       |
| **5**  | **Llama-Mage**            | B+C   | Planned | Fine-tuned MTG LLM                |
| **6**  | **AlphaZero**             | B     | Planned | Self-play training loop           |
| **7**  | **Transfer Learning**     | C     | Planned | 6ED → Urza's adaptation study     |
| **8+** | **Meta-Game**             | D     | Stretch | GA deck building                  |

---

## Current Status

### What's Built

```
✅ Engine: 302+ cards, 1,267 tests, 1000+ games/sec
✅ AI: RandomBot, GreedyBot, MCTSBot (tuned)
✅ Training Data: 25-dim feature extraction, reasoning capture
✅ MCP Server: 6 tools, hot reload, session management
✅ Experiments: 12 JSON configs, CLI runner
✅ Cloud: Docker, DigitalOcean deployment
```

### What's Next (Phase 1)

```
🔜 packages/gym-server/     - HTTP server for Python bridge
🔜 packages/python-gym/     - Gymnasium environment (PyPI)
🔜 Vectorized environments  - Parallel training support
🔜 Example training scripts - PPO with Stable Baselines3
```

---

## Quick Links

### Documentation

- [Track A: Infrastructure](docs/TRACK_A_INFRASTRUCTURE.md) - Gym, data pipeline, orchestrator
- [Track B: Agents](docs/TRACK_B_AGENTS.md) - Neural nets, PPO, LLM agents
- [Track C: Experiments](docs/TRACK_C_EXPERIMENTS.md) - Research questions, papers
- [Track D: Meta-Game](docs/TRACK_D_METAGAME.md) - Deck building, creativity

### Archives

- [Roadmap v1 (Game Era)](docs/archive/ROADMAP_v1_GAME_ERA.md) - Original game-focused roadmap

### Technical

- [CLAUDE.md](CLAUDE.md) - Project guide for AI assistants
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [packages/engine/docs/CARD_STATUS.md](packages/engine/docs/CARD_STATUS.md) - Card implementation status

---

## Research Goals

### Primary Questions

1. **Can RL agents learn MTG from scratch?**
   - Hypothesis: PPO agents can reach MCTS-level play through self-play
   - Method: Train specialists, measure ELO progression
   - Success: Beat MCTSBot-500 consistently

2. **Can LLMs play MTG better than search?**
   - Hypothesis: Semantic understanding enables better strategic decisions
   - Method: Fine-tune Llama-3-8B on reasoning data, compare to MCTS
   - Success: Competitive win rate with interpretable decisions

3. **Can AI invent new strategies?**
   - Hypothesis: Genetic algorithms can discover novel deck archetypes
   - Method: Evolve deck populations, analyze emergent strategies
   - Success: Discover combo or archetype not in training data

### Publication Targets

- HuggingFace Papers
- arXiv (cs.AI, cs.LG)
- Open-source ML research platforms

---

## Performance Targets

| Metric             | Current  | Target   | Why                     |
| ------------------ | -------- | -------- | ----------------------- |
| Games/sec (engine) | 1,000+   | 1,000+   | ✅ Sufficient           |
| Games/sec (Python) | N/A      | 100+     | RL training speed       |
| MCTS iterations    | 500      | 500      | ✅ Frozen baseline      |
| Training data      | 13 games | 100K+    | Neural network training |
| PPO training       | N/A      | 1M steps | Agent convergence       |

---

## Budget & Resources

| Resource   | Allocation       | Notes                          |
| ---------- | ---------------- | ------------------------------ |
| Claude MAX | $90/month        | Training data generation (MCP) |
| API Budget | Up to $500/month | Multi-provider orchestrator    |
| Compute    | Local + Cloud    | DigitalOcean for long runs     |

---

## Contributing

ManaCore is designed to be accessible to AI researchers:

1. **Easy Entry**: `pip install manacore-gym` (Phase 1 goal)
2. **Jupyter Support**: Example notebooks for quick start
3. **Baselines**: Pre-trained agents to benchmark against
4. **Datasets**: HuggingFace dataset cards

---

**Let's build something amazing! 🎴🤖**
