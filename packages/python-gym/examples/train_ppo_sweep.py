#!/usr/bin/env python3
"""
PPO Hyperparameter Sweep - Test multiple configurations to break the 45% ceiling.

Configurations tested:
A. Larger network (512x512 vs 64x64 default)
B. Higher entropy (0.05 vs 0.01) for more exploration
C. Learning rate schedule (linear decay from 3e-4 to 1e-5)

Each configuration runs for 300K steps with evaluation every 25K.

Usage:
    # Run all configs
    uv run python examples/train_ppo_sweep.py

    # Run specific config
    uv run python examples/train_ppo_sweep.py --config A

    # Quick test (100K steps)
    uv run python examples/train_ppo_sweep.py --quick
"""

import argparse
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import numpy as np

import manacore_gym  # noqa: F401
from manacore_gym import ManaCoreBattleEnv


@dataclass
class PPOConfig:
    """Configuration for a PPO training run."""
    name: str
    description: str
    net_arch: list[int]
    learning_rate: float | Callable[[float], float]
    ent_coef: float
    clip_range: float
    n_steps: int
    batch_size: int
    n_epochs: int
    gamma: float
    gae_lambda: float


# Define configurations to test
CONFIGS: dict[str, PPOConfig] = {
    "A": PPOConfig(
        name="large_network",
        description="Larger network (512x512) for more capacity",
        net_arch=[512, 512],
        learning_rate=3e-4,
        ent_coef=0.01,
        clip_range=0.2,
        n_steps=2048,
        batch_size=128,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
    ),
    "B": PPOConfig(
        name="high_entropy",
        description="Higher entropy (0.05) for more exploration",
        net_arch=[256, 256],
        learning_rate=3e-4,
        ent_coef=0.05,  # 5x default
        clip_range=0.2,
        n_steps=2048,
        batch_size=128,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
    ),
    "C": PPOConfig(
        name="lr_schedule",
        description="Linear LR decay (3e-4 -> 1e-5) for fine-grained convergence",
        net_arch=[256, 256],
        learning_rate=lambda progress: 3e-4 * (1 - progress) + 1e-5 * progress,
        ent_coef=0.01,
        clip_range=0.2,
        n_steps=2048,
        batch_size=128,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
    ),
}

# Baseline config for comparison
BASELINE = PPOConfig(
    name="baseline",
    description="Default SB3 settings (64x64 network)",
    net_arch=[64, 64],
    learning_rate=3e-4,
    ent_coef=0.01,
    clip_range=0.2,
    n_steps=2048,
    batch_size=64,
    n_epochs=10,
    gamma=0.99,
    gae_lambda=0.95,
)


def train_config(
    config: PPOConfig,
    opponent: str = "greedy",
    total_timesteps: int = 300_000,
    eval_freq: int = 25_000,
    save_path: str = "./models/sweep",
    log_path: str = "./logs/ppo_sweep",
    seed: int = 42,
) -> dict[str, Any]:
    """
    Train PPO with a specific configuration.

    Returns:
        Dict with training results
    """
    try:
        from sb3_contrib import MaskablePPO
        from sb3_contrib.common.wrappers import ActionMasker
        from stable_baselines3.common.callbacks import EvalCallback
    except ImportError as e:
        print("Error: sb3-contrib is required.")
        print("Install with: uv pip install sb3-contrib")
        raise SystemExit(1) from e

    print(f"\n{'=' * 70}")
    print(f"Config: {config.name}")
    print(f"Description: {config.description}")
    print(f"{'=' * 70}")
    print(f"  net_arch:      {config.net_arch}")
    print(f"  learning_rate: {config.learning_rate}")
    print(f"  ent_coef:      {config.ent_coef}")
    print(f"  clip_range:    {config.clip_range}")
    print(f"  n_steps:       {config.n_steps}")
    print(f"  batch_size:    {config.batch_size}")
    print("=" * 70)

    # Create environments
    def mask_fn(env: ManaCoreBattleEnv) -> np.ndarray:
        return env.action_masks()

    env = ActionMasker(ManaCoreBattleEnv(opponent=opponent), mask_fn)  # type: ignore[arg-type]
    eval_env = ActionMasker(ManaCoreBattleEnv(opponent=opponent), mask_fn)  # type: ignore[arg-type]

    # Configure paths for this run
    run_log_path = f"{log_path}/{config.name}"
    run_save_path = f"{save_path}/{config.name}"
    Path(run_save_path).mkdir(parents=True, exist_ok=True)

    # Create model
    policy_kwargs = {"net_arch": config.net_arch}

    model = MaskablePPO(
        "MlpPolicy",
        env,
        learning_rate=config.learning_rate,
        n_steps=config.n_steps,
        batch_size=config.batch_size,
        n_epochs=config.n_epochs,
        gamma=config.gamma,
        gae_lambda=config.gae_lambda,
        clip_range=config.clip_range,
        ent_coef=config.ent_coef,
        policy_kwargs=policy_kwargs,
        verbose=1,
        seed=seed,
        tensorboard_log=run_log_path,
    )

    # Setup evaluation callback
    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=run_save_path,
        log_path=run_log_path,
        eval_freq=eval_freq,
        n_eval_episodes=50,
        deterministic=True,
        render=False,
    )

    # Train
    start_time = time.time()
    model.learn(
        total_timesteps=total_timesteps,
        callback=eval_callback,
        progress_bar=True,
    )
    elapsed = time.time() - start_time

    # Save final model
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    final_path = f"{run_save_path}/final_{timestamp}"
    model.save(final_path)

    env.close()
    eval_env.close()

    return {
        "config_name": config.name,
        "elapsed_seconds": elapsed,
        "final_model_path": f"{final_path}.zip",
        "best_model_path": f"{run_save_path}/best_model.zip",
    }


