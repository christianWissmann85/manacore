#!/usr/bin/env python3
"""
Train a PPO agent using Curriculum Learning.

This script trains an agent through progressively harder opponents:
1. Random bot (learn basic mechanics)
2. Greedy bot (learn tactical play)

Requirements:
    uv pip install sb3-contrib tensorboard

Usage:
    # Standard curriculum (~300K timesteps total)
    uv run python examples/train_curriculum.py

    # Fast curriculum for testing (~50K timesteps)
    uv run python examples/train_curriculum.py --fast

Monitor training:
    tensorboard --logdir ./logs/curriculum/
"""

import argparse
import os
from datetime import datetime
from typing import Any

import numpy as np

# Import to register the environment
import manacore_gym  # noqa: F401
from manacore_gym import ManaCoreBattleEnv


def evaluate(
    model,
    opponent: str,
    n_games: int = 50,
    verbose: int = 1,
) -> tuple[int, int, float]:
    """
    Evaluate model against a specific opponent.

    Returns:
        (wins, total_games, win_rate)
    """
    # Create fresh environment for eval
    env = ManaCoreBattleEnv(opponent=opponent)
    wins = 0
    total_steps = 0

    for game in range(n_games):
        obs, info = env.reset()
        done = False
        steps = 0

        while not done and steps < 500:
            action_masks = env.action_masks()
            action, _ = model.predict(obs, action_masks=action_masks, deterministic=True)
            obs, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated
            steps += 1

        total_steps += steps
        if reward > 0:
            wins += 1

    env.close()
    win_rate = wins / n_games if n_games > 0 else 0

    if verbose:
        print(f"  vs {opponent}: {wins}/{n_games} ({win_rate:.1%})")

    return wins, n_games, win_rate


def train_stage(
    model,
    env,
    opponent: str,
    timesteps: int,
    target_win_rate: float,
    eval_freq: int = 10000,
    eval_games: int = 30,
    verbose: int = 1,
) -> dict[str, Any]:
    """
    Train for one curriculum stage.

    Returns dict with training stats.
    """
    if verbose:
        print(f"\n{'=' * 60}")
        print(f"  Training vs {opponent}")
        print(f"  Target: {target_win_rate:.0%} win rate")
        print(f"  Timesteps: {timesteps:,}")
        print(f"{'=' * 60}\n")

    # Track best win rate
    best_win_rate = 0.0
    final_win_rate = 0.0

    # Train in chunks with periodic evaluation
    remaining = timesteps
    total_trained = 0

    while remaining > 0:
        chunk = min(eval_freq, remaining)

        # Train
        model.learn(
            total_timesteps=chunk,
            reset_num_timesteps=False,
            progress_bar=verbose > 0,
        )

        total_trained += chunk
        remaining -= chunk

        # Evaluate
        _, _, win_rate = evaluate(model, opponent, n_games=eval_games, verbose=0)
        final_win_rate = win_rate

        if win_rate > best_win_rate:
            best_win_rate = win_rate

        if verbose:
            print(f"  [{total_trained:,}/{timesteps:,}] Win rate: {win_rate:.1%} (best: {best_win_rate:.1%})")

        # Early stop if target reached
        if win_rate >= target_win_rate:
            if verbose:
                print(f"\n  Target {target_win_rate:.0%} reached! Moving to next stage.")
            break

    return {
        "opponent": opponent,
        "timesteps": total_trained,
        "best_win_rate": best_win_rate,
        "final_win_rate": final_win_rate,
        "target_reached": final_win_rate >= target_win_rate,
    }


