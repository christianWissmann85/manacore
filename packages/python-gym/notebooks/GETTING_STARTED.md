# Getting Started with ManaCore Notebooks

This guide will help you set up and run ManaCore Gym notebooks in under 2 minutes.

## ⚡ Quick Start (For Researchers)

### Option 1: Automated Setup (Recommended)

```bash
# From the repository root
./scripts/setup-notebooks.sh

# Then open VS Code and select the .venv kernel
```

### Option 2: Manual Setup (3 commands)

```bash
# 1. Install dependencies
cd packages/python-gym
uv sync --extra notebook

# 2. Open notebook in VS Code
code notebooks/01_getting_started.ipynb

# 3. Select kernel: Python 3.11.x ('.venv': venv)
# 4. Press "Run All"
```

## 🎯 What You'll Get

After setup, the notebook will automatically:
- ✅ Check and start the game server
- ✅ Create a Gymnasium environment
- ✅ Play games with random actions
- ✅ Train a PPO agent (5000 timesteps)
- ✅ Evaluate the agent (10 games)

**Expected runtime:** ~2-3 minutes for the full notebook

## 📋 Prerequisites

- **Bun** (v1.0+) - JavaScript runtime for the game server
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- **uv** - Fast Python package manager
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

- **VS Code** (optional but recommended)
  - Python extension
  - Jupyter extension

## 🔧 Architecture

The notebook system has two components:

```
┌─────────────────────────────────────────┐
│  Python Notebook (.ipynb)               │
│  ┌─────────────────────────────────┐   │
│  │ import manacore_gym             │   │
│  │ env = gym.make("ManaCore-v0")   │   │
│  └─────────────────────────────────┘   │
└─────────────────┬───────────────────────┘
                  │ HTTP (requests)
                  ↓
┌─────────────────────────────────────────┐
│  Bun Server (TypeScript)                │
│  ┌─────────────────────────────────┐   │
│  │ POST /game/create               │   │
│  │ POST /game/:id/step             │   │
│  │ GET  /health                    │   │
│  └─────────────────────────────────┘   │
│  Running on localhost:3333              │
└─────────────────────────────────────────┘
```

**The notebook automatically manages the server** - no manual intervention needed!

## 📚 What's Included

### 01_getting_started.ipynb

- Section 0: Auto-start game server ✨ NEW
- Section 1: Basic environment usage
- Section 2: Understanding observations (25D feature vector)
- Section 3: Action masking for legal moves
- Section 4: Playing with random actions
- Section 5: Training with Stable Baselines3 (PPO)
- Section 6: Cleanup

## 🐛 Troubleshooting

### "No module named 'ipykernel'"

**Solution:**
```bash
cd packages/python-gym
uv sync --extra notebook
```

Then restart the notebook kernel in VS Code.

### "Connection refused on port 3333"

**Cause:** The auto-start cell didn't run or failed.

**Solution:**
1. Run the first code cell (Section 0) - it will start the server
2. Wait for "✅ Game server started successfully!"
3. Then continue with other cells

**Manual start:**
```bash
# Terminal 1: Start server
cd packages/gym-server
bun run src/index.ts

# Terminal 2: Run notebook
```

### "Cannot find kernel"

**Solution:**
1. In VS Code, click the kernel selector (top-right)
2. Choose "Select Another Kernel"
3. Choose "Python Environments"
4. Select: `packages/python-gym/.venv/bin/python`

### Server won't start automatically

**Check:**
- Is Bun installed? `bun --version`
- Is the repo built? `bun install` in repo root
- Can you find `packages/gym-server/src/index.ts`?

**Fallback:** Start server manually in a separate terminal.

## 🔬 Research Use Cases

### 1. Quick Prototyping
```python
import gymnasium as gym
import manacore_gym

env = gym.make("ManaCore-v0", opponent="mcts")
# Start experimenting!
```

### 2. Training Custom Agents
```python
from sb3_contrib import MaskablePPO

model = MaskablePPO("MlpPolicy", env, learning_rate=1e-4)
model.learn(total_timesteps=100_000)
model.save("my_agent")
```

### 3. Evaluation
```python
# Evaluate against different opponents
for opponent in ["random", "greedy", "mcts"]:
    env = gym.make("ManaCore-v0", opponent=opponent)
    # Run evaluation...
```

### 4. Hyperparameter Tuning
```python
# Modify in notebook cells
learning_rates = [1e-3, 3e-4, 1e-4]
batch_sizes = [64, 128, 256]
# Grid search...
```

## 📖 Next Steps

After completing `01_getting_started.ipynb`:

1. **Explore examples:**
   - `packages/python-gym/examples/train_ppo.py` - Full training script
   - `packages/python-gym/examples/evaluate_agent.py` - Benchmarking

2. **Read the research roadmap:**
   - [agents.md](../../../agents.md) - Agent architecture plans
   - [ROADMAP.md](../../../ROADMAP.md) - Project phases

3. **Contribute experiments:**
   - `experiments/` - JSON configurations
   - Add your own training configs

## 💡 Tips for Researchers

1. **Save models regularly:**
   ```python
   model.save(f"models/agent_{timestep}")
   ```

2. **Use TensorBoard for logging:**
   ```python
   model = MaskablePPO("MlpPolicy", env, tensorboard_log="./logs/")
   ```

3. **Vectorize for speed:**
   ```python
   from stable_baselines3.common.vec_env import DummyVecEnv
   env = DummyVecEnv([lambda: gym.make("ManaCore-v0") for _ in range(4)])
   ```

4. **Experiment with opponents:**
   - `random` - Baseline (very weak)
   - `greedy` - Simple heuristic (weak)
   - `mcts` - Tree search (strong)
   - `mcts-strong` - Deep search (very strong)

## 📬 Support

- **Issues:** [GitHub Issues](https://github.com/christianWissmann85/manacore/issues)
- **Docs:** `packages/python-gym/README.md`
- **Examples:** `packages/python-gym/examples/`

---

**Ready to train some AI!** 🤖✨
