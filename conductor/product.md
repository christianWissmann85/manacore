# Product Guide - ManaCore

## Initial Concept
ManaCore is an AI Research Laboratory disguised as a high-fidelity Magic: The Gathering (MTG) engine. It is optimized for large-scale simulations, reinforcement learning (RL) training, and LLM benchmarking.

## Target Users
- **AI Researchers and Data Scientists:** Using the platform to train agents and test novel AI architectures in a complex, stochastic environment.

## Product Goals
- **Infrastructure Excellence:** Continuously improve the core engine, CLI, Web Client, and integration layers (Python Gym, MCP, Gym Server).
- **Performance:** Optimize simulation speed and memory efficiency to support millions of training games.
- **Stability & Correctness:** Ensure 100% rule compliance and engine reliability through extensive automated testing.
- **Developer Experience:** Provide high-quality logging, debugging tools, and intuitive APIs for researchers to quickly iterate on experiments.

## Key Features
- **High-Performance Engine:** TypeScript-based rules engine capable of >1,000 games/sec.
- **AI Research Suite:** Built-in support for Random, Greedy, and MCTS bots with pathways for Neural and LLM agents.
- **Multi-Interface Support:**
    - **CLI Client:** For fast experimentation and local debugging.
    - **Web Client:** A "Glass-Box" lab UI for visualizing game states and AI decision-making.
    - **Python Gymnasium:** Standardized bridge for integration with ML frameworks like Stable Baselines3.
    - **MCP Server:** Enabling interactive play and reasoning via AI models (e.g., Claude).
- **Data Pipeline:** Comprehensive data collection for training, featuring high-dimensional state vectors.
