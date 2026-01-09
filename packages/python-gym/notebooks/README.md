# ManaCore Notebooks

Interactive Jupyter notebooks for learning and analyzing ManaCore RL training.

## 📚 Available Notebooks

### 1. [Getting Started](01_getting_started.ipynb)
Basic introduction to the ManaCore Gym environment.

### 2. [Phase 3 Training Analysis](02_phase3_analysis.ipynb) ⭐
**Publication-ready analysis toolkit** for Phase 3 training runs:

- 📊 **Learning Curves** - Compare multiple training runs
- 📈 **Statistical Reports** - Performance metrics with LaTeX export
- 🎨 **Publication Plots** - High-quality figures (PNG, PDF, SVG)
- 🌐 **3D Exploration** - Interactive visualizations
- 📄 **Paper-Ready Exports** - Everything formatted for research papers

## 🚀 Quick Start

```bash
# Install notebook dependencies
cd /home/chris/manacore/packages/python-gym
uv sync --extra notebook

# Launch Jupyter
uv run jupyter notebook
```

## 🎯 Analysis Toolkit Usage

### In Jupyter Notebook

```python
from manacore_gym.analysis import TrainingAnalyzer

# Load all training runs
analyzer = TrainingAnalyzer("../logs")

# Create learning curves
analyzer.plot_learning_curves()

# Generate comparison report
analyzer.plot_comparison_matrix()

# Export for publication
analyzer.export_for_paper("../output/paper_figures")
```

### Command Line (Python Script)

```python
#!/usr/bin/env python3
from manacore_gym.analysis import quick_analysis
import matplotlib.pyplot as plt

# Quick analysis
analyzer = quick_analysis("./logs")
analyzer.plot_learning_curves()
plt.savefig("learning_curves.png", dpi=300)
- All core dependencies (gymnasium, numpy, requests, etc.)

### 2. Select the Kernel in VS Code

1. Open any notebook (e.g., `01_getting_started.ipynb`)
2. Click on the kernel selector in the top-right (or press `Ctrl+Shift+P` → "Select Notebook Kernel")
3. Choose: **Python 3.11.x ('.venv': venv)**
4. The path should be: `packages/python-gym/.venv/bin/python`

### 3. Run All Cells

Press "Run All" or press `Shift+Enter` on each cell sequentially.

**That's it!** The notebook will:
- ✅ Auto-start the game server (if not running)
- ✅ Install any missing dependencies
- ✅ Train and evaluate an RL agent

## Available Notebooks

- **01_getting_started.ipynb** - Introduction to ManaCore Gym basics
  - Environment creation and observation space
  - Action masking for legal moves
  - Playing games with random actions
  - Training RL agents with Stable Baselines3

## Troubleshooting

### "Running cells requires ipykernel"

**Solution:** Run `uv sync --extra notebook` from the `packages/python-gym` directory.

### Notebook can't find manacore_gym

**Solution:** Make sure the kernel is using the `.venv` Python interpreter. Check the kernel selector in the top-right.

### Import errors (sb3-contrib, matplotlib, etc.)

**Solution:** The `notebook` extra includes all dependencies. Run:
```bash
uv sync --extra notebook
```

### Game server not starting

The ManaCore Gym environment will automatically start the Bun game server when you create an environment. Make sure:
1. Bun is installed (`bun --version`)
2. You've built the engine (`bun run build` from the repo root)

## Development

### Adding New Dependencies

Edit `pyproject.toml` and add to the `notebook` optional dependencies:

```toml
[project.optional-dependencies]
notebook = [
    "ipykernel>=6.0.0",
    "your-new-package>=1.0.0",  # Add here
]
```

Then run:
```bash
uv sync --extra notebook
```

### Syncing Without Notebook Dependencies

For minimal installation (just core gym):
```bash
uv sync
```

For training only (no notebooks):
```bash
uv sync --extra sb3
```

## Next Steps

After completing `01_getting_started.ipynb`, check out:
- `examples/train_ppo.py` - Full PPO training script with logging
- `examples/evaluate_agent.py` - Comprehensive evaluation
- `experiments/` - Experiment configurations for research