def train_with_curriculum(
    fast: bool = False,
    save_path: str = "./models",
    log_path: str = "./logs/curriculum",
    seed: int = 42,
    verbose: int = 1,
) -> str:
    """
    Train agent through curriculum.

    Args:
        fast: Use shorter training for testing
        save_path: Directory to save models
        log_path: TensorBoard log directory
        seed: Random seed
        verbose: Verbosity level

    Returns:
        Path to final saved model
    """
    try:
        from sb3_contrib import MaskablePPO
        from sb3_contrib.common.wrappers import ActionMasker
    except ImportError as e:
        print("Error: sb3-contrib is required.")
        print("Install with: uv pip install sb3-contrib")
        raise SystemExit(1) from e

    # Define curriculum stages
    if fast:
        stages = [
            {"opponent": "random", "timesteps": 20_000, "target": 0.75},
            {"opponent": "greedy", "timesteps": 50_000, "target": 0.50},
        ]
    else:
        stages = [
            {"opponent": "random", "timesteps": 50_000, "target": 0.85},
            {"opponent": "greedy", "timesteps": 200_000, "target": 0.55},
        ]

    print("=" * 60)
    print("ManaCore PPO Training with Curriculum Learning")
    print("=" * 60)
    print(f"Mode: {'Fast' if fast else 'Standard'}")
    print(f"Stages: {len(stages)}")
    for i, stage in enumerate(stages):
        print(f"  {i + 1}. vs {stage['opponent']} ({stage['timesteps']:,} steps, target: {stage['target']:.0%})")
    print(f"Seed: {seed}")
    print(f"Log dir: {log_path}")
    print("=" * 60)

    # Start with random opponent (easiest)
    env = ManaCoreBattleEnv(opponent="random")

    # Wrap with action masker
    def mask_fn(env: ManaCoreBattleEnv) -> np.ndarray:
        return env.action_masks()

    env = ActionMasker(env, mask_fn)

    # Create model
    print("\nInitializing MaskablePPO model...")
    model = MaskablePPO(
        "MlpPolicy",
        env,
        verbose=0,
        seed=seed,
        tensorboard_log=log_path,
        learning_rate=3e-4,
        n_steps=1024,  # Reduced for faster iterations
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,
    )

    # Train through stages
    results = []

    for stage in stages:
        # Update opponent
        env.unwrapped.opponent = stage["opponent"]

        # Train this stage
        result = train_stage(
            model=model,
            env=env,
            opponent=stage["opponent"],
            timesteps=stage["timesteps"],
            target_win_rate=stage["target"],
            eval_freq=10_000,
            eval_games=30,
            verbose=verbose,
        )
        results.append(result)

    # Save final model
    os.makedirs(save_path, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_name = f"ppo_curriculum_{timestamp}"
    model_path = os.path.join(save_path, model_name)

    print(f"\nSaving model to {model_path}...")
    model.save(model_path)

    # Final evaluation
    print("\n" + "=" * 60)
    print("FINAL EVALUATION")
    print("=" * 60)

    evaluate(model, "random", n_games=100, verbose=verbose)
    evaluate(model, "greedy", n_games=100, verbose=verbose)

    env.close()

    # Summary
    print("\n" + "=" * 60)
    print("TRAINING SUMMARY")
    print("=" * 60)
    for r in results:
        status = "PASS" if r["target_reached"] else "FAIL"
        print(f"  vs {r['opponent']}: {r['final_win_rate']:.1%} [{status}]")

    print(f"\nModel saved to: {model_path}.zip")
    print("=" * 60)

    return model_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Train PPO with Curriculum Learning")
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Use fast curriculum for testing (~70K steps)",
    )
    parser.add_argument(
        "--save-path",
        type=str,
        default="./models",
        help="Directory to save model (default: ./models)",
    )
    parser.add_argument(
        "--log-path",
        type=str,
        default="./logs/curriculum",
        help="TensorBoard log directory (default: ./logs/curriculum)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed (default: 42)",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Reduce output verbosity",
    )

    args = parser.parse_args()
    verbose = 0 if args.quiet else 1

    train_with_curriculum(
        fast=args.fast,
        save_path=args.save_path,
        log_path=args.log_path,
        seed=args.seed,
        verbose=verbose,
    )


if __name__ == "__main__":
    main()