def evaluate_model(model_path: str, opponent: str, n_games: int = 100) -> dict[str, float]:
    """Evaluate a trained model."""
    try:
        from sb3_contrib import MaskablePPO
    except ImportError:
        return {"win_rate": 0.0, "avg_steps": 0.0}

    model = MaskablePPO.load(model_path)
    env = ManaCoreBattleEnv(opponent=opponent)

    wins = 0
    total_steps = 0

    for _ in range(n_games):
        obs, info = env.reset()
        done = False
        steps = 0

        while not done:
            action_masks = env.action_masks()
            action, _ = model.predict(obs, action_masks=action_masks, deterministic=True)
            obs, reward, terminated, truncated, info = env.step(action)  # type: ignore[arg-type]
            done = terminated or truncated
            steps += 1

        total_steps += steps
        if reward > 0:  # type: ignore[operator]
            wins += 1

    env.close()

    return {
        "win_rate": wins / n_games * 100,
        "avg_steps": total_steps / n_games,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="PPO Hyperparameter Sweep",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Configurations:
  A: Larger network (512x512) - more model capacity
  B: Higher entropy (0.05) - more exploration
  C: LR schedule (3e-4 -> 1e-5) - fine-grained convergence

Example:
  uv run python examples/train_ppo_sweep.py --config A B
  uv run python examples/train_ppo_sweep.py --quick
        """,
    )
    parser.add_argument(
        "--config",
        nargs="+",
        choices=["A", "B", "C", "all"],
        default=["all"],
        help="Configs to run (default: all)",
    )
    parser.add_argument(
        "--timesteps",
        type=int,
        default=300_000,
        help="Timesteps per config (default: 300000)",
    )
    parser.add_argument(
        "--opponent",
        type=str,
        default="greedy",
        help="Opponent to train against (default: greedy)",
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Quick test run (100K steps)",
    )
    parser.add_argument(
        "--eval-games",
        type=int,
        default=100,
        help="Games per evaluation (default: 100)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed",
    )

    args = parser.parse_args()

    if args.quick:
        args.timesteps = 100_000
        args.eval_games = 50

    # Determine which configs to run
    if "all" in args.config:
        configs_to_run = list(CONFIGS.keys())
    else:
        configs_to_run = args.config

    print("=" * 70)
    print("PPO Hyperparameter Sweep")
    print("=" * 70)
    print(f"Configs:     {configs_to_run}")
    print(f"Timesteps:   {args.timesteps:,} per config")
    print(f"Opponent:    {args.opponent}")
    print(f"Eval games:  {args.eval_games}")
    print("=" * 70)

    results = []
    sweep_start = time.time()

    for config_key in configs_to_run:
        config = CONFIGS[config_key]

        # Train
        train_result = train_config(
            config=config,
            opponent=args.opponent,
            total_timesteps=args.timesteps,
            seed=args.seed,
        )

        # Evaluate vs Random
        print(f"\nEvaluating {config.name} vs random...")
        random_eval = evaluate_model(
            train_result["best_model_path"],
            "random",
            args.eval_games,
        )

        # Evaluate vs Greedy
        print(f"Evaluating {config.name} vs greedy...")
        greedy_eval = evaluate_model(
            train_result["best_model_path"],
            "greedy",
            args.eval_games,
        )

        results.append({
            "config": config_key,
            "name": config.name,
            "vs_random": random_eval["win_rate"],
            "vs_greedy": greedy_eval["win_rate"],
            "elapsed": train_result["elapsed_seconds"],
        })

        print(f"\n  {config.name}: {random_eval['win_rate']:.1f}% vs Random, {greedy_eval['win_rate']:.1f}% vs Greedy")

    sweep_elapsed = time.time() - sweep_start

    # Summary
    print("\n" + "=" * 70)
    print("SWEEP RESULTS")
    print("=" * 70)
    print(f"{'Config':<20} {'vs Random':>12} {'vs Greedy':>12} {'Time':>10}")
    print("-" * 70)

    best_greedy = 0
    best_config = ""

    for r in results:
        print(f"{r['name']:<20} {r['vs_random']:>11.1f}% {r['vs_greedy']:>11.1f}% {r['elapsed']/60:>9.1f}m")
        if r["vs_greedy"] > best_greedy:
            best_greedy = r["vs_greedy"]
            best_config = r["name"]

    print("-" * 70)
    print(f"Total time: {sweep_elapsed/60:.1f} minutes")
    print(f"\nBest config: {best_config} ({best_greedy:.1f}% vs Greedy)")

    # Compare to baseline
    print("\n" + "=" * 70)
    print("COMPARISON TO BASELINE")
    print("=" * 70)
    print("Previous best (pure PPO): 45% vs Greedy")
    print(f"Best from sweep:          {best_greedy:.1f}% vs Greedy")

    if best_greedy > 45:
        improvement = best_greedy - 45
        print(f"\nIMPROVEMENT: +{improvement:.1f} percentage points!")
    elif best_greedy > 50:
        print("\nSUCCESS: Broke the 50% barrier!")
    else:
        print(f"\nNo improvement over baseline ({best_greedy - 45:+.1f}%)")

    print("=" * 70)


if __name__ == "__main__":
    main()
