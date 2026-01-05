# ManaCore 🔬

**MTG Simulation Engine & AI Research Platform**

> A high-fidelity, headless Magic: The Gathering rule engine designed for reinforcement learning, Monte Carlo Tree Search (MCTS) research, and meta-game analysis.

![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-Research%20Preview-orange)
![Simulation Speed](https://img.shields.io/badge/sim%20speed-1000%2B%20games%2Fsec-green)

---

## 🎯 Project Mission

ManaCore is a **technical research platform** built to study Game Theory and Artificial Intelligence within the complex environment of _Magic: The Gathering_.

Unlike consumer game clients, ManaCore focuses on:

- **Headless Simulation:** Running thousands of matches per second for agent training.
- **Determinism:** Seed-based RNG ensuring 100% reproducible scenarios for debugging.
- **Agent Architecture:** Modular interfaces for MCTS, Greedy, and Neural Network agents.
- **Data Visualization:** React-based dashboards for analyzing decision trees and game states.

**This is not a commercial product or a way to play Magic: The Gathering for free.** It is a laboratory for experimenting with AI algorithms using TCG rules as the physics engine.

---

## 🏗️ Architecture

The platform is structured as a Monorepo using **Bun**:

| Package                  | Purpose                                       | Tech Stack      |
| ------------------------ | --------------------------------------------- | --------------- |
| `@manacore/engine`       | Pure logic rule engine (Zero UI dependencies) | TypeScript      |
| `@manacore/ai`           | MCTS agents and evaluation functions          | TypeScript      |
| `@manacore/web-client`   | Visualization & Debug Dashboard               | React, Tailwind |
| `@manacore/cli-client`   | Headless simulation runner                    | TypeScript      |
| `@manacore/data-scraper` | Local data fetching tool                      | Scryfall API    |

---

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- Basic understanding of TypeScript

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/manacore.git
cd manacore

# Install dependencies
bun install
```

### Data Setup (BYO Data)

ManaCore does **not** distribute copyrighted card assets. You must fetch card data locally for your own research use:

```bash
# Fetches card text/stats from Scryfall API (Rate-limited, polite scraper)
bun run fetch-cards
```

### Running Simulations

```bash
# Run a batch simulation of RandomBot vs RandomBot
bun run cli simulate 100

# Run with data export for analysis
bun run cli benchmark 100 --export-json --export-csv

# Start an interactive debug session
bun run cli play
```

---

## 🧪 Research Capabilities

### 1. Deterministic Replay

Every simulation is initialized with a specific RNG seed. Researchers can capture a `SimulationReplay` JSON to perfectly reproduce edge cases or agent behaviors.

### 2. High-Frequency Training

The engine is optimized for performance, capable of resolving complex board states in microseconds, enabling massive parallel training sessions.

**Data Export:** Results automatically save to `results/` directory in JSON and CSV formats for post-processing and visualization.

### 3. Agent Lab

Compare different AI architectures:

- **RandomBot**: Baseline stochastic behavior.
- **GreedyBot**: 1-ply material evaluation.
- **MCTS-Bot**: UCT-based search (Coming Soon).

---

## ⚖️ Legal Disclaimer

**ManaCore is a non-commercial, open-source research project.**

**Wizards of the Coast Fan Content Policy:**
ManaCore is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

**Asset Policy:**
This repository **does not** contain or distribute card images or copyrighted text. All game data is fetched locally by the user via the Scryfall API and is stored on the user's machine for personal research purposes only.

---

**Built with ❤️ for Science**
