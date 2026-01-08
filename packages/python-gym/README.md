# ManaCore Gym

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Gymnasium environment for Magic: The Gathering AI research.

Train reinforcement learning agents to play MTG using standard tools like Stable Baselines3, RLlib, or custom PyTorch implementations.

## Prerequisites

This package requires the **ManaCore game server** to be running. The server is written in TypeScript and runs on [Bun](https://bun.sh/).

### 1. Install Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (via npm)
npm install -g bun
```

### 2. Clone ManaCore Repository

```bash
git clone https://github.com/christianWissmann85/manacore.git
cd manacore
bun install
```

## Installation

### From Source (Development)

```bash
# Using uv (recommended)
cd packages/python-gym
uv sync --all-extras

# Using pip
pip install -e "packages/python-gym[dev]"
```

## Quick Start

### 1. Start the Game Server

In one terminal, from the ManaCore repository root:

```bash
cd packages/cli-client
bun src/index.ts gym-server
```

Or let the Python environment auto-start it (if running from the repo):

```python
# Auto-start works when running from the ManaCore repository
env = ManaCoreBattleEnv(auto_start_server=True)
```

### 2. Play a Game

```python
import gymnasium as gym
import numpy as np
import manacore_gym  # Registers the environment

# Create environment (connects to running server)
env = gym.make("ManaCore-v0", opponent="greedy")

# Play a game with random actions
obs, info = env.reset(seed=42)
total_reward = 0

while True:
    # Get legal actions from the mask
    mask = info["action_mask"]
    legal_actions = np.where(mask)[0]
    action = np.random.choice(legal_actions)

    obs, reward, terminated, truncated, info = env.step(action)
    total_reward += reward

    if terminated or truncated:
        print(f"Game over! Reward: {total_reward}")
        break

env.close()
```

### 3. Train with Stable Baselines3

```python
from sb3_contrib import MaskablePPO
from sb3_contrib.common.wrappers import ActionMasker
from manacore_gym import ManaCoreBattleEnv

# Create environment
env = ManaCoreBattleEnv(opponent="greedy", auto_start_server=False)

# Wrap with action masker for MaskablePPO
env = ActionMasker(env, lambda e: e.action_masks())

# Train agent
model = MaskablePPO("MlpPolicy", env, verbose=1)
model.learn(total_timesteps=100_000)

# Save model
model.save("ppo_manacore")
```

## Environment Details

### Observation Space

25-dimensional normalized feature vector:

| Index | Feature                                   | Range  |
| ----- | ----------------------------------------- | ------ |
| 0-2   | Life (player, opponent, delta)            | [0, 1] |
| 3-9   | Board state (creatures, power, toughness) | [0, 1] |
| 10-14 | Card advantage (hand, library)            | [0, 1] |
| 15-18 | Mana (lands, untapped)                    | [0, 1] |
| 19-24 | Game state (turn, phase, combat)          | [0, 1] |

### Action Space

- `Discrete(200)` - Maximum 200 possible actions
- Use `env.action_masks()` to get boolean mask of legal actions
- Use `info["action_mask"]` after reset/step

### Rewards

- `+1.0` - Win the game
- `-1.0` - Lose the game
- `0.0` - Game ongoing (sparse reward)

## Configuration

### Opponents

| Opponent      | Description               | Speed  |
| ------------- | ------------------------- | ------ |
| `random`      | Random legal moves        | Fast   |
| `greedy`      | 1-ply lookahead heuristic | Fast   |
| `mcts`        | MCTS (200 iterations)     | Medium |
| `mcts-fast`   | MCTS (50 iterations)      | Fast   |
| `mcts-strong` | MCTS (500 iterations)     | Slow   |

### Decks

- `random` - Random deck each game
- `red`, `blue`, `black`, `white`, `green` - Mono-color decks
- `red_burn`, `blue_control`, `white_weenie` - Archetype decks

## API Reference

### ManaCoreBattleEnv

```python
from manacore_gym import ManaCoreBattleEnv

env = ManaCoreBattleEnv(
    opponent="greedy",           # Bot to play against
    deck="random",               # Player deck
    opponent_deck="random",      # Opponent deck
    server_url="http://localhost:3333",
    auto_start_server=True,      # Auto-start if in repo
    render_mode=None,            # "human" for text output
)

# Standard Gymnasium methods
obs, info = env.reset(seed=42)
obs, reward, terminated, truncated, info = env.step(action)
mask = env.action_masks()  # For MaskablePPO
env.close()
```

### Vectorized Environments

```python
from manacore_gym import make_vec_env, make_masked_vec_env

# For standard SB3 algorithms
vec_env = make_vec_env(n_envs=8, opponent="greedy")

# For MaskablePPO (includes ActionMasker wrapper)
vec_env = make_masked_vec_env(n_envs=8, opponent="greedy")
```

### Low-Level Bridge API

```python
from manacore_gym import BunBridge

bridge = BunBridge(host="localhost", port=3333, auto_start=False)

# Create and play games
game = bridge.create_game(opponent="greedy")
result = bridge.step(game["gameId"], action=0)

# Batch operations for parallel training
games = bridge.batch_create(count=8, opponent="random")
bridge.close()
```

## Examples

The package includes example scripts in `examples/`:

- `random_agent.py` - Basic environment usage
- `train_ppo.py` - Full PPO training with TensorBoard
- `evaluate_agent.py` - Evaluate models against multiple opponents
- `benchmark_throughput.py` - Performance benchmarking

## Performance

- **Step latency:** ~2.5ms mean
- **Throughput:** ~8 games/sec (HTTP overhead)
- Supports parallel environments via `make_vec_env()`

## Development

```bash
# Clone and install
git clone https://github.com/christianWissmann85/manacore.git
cd manacore/packages/python-gym

# Install with dev dependencies
uv sync --all-extras

# Run tests
pytest tests/ -v

# Type checking
mypy manacore_gym/

# Linting
ruff check manacore_gym/
```

## Links

- [ManaCore Repository](https://github.com/christianWissmann85/manacore)
- [Documentation](https://github.com/christianWissmann85/manacore/tree/main/packages/python-gym)
- [Issue Tracker](https://github.com/christianWissmann85/manacore/issues)

## License

MIT
