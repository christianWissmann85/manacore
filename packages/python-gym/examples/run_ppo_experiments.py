#!/usr/bin/env python3
"""
PPO Experiment Runner - Sequential execution of all experiments.

This script runs:
1. Experiment A: Warm Start v2 (high exploration, no value init)
2. Experiment B: PPO Hyperparameter Sweep (configs A, B, C)

Experiments run SEQUENTIALLY to avoid resource contention.

Usage:
    # Run all experiments
    uv run python examples/run_ppo_experiments.py

    # Quick test (100K steps each)
    uv run python examples/run_ppo_experiments.py --quick

    # Run only warm start experiment
    uv run python examples/run_ppo_experiments.py --warmstart-only

    # Run only hyperparameter sweep
    uv run python examples/run_ppo_experiments.py --sweep-only
"""

import argparse
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path


def run_command(cmd: list[str], description: str) -> tuple[bool, float]:
    """Run a command and return (success, elapsed_seconds)."""
    print(f"\n{'=' * 70}")
    print(f"EXPERIMENT: {description}")
    print(f"{'=' * 70}")
    print(f"Command: {' '.join(cmd)}\n")

    start = time.time()
    result = subprocess.run(cmd)
    elapsed = time.time() - start

    if result.returncode == 0:
        print(f"\n[SUCCESS] {description} completed in {elapsed/60:.1f} minutes")
        return True, elapsed
    else:
        print(f"\n[FAILED] {description} failed with code {result.returncode}")
        return False, elapsed


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run PPO experiments sequentially",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Experiments:
  A. Warm Start v2: High exploration (ent=0.1), no value init, 300K steps
  B. Hyperparameter Sweep: Test large network, high entropy, LR schedule

Total estimated time:
  - Quick mode: ~1.5 hours
  - Full mode:  ~4-5 hours
        """,
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Quick test (100K steps instead of 300K)",
    )
    parser.add_argument(
        "--warmstart-only",
        action="store_true",
        help="Only run warm start experiment",
    )
    parser.add_argument(
        "--sweep-only",
        action="store_true",
        help="Only run hyperparameter sweep",
    )
    parser.add_argument(
        "--imitator-dir",
        type=str,
        default="./models/imitator-greedy",
        help="ImitatorNet model for warm start (default: ./models/imitator-greedy)",
    )

    args = parser.parse_args()

    timesteps = 100_000 if args.quick else 300_000
    eval_games = 50 if args.quick else 100

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    print("=" * 70)
    print("PPO Experiment Runner")
    print("=" * 70)
    print(f"Timestamp:    {timestamp}")
    print(f"Timesteps:    {timesteps:,} per experiment")
    print(f"Mode:         {'Quick' if args.quick else 'Full'}")
    print(f"Run:          {'Warm Start Only' if args.warmstart_only else 'Sweep Only' if args.sweep_only else 'All Experiments'}")
    print("=" * 70)

    results = []
    total_start = time.time()

    # Experiment A: Warm Start v2
    if not args.sweep_only:
        # Check if imitator model exists
        imitator_path = Path(args.imitator_dir) / "best_model.pt"
        if not imitator_path.exists():
            print(f"\n[WARNING] ImitatorNet not found at {imitator_path}")
            print("Skipping warm start experiment.")
            print("To run: first train an ImitatorNet with train_imitator.py")
        else:
            cmd = [
                "uv", "run", "python", "examples/train_ppo_warmstart_v2.py",
                args.imitator_dir,
                "--timesteps", str(timesteps),
                "--no-value-init",  # KEY: Don't init value network
                "--output", f"./models/warmstart_v2_{timestamp}",
            ]
            success, elapsed = run_command(cmd, "Warm Start v2 (High Exploration)")
            results.append({
                "name": "Warm Start v2",
                "success": success,
                "elapsed": elapsed,
            })

            # Evaluate warm start result
            if success:
                warmstart_model = f"./models/warmstart_v2_{timestamp}/best_model.zip"
                if Path(warmstart_model).exists():
                    eval_cmd = [
                        "uv", "run", "python", "examples/evaluate_agent.py",
                        warmstart_model,
                        "--games", str(eval_games),
                        "--opponents", "random", "greedy",
                    ]
                    run_command(eval_cmd, "Evaluate Warm Start v2")

    # Experiment B: Hyperparameter Sweep
    if not args.warmstart_only:
        sweep_cmd = [
            "uv", "run", "python", "examples/train_ppo_sweep.py",
            "--timesteps", str(timesteps),
            "--eval-games", str(eval_games),
        ]
        if args.quick:
            sweep_cmd.append("--quick")

        success, elapsed = run_command(sweep_cmd, "PPO Hyperparameter Sweep")
        results.append({
            "name": "Hyperparameter Sweep",
            "success": success,
            "elapsed": elapsed,
        })

    # Summary
    total_elapsed = time.time() - total_start

    print("\n" + "=" * 70)
    print("EXPERIMENT RUNNER COMPLETE")
    print("=" * 70)
    print(f"Total time: {total_elapsed/60:.1f} minutes ({total_elapsed/3600:.1f} hours)")
    print("\nResults:")
    for r in results:
        status = "SUCCESS" if r["success"] else "FAILED"
        print(f"  {r['name']}: {status} ({r['elapsed']/60:.1f} min)")

    print("\n" + "=" * 70)
    print("NEXT STEPS")
    print("=" * 70)
    print("1. Review TensorBoard logs:")
    print("   tensorboard --logdir ./logs")
    print("\n2. Compare best models:")
    print("   ls -la ./models/sweep/*/best_model.zip")
    print("   ls -la ./models/warmstart_v2_*/best_model.zip")
    print("\n3. If any config beat 50% vs Greedy, scale it up!")
    print("=" * 70)


if __name__ == "__main__":
    main()
