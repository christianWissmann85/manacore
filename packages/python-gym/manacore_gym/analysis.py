"""
ManaCore Training Analysis Toolkit

Publication-ready visualization tools for Phase 3 RL training analysis.
Supports TensorBoard log parsing, comparative analysis, and interactive 3D plots.

Example:
    >>> from manacore_gym.analysis import TrainingAnalyzer
    >>> analyzer = TrainingAnalyzer("./logs")
    >>> analyzer.plot_learning_curves()
    >>> analyzer.create_comparison_report()
"""

from dataclasses import dataclass
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import seaborn as sns
from scipy import stats
from tensorflow.python.summary.summary_iterator import summary_iterator

# Set publication-quality defaults
plt.rcParams.update({
    'font.size': 12,
    'axes.labelsize': 14,
    'axes.titlesize': 16,
    'xtick.labelsize': 11,
    'ytick.labelsize': 11,
    'legend.fontsize': 11,
    'figure.titlesize': 18,
    'figure.dpi': 150,
    'savefig.dpi': 300,
    'savefig.bbox': 'tight',
    'axes.grid': True,
    'grid.alpha': 0.3,
})

sns.set_palette("husl")


@dataclass
class TrainingRun:
    """Metadata and metrics for a single training run."""
    name: str
    path: Path
    metrics: dict[str, pd.DataFrame]
    start_time: float
    total_steps: int


