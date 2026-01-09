#!/usr/bin/env python3
"""
DAgger + PPO Warm Start Pipeline for ManaCore.

This script orchestrates the full training pipeline:
1. Collect DAgger data (learner states + expert labels)
2. Retrain ImitatorNet on aggregated data
3. Fine-tune with PPO using warm start
4. Evaluate final model

This combines the best of imitation learning and RL:
- DAgger fixes distribution mismatch in behavior cloning
- PPO warm start provides expert-like initialization
- RL fine-tuning learns recovery and optimization

Usage:
    # Full pipeline with defaults
    uv run python examples/run_dagger_ppo_pipeline.py

    # Custom configuration
    uv run python examples/run_dagger_ppo_pipeline.py \
        --dagger-games 200 \
        --dagger-iterations 2 \
        --ppo-timesteps 300000

    # Skip DAgger (use existing data)
    uv run python examples/run_dagger_ppo_pipeline.py \
        --skip-dagger \
        --existing-data ./data/dagger-aggregated.npz

Research Notes:
    - DAgger: Ross et al., "A Reduction of Imitation Learning to No-Regret Online Learning"
    - Warm Start: Combining supervised pre-training with RL fine-tuning
    - Target: Break the 48% PPO ceiling, achieve 55%+ vs GreedyBot
"""

import argparse
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path


