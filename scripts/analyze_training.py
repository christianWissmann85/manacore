#!/usr/bin/env python3
"""
Quick analysis script for Phase 3 training runs.

Usage:
    # Analyze all runs
    uv run python scripts/analyze_training.py

    # Export for paper
    uv run python scripts/analyze_training.py --export

    # Specific log directory
    uv run python scripts/analyze_training.py --logs ./logs/custom
"""

import argparse
from pathlib import Path

import matplotlib.pyplot as plt

from manacore_gym.analysis import TrainingAnalyzer


def main():
    parser = argparse.ArgumentParser(description="Analyze ManaCore training runs")
    parser.add_argument(
        "--logs",
        type=str,
        default="./logs",
        help="Path to logs directory (default: ./logs)",
    )
    parser.add_argument(
        "--export",
        action="store_true",
        help="Export publication-ready figures",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="./output/analysis",
        help="Output directory for exports (default: ./output/analysis)",
    )
    parser.add_argument(
        "--show",
        action="store_true",
        help="Show plots interactively",
    )
    parser.add_argument(
        "--metric",
        type=str,
        default="rollout/ep_rew_mean",
        help="Primary metric for comparison (default: rollout/ep_rew_mean)",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("ManaCore Phase 3 Training Analysis")
    print("=" * 60)

    # Load analyzer
    analyzer = TrainingAnalyzer(args.logs)

    if not analyzer.runs:
        print(f"\n❌ No training runs found in {args.logs}")
        return

    # Show summary
    print(f"\n📊 Loaded {len(analyzer.runs)} run(s)")
    print("\nStatistical Summary:")
    print("-" * 60)
    report = analyzer.create_statistical_report()
    print(report.to_string(index=False))

    # Export mode
    if args.export:
        print(f"\n📤 Exporting publication-ready figures to {args.output}...")
        analyzer.export_for_paper(args.output, formats=["png", "pdf"])
        print("\n✅ Export complete!")
        return

    # Interactive mode
    print("\n📈 Generating visualizations...")

    # Learning curves
    fig1 = analyzer.plot_learning_curves()
    if args.show:
        plt.show()
    else:
        output_path = Path(args.output)
        output_path.mkdir(parents=True, exist_ok=True)
        fig1.savefig(output_path / "learning_curves.png", dpi=300)
        print(f"  ✓ Saved learning_curves.png")
        plt.close(fig1)

    # Comparison matrix
    fig2 = analyzer.plot_comparison_matrix(metric=args.metric)
    if args.show:
        plt.show()
    else:
        fig2.savefig(output_path / "comparison_matrix.png", dpi=300)
        print(f"  ✓ Saved comparison_matrix.png")
        plt.close(fig2)

    # 3D exploration
    fig3 = analyzer.plot_3d_exploration()
    if args.show:
        fig3.show()
    else:
        fig3.write_html(output_path / "3d_exploration.html")
        print(f"  ✓ Saved 3d_exploration.html")

    if not args.show:
        print(f"\n📁 All figures saved to {args.output}")

    print("\n" + "=" * 60)
    print("Analysis complete! ✨")
    print("=" * 60)


if __name__ == "__main__":
    main()