class TrainingAnalyzer:
    """
    Analyze and visualize ManaCore RL training runs.

    Parses TensorBoard event files and creates publication-ready visualizations
    including learning curves, statistical comparisons, and 3D exploration plots.
    """

    def __init__(self, logs_dir: str | Path):
        """
        Initialize analyzer with logs directory.

        Args:
            logs_dir: Path to logs directory containing training runs
        """
        self.logs_dir = Path(logs_dir)
        self.runs: dict[str, TrainingRun] = {}
        self._load_all_runs()

    def _load_all_runs(self) -> None:
        """Load all training runs from logs directory."""
        print(f"Loading training runs from {self.logs_dir}...")

        for run_dir in self.logs_dir.iterdir():
            if run_dir.is_dir():
                self._load_run(run_dir)

        print(f"Loaded {len(self.runs)} training run(s)")

    def _load_run(self, run_dir: Path) -> None:
        """Load a single training run."""
        run_name = run_dir.name
        metrics: dict[str, list[tuple[int, float, float]]] = {}

        # Find TensorBoard event files
        event_files = list(run_dir.rglob("events.out.tfevents.*"))

        if not event_files:
            print(f"  Warning: No event files found in {run_dir}")
            return

        # Parse all event files
        for event_file in event_files:
            try:
                for event in summary_iterator(str(event_file)):
                    step = event.step
                    wall_time = event.wall_time

                    for value in event.summary.value:
                        tag = value.tag
                        if not hasattr(value, 'simple_value'):
                            continue

                        if tag not in metrics:
                            metrics[tag] = []

                        metrics[tag].append((step, wall_time, value.simple_value))

            except Exception as e:
                print(f"  Warning: Error reading {event_file}: {e}")
                continue

        # Convert to DataFrames
        metrics_df = {}
        for tag, values in metrics.items():
            if values:
                df = pd.DataFrame(values, columns=['step', 'wall_time', 'value'])
                df = df.sort_values('step').drop_duplicates('step')
                metrics_df[tag] = df

        if metrics_df:
            # Get metadata
            start_time = min(df['wall_time'].min() for df in metrics_df.values())
            total_steps = max(df['step'].max() for df in metrics_df.values())

            self.runs[run_name] = TrainingRun(
                name=run_name,
                path=run_dir,
                metrics=metrics_df,
                start_time=start_time,
                total_steps=int(total_steps),
            )

            print(f"  ✓ {run_name}: {total_steps:,} steps, {len(metrics_df)} metrics")

    def get_metric_names(self) -> list[str]:
        """Get all available metric names across all runs."""
        all_metrics: set[str] = set()
        for run in self.runs.values():
            all_metrics.update(run.metrics.keys())
        return sorted(all_metrics)

    def plot_learning_curves(
        self,
        metrics: list[str] | None = None,
        runs: list[str] | None = None,
        smoothing: float = 0.9,
        figsize: tuple[int, int] = (15, 10),
        save_path: str | None = None,
    ) -> plt.Figure:
        """
        Plot learning curves for specified metrics and runs.

        Args:
            metrics: List of metric names to plot (default: key metrics)
            runs: List of run names to include (default: all)
            smoothing: Exponential moving average smoothing (0-1)
            figsize: Figure size (width, height)
            save_path: Optional path to save figure

        Returns:
            Matplotlib figure
        """
        if metrics is None:
            # Default to most important metrics
            metrics = [
                'rollout/ep_rew_mean',
                'train/learning_rate',
                'train/policy_loss',
                'train/value_loss',
            ]

        if runs is None:
            runs = list(self.runs.keys())

        # Filter available metrics
        metrics = [m for m in metrics if any(m in self.runs[r].metrics for r in runs)]

        if not metrics:
            print("No matching metrics found!")
            return plt.figure()

        # Create subplots
        n_metrics = len(metrics)
        n_cols = 2
        n_rows = (n_metrics + 1) // 2

        fig, axes = plt.subplots(n_rows, n_cols, figsize=figsize)
        if n_metrics == 1:
            axes = np.array([axes])
        axes = axes.flatten()

        for idx, metric in enumerate(metrics):
            ax = axes[idx]

            for run_name in runs:
                if run_name not in self.runs:
                    continue

                run = self.runs[run_name]
                if metric not in run.metrics:
                    continue

                df = run.metrics[metric]
                steps = df['step'].values
                values = df['value'].values

                # Apply smoothing
                if smoothing > 0:
                    smoothed = self._smooth(values, smoothing)
                    ax.plot(steps, smoothed, label=run_name, linewidth=2, alpha=0.8)
                    ax.plot(steps, values, alpha=0.15, linewidth=0.5)
                else:
                    ax.plot(steps, values, label=run_name, linewidth=2)

            ax.set_xlabel('Training Steps')
            ax.set_ylabel(metric.split('/')[-1].replace('_', ' ').title())
            ax.set_title(metric)
            ax.legend()
            ax.grid(True, alpha=0.3)

        # Hide extra subplots
        for idx in range(n_metrics, len(axes)):
            axes[idx].set_visible(False)

        fig.suptitle('Training Learning Curves', fontsize=18, fontweight='bold')
        plt.tight_layout()

        if save_path:
            plt.savefig(save_path)
            print(f"Saved figure to {save_path}")

        return fig

    def plot_comparison_matrix(
        self,
        metric: str = 'rollout/ep_rew_mean',
        figsize: tuple[int, int] = (12, 8),
        save_path: str | None = None,
    ) -> plt.Figure:
        """
        Create a comparison matrix showing all runs side-by-side.

        Args:
            metric: Metric to compare
            figsize: Figure size
            save_path: Optional path to save figure

        Returns:
            Matplotlib figure
        """
        fig, axes = plt.subplots(2, 2, figsize=figsize)

        # 1. Learning curves
        ax = axes[0, 0]
        for run_name, run in self.runs.items():
            if metric in run.metrics:
                df = run.metrics[metric]
                smoothed = self._smooth(df['value'].values, 0.9)
                ax.plot(df['step'], smoothed, label=run_name, linewidth=2)
        ax.set_xlabel('Steps')
        ax.set_ylabel('Value')
        ax.set_title(f'{metric} - Learning Curves')
        ax.legend()
        ax.grid(True, alpha=0.3)

        # 2. Final performance
        ax = axes[0, 1]
        final_values = []
        labels = []
        for run_name, run in self.runs.items():
            if metric in run.metrics:
                df = run.metrics[metric]
                final_values.append(df['value'].iloc[-100:].mean())  # Last 100 steps
                labels.append(run_name)

        colors = sns.color_palette("husl", len(labels))
        bars = ax.bar(range(len(labels)), final_values, color=colors)
        ax.set_xticks(range(len(labels)))
        ax.set_xticklabels(labels, rotation=45, ha='right')
        ax.set_ylabel('Final Value (last 100 steps)')
        ax.set_title('Final Performance Comparison')
        ax.grid(True, alpha=0.3, axis='y')

        # Add value labels on bars
        for bar, val in zip(bars, final_values):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{val:.3f}', ha='center', va='bottom', fontsize=10)

        # 3. Training efficiency (steps to threshold)
        ax = axes[1, 0]
        efficiency_data = []
        for run_name, run in self.runs.items():
            if metric in run.metrics:
                df = run.metrics[metric]
                # Find when metric exceeds threshold (e.g., 70% of max)
                max_val = df['value'].max()
                threshold = max_val * 0.7
                mask = df['value'] >= threshold
                if mask.any():
                    steps_to_threshold = df[mask]['step'].iloc[0]
                    efficiency_data.append((run_name, steps_to_threshold))

        if efficiency_data:
            names, steps = zip(*efficiency_data)
            ax.barh(range(len(names)), steps, color=colors[:len(names)])
            ax.set_yticks(range(len(names)))
            ax.set_yticklabels(names)
            ax.set_xlabel('Steps to 70% of Max Performance')
            ax.set_title('Training Efficiency')
            ax.grid(True, alpha=0.3, axis='x')

        # 4. Variance analysis
        ax = axes[1, 1]
        for run_name, run in self.runs.items():
            if metric in run.metrics:
                df = run.metrics[metric]
                # Calculate rolling variance
                window = 50
                rolling_var = pd.Series(df['value']).rolling(window=window).std()
                ax.plot(df['step'], rolling_var, label=run_name, linewidth=2, alpha=0.7)
        ax.set_xlabel('Steps')
        ax.set_ylabel('Rolling Std Dev')
        ax.set_title('Training Stability (Variance)')
        ax.legend()
        ax.grid(True, alpha=0.3)

        fig.suptitle(f'Comprehensive Analysis: {metric}', fontsize=16, fontweight='bold')
        plt.tight_layout()

        if save_path:
            plt.savefig(save_path)
            print(f"Saved comparison matrix to {save_path}")

        return fig

    def plot_3d_exploration(
        self,
        x_metric: str = 'train/learning_rate',
        y_metric: str = 'train/policy_loss',
        z_metric: str = 'rollout/ep_rew_mean',
        save_path: str | None = None,
    ) -> go.Figure:
        """
        Create interactive 3D plot exploring metric relationships.

        Args:
            x_metric: Metric for X axis
            y_metric: Metric for Y axis
            z_metric: Metric for Z axis (typically reward)
            save_path: Optional path to save HTML

        Returns:
            Plotly figure
        """
        fig = go.Figure()

        for run_name, run in self.runs.items():
            # Check if all metrics exist
            if not all(m in run.metrics for m in [x_metric, y_metric, z_metric]):
                continue

            # Merge metrics on step
            df = run.metrics[z_metric].copy()
            df = df.rename(columns={'value': 'z'})

            # Join other metrics
            for metric, axis in [(x_metric, 'x'), (y_metric, 'y')]:
                metric_df = run.metrics[metric][['step', 'value']]
                metric_df = metric_df.rename(columns={'value': axis})
                df = df.merge(metric_df, on='step', how='inner')

            # Smooth for better visualization
            for col in ['x', 'y', 'z']:
                df[col] = self._smooth(df[col].values, 0.85)

            # Add trace
            fig.add_trace(go.Scatter3d(
                x=df['x'],
                y=df['y'],
                z=df['z'],
                mode='lines+markers',
                name=run_name,
                line=dict(width=4),
                marker=dict(
                    size=4,
                    color=df['z'],
                    colorscale='Viridis',
                    showscale=True,
                    colorbar=dict(title=z_metric.split('/')[-1]),
                ),
                text=[f"Step: {s}" for s in df['step']],
                hovertemplate=(
                    f"<b>{run_name}</b><br>"
                    f"{x_metric}: %{{x:.4f}}<br>"
                    f"{y_metric}: %{{y:.4f}}<br>"
                    f"{z_metric}: %{{z:.4f}}<br>"
                    "%{text}<extra></extra>"
                ),
            ))

        fig.update_layout(
            title=dict(
                text=f'3D Training Exploration<br><sub>{z_metric} vs {x_metric} vs {y_metric}</sub>',
                x=0.5,
                xanchor='center',
            ),
            scene=dict(
                xaxis_title=x_metric.split('/')[-1].replace('_', ' ').title(),
                yaxis_title=y_metric.split('/')[-1].replace('_', ' ').title(),
                zaxis_title=z_metric.split('/')[-1].replace('_', ' ').title(),
                camera=dict(
                    eye=dict(x=1.5, y=1.5, z=1.3)
                ),
            ),
            width=1000,
            height=800,
            hovermode='closest',
        )

        if save_path:
            fig.write_html(save_path)
            print(f"Saved 3D plot to {save_path}")

        return fig

    def create_statistical_report(self) -> pd.DataFrame:
        """
        Generate statistical comparison report across all runs.

        Returns:
            DataFrame with statistical metrics for each run
        """
        report_data = []

        for run_name, run in self.runs.items():
            row = {'Run': run_name, 'Total Steps': run.total_steps}

            # Analyze reward metric
            if 'rollout/ep_rew_mean' in run.metrics:
                rewards = run.metrics['rollout/ep_rew_mean']['value']
                row.update({
                    'Final Reward (Mean)': rewards.iloc[-100:].mean(),
                    'Final Reward (Std)': rewards.iloc[-100:].std(),
                    'Max Reward': rewards.max(),
                    'Improvement Rate': self._calculate_improvement_rate(rewards),
                })

            # Analyze training stability
            if 'train/policy_loss' in run.metrics:
                loss = run.metrics['train/policy_loss']['value']
                row['Final Policy Loss'] = loss.iloc[-100:].mean()

            if 'train/value_loss' in run.metrics:
                loss = run.metrics['train/value_loss']['value']
                row['Final Value Loss'] = loss.iloc[-100:].mean()

            report_data.append(row)

        df = pd.DataFrame(report_data)
        return df

    def export_for_paper(
        self,
        output_dir: str | Path,
        formats: list[str] | None = None,
    ) -> None:
        """
        Export all plots in publication-ready formats.

        Args:
            output_dir: Directory to save exports
            formats: Image formats to export ('png', 'pdf', 'svg')
        """
        if formats is None:
            formats = ['png', 'pdf']
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        print(f"Exporting publication-ready figures to {output_dir}...")

        # Learning curves
        for fmt in formats:
            self.plot_learning_curves(save_path=str(output_dir / f"learning_curves.{fmt}"))
        plt.close('all')

        # Comparison matrix
        for fmt in formats:
            self.plot_comparison_matrix(save_path=str(output_dir / f"comparison_matrix.{fmt}"))
        plt.close('all')

        # 3D exploration (HTML only)
        self.plot_3d_exploration(save_path=str(output_dir / "3d_exploration.html"))

        # Statistical report
        report = self.create_statistical_report()
        report.to_csv(output_dir / "statistical_report.csv", index=False)
        report.to_latex(output_dir / "statistical_report.tex", index=False)

        print(f"✓ Export complete! Check {output_dir}")

    @staticmethod
    def _smooth(values: np.ndarray, weight: float = 0.9) -> np.ndarray:
        """Apply exponential moving average smoothing."""
        smoothed = np.zeros_like(values)
        smoothed[0] = values[0]
        for i in range(1, len(values)):
            smoothed[i] = weight * smoothed[i-1] + (1 - weight) * values[i]
        return smoothed

    @staticmethod
    def _calculate_improvement_rate(series: pd.Series) -> float:
        """Calculate improvement rate using linear regression."""
        if len(series) < 2:
            return 0.0
        x = np.arange(len(series))
        slope, _, _, _, _ = stats.linregress(x, series.values)
        return float(slope)


def quick_analysis(logs_dir: str = "./logs") -> TrainingAnalyzer:
    """
    Quick analysis with default settings.

    Example:
        >>> analyzer = quick_analysis("./logs")
        >>> analyzer.plot_learning_curves()
        >>> plt.show()
    """
    analyzer = TrainingAnalyzer(logs_dir)
    print(f"\nAvailable metrics: {len(analyzer.get_metric_names())}")
    print(f"Available runs: {list(analyzer.runs.keys())}")
    return analyzer
