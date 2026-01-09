# Phase 3 Training Analysis Toolkit 📊

**Publication-ready visualizations and statistical analysis for ManaCore RL training runs.**

Created to help you write research papers with beautiful, sciency graphs (and yes, 3D plots! 🌐).

## ✨ Features

- 📈 **Learning Curves** - Compare multiple training runs with customizable smoothing
- 📊 **Statistical Reports** - Performance metrics, convergence analysis, variance
- 🎨 **Publication Quality** - PNG (300 DPI), PDF (vector), SVG exports
- 🌐 **Interactive 3D** - Plotly-based exploration of metric relationships
- 📄 **LaTeX Tables** - Direct export to `.tex` format for papers
- 🔬 **Research-Ready** - Follows best practices for ML papers

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd /home/chris/manacore/packages/python-gym
uv sync --extra notebook
```

### 2. Analyze Your Training Runs

**Option A: Jupyter Notebook (Recommended)**

```bash
uv run jupyter notebook
# Open: notebooks/02_phase3_analysis.ipynb
```

**Option B: Command Line Script**

```bash
# From repo root
uv run python scripts/analyze_training.py --export
```

**Option C: Python Script**

```python
from manacore_gym.analysis import TrainingAnalyzer

analyzer = TrainingAnalyzer("./logs")
analyzer.plot_learning_curves()
analyzer.export_for_paper("./output/figures")
```

## 📊 What's Included

### 1. TrainingAnalyzer Class

Main analysis engine that:
- Parses TensorBoard event files
- Computes statistics across runs
- Generates publication-ready visualizations

### 2. Visualization Functions

#### Learning Curves
```python
analyzer.plot_learning_curves(
    metrics=['rollout/ep_rew_mean', 'train/policy_loss'],
    smoothing=0.9,  # EMA smoothing
    figsize=(15, 10),
)
```

#### Comparison Matrix
```python
analyzer.plot_comparison_matrix(
    metric='rollout/ep_rew_mean',
)
```
Shows: learning curves, final performance, efficiency, stability

#### 3D Exploration
```python
analyzer.plot_3d_exploration(
    x_metric='train/learning_rate',
    y_metric='train/policy_loss',
    z_metric='rollout/ep_rew_mean',
)
```

#### Statistical Report
```python
report = analyzer.create_statistical_report()
print(report)
```

### 3. Export Functions

```python
# Export everything for your paper
analyzer.export_for_paper(
    output_dir="./output/paper_figures",
    formats=['png', 'pdf', 'svg'],
)
```

Creates:
- `learning_curves.{png,pdf}`
- `comparison_matrix.{png,pdf}`
- `3d_exploration.html`
- `statistical_report.csv`
- `statistical_report.tex` ← LaTeX table!

## 📁 Data Sources

The analyzer automatically parses TensorBoard logs from your training runs:

```
packages/python-gym/logs/
├── curriculum/          # Run 1
├── enhanced/            # Run 2
└── scaling_1M/          # Run 3 (current)
```

Each run contains:
- `MaskablePPO_0/events.out.tfevents.*` - TensorBoard data
- All metrics logged during training

## 📖 Available Metrics

Common metrics tracked by Stable-Baselines3:

**Rollout Metrics:**
- `rollout/ep_rew_mean` - Average episode reward ⭐
- `rollout/ep_len_mean` - Average episode length
- `rollout/success_rate` - Success rate (if applicable)

**Training Metrics:**
- `train/policy_loss` - Policy network loss
- `train/value_loss` - Value function loss
- `train/learning_rate` - Current learning rate
- `train/entropy_loss` - Entropy bonus
- `train/approx_kl` - KL divergence
- `train/clip_fraction` - PPO clip fraction
- `train/explained_variance` - Value prediction quality

## 🎓 Research Paper Usage

### 1. Training Phase

```bash
# Run multiple experiments
uv run python examples/train_enhanced.py --extended --log-path ./logs/exp1_baseline
uv run python examples/train_enhanced.py --extended --log-path ./logs/exp2_tuned
uv run python examples/train_enhanced.py --extended --log-path ./logs/exp3_ablation
```

### 2. Analysis Phase

```python
analyzer = TrainingAnalyzer("./logs")

# Generate all figures
analyzer.export_for_paper("./paper_figures", formats=['pdf', 'png'])

# Get statistics for results section
report = analyzer.create_statistical_report()
print(report)
```

### 3. LaTeX Integration

```latex
\begin{figure}[ht]
  \centering
  \includegraphics[width=0.9\textwidth]{paper_figures/learning_curves.pdf}
  \caption{Training learning curves comparing baseline, tuned, and ablation 
           experiments. Curves show exponential moving average with weight 0.9.}
  \label{fig:learning_curves}
\end{figure}

\begin{table}[ht]
  \centering
  \caption{Final performance metrics across experiments.}
  \input{paper_figures/statistical_report.tex}
  \label{tab:results}
\end{table}
```

## 🎨 Customization Tips

### Custom Smoothing

```python
# More aggressive smoothing (smoother curves)
analyzer.plot_learning_curves(smoothing=0.95)

# Less smoothing (more raw data visible)
analyzer.plot_learning_curves(smoothing=0.7)

# No smoothing
analyzer.plot_learning_curves(smoothing=0)
```

### Custom Metrics

```python
# Analyze specific metrics
analyzer.plot_learning_curves(
    metrics=[
        'train/entropy_loss',
        'train/approx_kl',
        'train/clip_fraction',
    ]
)
```

### Publication Styling

The toolkit uses publication-quality defaults:
- 300 DPI for PNG exports
- Vector formats (PDF/SVG) for scalability
- Seaborn color palettes
- Grid lines at 30% opacity
- Proper font sizes for readability

## 💡 Pro Tips

1. **Always smooth learning curves** - Use 0.9-0.95 for papers
2. **Report final performance** - Average last 100-200 steps
3. **Include variance** - Show std dev across runs
4. **Use consistent seeds** - For fair comparisons
5. **3D plots for presentations** - Not for static papers
6. **Export to PDF** - Vector graphics scale perfectly

## 🐛 Common Issues

### "No training runs found"
- Check your `--log-path` argument in training script
- Ensure TensorBoard logging is enabled:
  ```python
  model = MaskablePPO(..., tensorboard_log="./logs/experiment")
  ```

### "Module not found: seaborn/plotly"
```bash
uv sync --extra notebook
```

### Plots not showing
```python
import matplotlib.pyplot as plt
plt.show()  # Add this after plotting
```

## 📚 Examples

See:
- [notebooks/02_phase3_analysis.ipynb](../notebooks/02_phase3_analysis.ipynb) - Interactive analysis
- [scripts/analyze_training.py](../../../scripts/analyze_training.py) - Command-line tool
- [examples/test_analysis.py](../examples/test_analysis.py) - Simple test

## 🔗 Dependencies

- **TensorFlow** - For reading TensorBoard logs
- **Matplotlib** - 2D plotting
- **Seaborn** - Statistical plots
- **Plotly** - Interactive 3D plots
- **Pandas** - Data manipulation
- **SciPy** - Statistical analysis
- **Kaleido** - Static image export from Plotly

## 🤝 Contributing

Ideas for enhancements:
- [ ] Hyperparameter correlation analysis
- [ ] Automated A/B testing
- [ ] Real-time training monitoring
- [ ] Multi-seed aggregation
- [ ] Confidence intervals

---

**Happy researching! 📚✨**

Created for Phase 3 of the ManaCore project to make awesome research papers with flashy graphs! 🎉
