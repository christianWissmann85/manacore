# ManaCore Gym

Gymnasium environment for Magic: The Gathering AI research.

## Installation

```bash
# From the manacore repository
pip install -e packages/python-gym

# With Stable Baselines3 support
pip install -e "packages/python-gym[sb3]"

# With development dependencies
pip install -e "packages/python-gym[dev]"
```

## Quick Start

### Basic Usage

```python
import gymnasium as gym
import manacore_gym

# Create environment
env = gym.make("ManaCore-v0", opponent="greedy")

# Play a game
obs, info = env.reset(seed=42)
total_reward = 0

while True:
    # Get legal actions from the mask
    mask = info["action_mask"]
    legal_actions = mask.nonzero()[0]

    # Random action selection
    action = legal_actions[0]  # or np.random.choice(legal_actions)

    obs, reward, terminated, truncated, info = env.step(action)
    total_reward += reward

    if terminated or truncated:
        print(f"Game over! Reward: {total_reward}")
        break

env.close()
```

### Training with Stable Baselines3

```python
from sb3_contrib import MaskablePPO
from manacore_gym import ManaCoreBattleEnv

# Create environment
env = ManaCoreBattleEnv(opponent="greedy")

# Train agent
model = MaskablePPO("MlpPolicy", env, verbose=1)
model.learn(total_timesteps=100_000)

# Save model
model.save("ppo_manacore")

# Evaluate
obs, info = env.reset()
for _ in range(10):
    action_masks = env.action_masks()
    action, _ = model.predict(obs, action_masks=action_masks)
    obs, reward, terminated, truncated, info = env.step(action)
    if terminated or truncated:
        print(f"Win!" if reward > 0 else "Loss!")
        obs, info = env.reset()
```

## Environment Details

### Observation Space

The observation is a 25-dimensional normalized feature vector:

| Index | Feature                                   | Range  |
| ----- | ----------------------------------------- | ------ |
| 0-2   | Life (player, opponent, delta)            | [0, 1] |
| 3-9   | Board state (creatures, power, toughness) | [0, 1] |
| 10-14 | Card advantage (hand, library)            | [0, 1] |
| 15-18 | Mana (lands, untapped)                    | [0, 1] |
| 19-24 | Game state (turn, phase, combat)          | [0, 1] |

### Action Space

- `Discrete(200)` - Maximum 200 possible actions
- Use `env.action_masks()` to get legal actions
- Action indices correspond to `info["legal_actions"]`

### Rewards

- `+1.0` - Win the game
- `-1.0` - Lose the game
- `0.0` - Game ongoing

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
- `RedBurn`, `BlueControl`, `WhiteWeenie` - Competitive archetypes

## Server Management

The environment automatically starts a Bun server if not running:

```python
# Auto-start server (default)
env = ManaCoreBattleEnv(auto_start_server=True)

# Connect to existing server
env = ManaCoreBattleEnv(
    server_url="http://localhost:3333",
    auto_start_server=False
)

# Start server manually
from manacore_gym.utils import ensure_server_running
process = ensure_server_running(port=3333)
```

## API Reference

### ManaCoreBattleEnv

```python
env = ManaCoreBattleEnv(
    opponent="greedy",      # Bot to play against
    deck="random",          # Player deck
    opponent_deck="random", # Opponent deck
    server_url="http://localhost:3333",
    auto_start_server=True,
    render_mode=None,       # "human" for text output
)

# Standard Gymnasium methods
obs, info = env.reset(seed=42)
obs, reward, terminated, truncated, info = env.step(action)
env.close()

# Additional methods
mask = env.action_masks()           # Get legal action mask
descriptions = env.get_legal_action_descriptions()  # Human-readable actions
```

### BunBridge

Low-level API for direct server communication:

```python
from manacore_gym import BunBridge

bridge = BunBridge(host="localhost", port=3333)

# Create game
game = bridge.create_game(opponent="greedy")
game_id = game["gameId"]

# Step through game
result = bridge.step(game_id, action=0)

# Batch operations
games = bridge.batch_create(count=8, opponent="random")
results = bridge.batch_step([
    {"gameId": g["gameId"], "action": 0}
    for g in games["games"]
])

bridge.close()
```

## Development

```bash
# Install dev dependencies
pip install -e "packages/python-gym[dev]"

# Run tests
pytest packages/python-gym/tests

# Type checking
mypy packages/python-gym/manacore_gym

# Formatting
black packages/python-gym
ruff packages/python-gym
```

## License

MIT