def run_command(cmd: list[str], description: str) -> bool:
    """Run a command and return success status."""
    print(f"\n{'=' * 60}")
    print(f"STEP: {description}")
    print(f"{'=' * 60}")
    print(f"Command: {' '.join(cmd)}\n")

    start = time.time()
    result = subprocess.run(cmd)
    elapsed = time.time() - start

    if result.returncode == 0:
        print(f"\n[SUCCESS] {description} completed in {elapsed:.1f}s")
        return True
    else:
        print(f"\n[FAILED] {description} failed with code {result.returncode}")
        return False


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run full DAgger + PPO warm start pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Full pipeline
    uv run python examples/run_dagger_ppo_pipeline.py

    # Quick test run
    uv run python examples/run_dagger_ppo_pipeline.py --quick

    # Extended training
    uv run python examples/run_dagger_ppo_pipeline.py --extended
        """,
    )

    # Preset modes
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Quick test run (50 games, 50K PPO steps)",
    )
    parser.add_argument(
        "--extended",
        action="store_true",
        help="Extended training (300 games, 500K PPO steps)",
    )

    # DAgger settings
    parser.add_argument(
        "--skip-dagger",
        action="store_true",
        help="Skip DAgger collection (use existing data)",
    )
    parser.add_argument(
        "--dagger-games",
        type=int,
        default=150,
        help="Games per DAgger iteration (default: 150)",
    )
    parser.add_argument(
        "--dagger-iterations",
        type=int,
        default=1,
        help="Number of DAgger iterations (default: 1)",
    )

    # Imitation training settings
    parser.add_argument(
        "--skip-imitation",
        action="store_true",
        help="Skip imitation retraining",
    )
    parser.add_argument(
        "--imitation-epochs",
        type=int,
        default=50,
        help="Epochs for imitation training (default: 50)",
    )

    # PPO settings
    parser.add_argument(
        "--skip-ppo",
        action="store_true",
        help="Skip PPO fine-tuning",
    )
    parser.add_argument(
        "--ppo-timesteps",
        type=int,
        default=200_000,
        help="PPO training timesteps (default: 200000)",
    )

    # Data paths
    parser.add_argument(
        "--existing-data",
        type=str,
        default="./data/greedy-training-data.npz",
        help="Existing training data to combine with DAgger",
    )
    parser.add_argument(
        "--base-model",
        type=str,
        default="./models/imitator-greedy",
        help="Base ImitatorNet model for DAgger collection",
    )

    # Output
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./models",
        help="Output directory for models",
    )

    args = parser.parse_args()

    # Apply presets
    if args.quick:
        args.dagger_games = 50
        args.imitation_epochs = 20
        args.ppo_timesteps = 50_000
    elif args.extended:
        args.dagger_games = 300
        args.dagger_iterations = 2
        args.imitation_epochs = 75
        args.ppo_timesteps = 500_000

    # Generate timestamp for this run
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_name = f"dagger_ppo_{timestamp}"

    print("=" * 70)
    print("DAgger + PPO Warm Start Pipeline")
    print("=" * 70)
    print(f"Run Name:          {run_name}")
    print(f"DAgger Games:      {args.dagger_games} x {args.dagger_iterations} iterations")
    print(f"Imitation Epochs:  {args.imitation_epochs}")
    print(f"PPO Timesteps:     {args.ppo_timesteps:,}")
    print(f"Base Model:        {args.base_model}")
    print(f"Existing Data:     {args.existing_data}")
    print(f"Output Dir:        {args.output_dir}")
    print("=" * 70)

    # Track timing
    pipeline_start = time.time()
    results: dict[str, bool | str] = {}

    # Step 1: Collect DAgger data
    dagger_data_path = f"./data/dagger-{timestamp}.npz"
    if not args.skip_dagger:
        cmd = [
            "uv", "run", "python", "examples/collect_dagger.py",
            args.base_model,
            "--games", str(args.dagger_games),
            "--iterations", str(args.dagger_iterations),
            "--existing-data", args.existing_data,
            "--output", dagger_data_path,
        ]
        success = run_command(cmd, "Collect DAgger Data")
        results["dagger"] = success
        if not success:
            print("\n[ABORT] DAgger collection failed. Stopping pipeline.")
            sys.exit(1)
    else:
        print("\n[SKIP] DAgger collection (using existing data)")
        dagger_data_path = args.existing_data
        results["dagger"] = False

    # Step 2: Retrain ImitatorNet on DAgger data
    dagger_model_path = f"./models/imitator-dagger-{timestamp}"
    if not args.skip_imitation:
        cmd = [
            "uv", "run", "python", "examples/train_imitator.py",
            "--data", dagger_data_path,
            "--output", dagger_model_path,
            "--epochs", str(args.imitation_epochs),
        ]
        success = run_command(cmd, "Train ImitatorNet on DAgger Data")
        results["imitation"] = success
        if not success:
            print("\n[WARN] Imitation training failed. Using base model for PPO.")
            dagger_model_path = args.base_model
    else:
        print("\n[SKIP] Imitation retraining")
        dagger_model_path = args.base_model
        results["imitation"] = False

    # Step 3: Evaluate DAgger-improved model
    if not args.skip_imitation:
        cmd = [
            "uv", "run", "python", "examples/evaluate_imitator.py",
            dagger_model_path,
            "--games", "100",
            "--temperature", "0.1",
        ]
        success = run_command(cmd, "Evaluate DAgger Model")
        results["dagger_eval"] = success

    # Step 4: PPO warm start from DAgger model
    if not args.skip_ppo:
        cmd = [
            "uv", "run", "python", "examples/train_ppo_warmstart.py",
            dagger_model_path,
            "--timesteps", str(args.ppo_timesteps),
            "--output", args.output_dir,
        ]
        success = run_command(cmd, "PPO Fine-tuning with Warm Start")
        results["ppo"] = success
        if not success:
            print("\n[WARN] PPO training failed.")
    else:
        print("\n[SKIP] PPO fine-tuning")
        results["ppo"] = False

    # Step 5: Final evaluation
    # Find the best model from PPO training
    best_model_path = Path(args.output_dir) / "best_model.zip"
    if best_model_path.exists() and not args.skip_ppo:
        cmd = [
            "uv", "run", "python", "examples/evaluate_agent.py",
            str(best_model_path),
            "--games", "200",
            "--opponents", "random", "greedy",
            "--compare-random",
        ]
        success = run_command(cmd, "Final Evaluation")
        results["final_eval"] = success

    # Summary
    pipeline_elapsed = time.time() - pipeline_start
    print("\n" + "=" * 70)
    print("PIPELINE COMPLETE")
    print("=" * 70)
    print(f"Total time: {pipeline_elapsed / 60:.1f} minutes")
    print("\nResults:")
    for step, result in results.items():
        status = "OK" if result is True else ("SKIPPED" if result == "skipped" else "FAILED")
        print(f"  {step}: {status}")

    print("\nOutput files:")
    print(f"  DAgger data:    {dagger_data_path}")
    print(f"  DAgger model:   {dagger_model_path}")
    print(f"  PPO model:      {args.output_dir}/best_model.zip")

    print("\n" + "=" * 70)
    print("Next steps:")
    print("  1. Review TensorBoard logs: tensorboard --logdir ./logs")
    print("  2. Create training report in docs/training-reports/")
    print("  3. If results are good, try extended training")
    print("=" * 70)


if __name__ == "__main__":
    main()
