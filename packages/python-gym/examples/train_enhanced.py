#!/usr/bin/env python3
"""
Enhanced PPO Training with Reward Shaping and Larger Networks.

This script trains a PPO agent with:
- Dense reward shaping (enabled in gym-server)
- Larger neural network (256x256 hidden layers)
- Extended training (500K-1M timesteps)
- Focus on beating the greedy bot

Requirements:
    uv pip install sb3-contrib tensorboard

Usage:
    # Standard training (~500K timesteps)
    uv run python examples/train_enhanced.py

    # Extended training (~1M timesteps)
    uv run python examples/train_enhanced.py --extended

    # Quick test (~100K timesteps)
    uv run python examples/train_enhanced.py --quick

Monitor training:
    tensorboard --logdir ./logs/enhanced/
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
    model: Any,
    opponent: str,
    n_games: int = 50,
    verbose: int = 1,
) -> tuple[int, int, float]:
    """
    Evaluate model against a specific opponent.

    Returns:
        (wins, total_games, win_rate)
    """
    env = ManaCoreBattleEnv(opponent=opponent)
    wins = 0
    total_steps = 0

    for _ in range(n_games):
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
        if info.get("winner") == "player" or reward > 0:  # type: ignore[operator]
            wins += 1

    env.close()
    win_rate = wins / n_games if n_games > 0 else 0

    if verbose:
        print(f"  vs {opponent}: {wins}/{n_games} ({win_rate:.1%})")

    return wins, n_games, win_rate


def train_against_opponent(
    model: Any,
    env: Any,
    opponent: str,
    timesteps: int,
    target_win_rate: float,
    eval_freq: int = 20000,
    eval_games: int = 50,
    verbose: int = 1,
    save_best: bool = True,
    save_path: str = "./models",
) -> dict[str, Any]:
    """
    Train for one stage against a specific opponent.

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
            if save_best and save_path:
                best_path = os.path.join(save_path, f"ppo_best_vs_{opponent}")
                model.save(best_path)
                if verbose:
                    print(f"  [NEW BEST] Saved to {best_path}")

        if verbose:
            print(f"  [{total_trained:,}/{timesteps:,}] Win rate: {win_rate:.1%} (best: {best_win_rate:.1%})")

        # Early stop if target reached
        if win_rate >= target_win_rate:
            if verbose:
                print(f"\n  Target {target_win_rate:.0%} reached!")
            break

    return {
        "opponent": opponent,
        "timesteps": total_trained,
        "best_win_rate": best_win_rate,
        "final_win_rate": final_win_rate,
        "target_reached": final_win_rate >= target_win_rate,
    }


def create_large_policy_kwargs() -> dict[str, Any]:
    """Create policy kwargs for a larger network (256x256)."""
    return {
        "net_arch": {
            "pi": [256, 256],  # Policy network
            "vf": [256, 256],  # Value function network
        },
    }


def train_enhanced(
    mode: str = "standard",
    save_path: str = "./models",
    log_path: str = "./logs/enhanced",
    seed: int = 42,
    verbose: int = 1,
) -> str:
    """
    Train agent with enhanced settings.

    Args:
        mode: Training mode ("quick", "standard", "extended")
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

    # Configure timesteps based on mode
    if mode == "quick":
        total_timesteps = 100_000
        eval_freq = 20_000
    elif mode == "extended":
        total_timesteps = 1_000_000
        eval_freq = 50_000
    else:  # standard
        total_timesteps = 500_000
        eval_freq = 25_000

    print("=" * 60)
    print("ManaCore Enhanced PPO Training")
    print("=" * 60)
    print(f"Mode: {mode}")
    print(f"Total timesteps: {total_timesteps:,}")
    print("Network: 256x256 (larger)")
    print("Reward shaping: ENABLED (dense rewards)")
    print("Opponent: greedy")
    print("Target: 60% win rate")
    print(f"Seed: {seed}")
    print(f"Log dir: {log_path}")
    print("=" * 60)

    # Create environment (training directly against greedy)
    env = ManaCoreBattleEnv(opponent="greedy")

    # Wrap with action masker
    def mask_fn(env: ManaCoreBattleEnv) -> np.ndarray:
        return env.action_masks()

    env = ActionMasker(env, mask_fn)  # type: ignore[assignment,arg-type]

    # Create model with larger network and tuned hyperparameters
    print("\nInitializing MaskablePPO with larger network (256x256)...")
    os.makedirs(log_path, exist_ok=True)

    model = MaskablePPO(
        "MlpPolicy",
        env,
        verbose=0,
        seed=seed,
        tensorboard_log=log_path,
        # Larger network
        policy_kwargs=create_large_policy_kwargs(),
        # Tuned hyperparameters for dense rewards
        learning_rate=3e-4,  # Slightly higher for larger network
        n_steps=2048,  # Standard PPO
        batch_size=128,  # Larger batch for stability
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.02,  # Slightly more exploration
        max_grad_norm=0.5,
        vf_coef=0.5,
    )

    # Train against greedy
    result = train_against_opponent(
        model=model,
        env=env,
        opponent="greedy",
        timesteps=total_timesteps,
        target_win_rate=0.60,
        eval_freq=eval_freq,
        eval_games=50,
        verbose=verbose,
        save_best=True,
        save_path=save_path,
    )

    # Save final model
    os.makedirs(save_path, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_name = f"ppo_enhanced_{mode}_{timestamp}"
    model_path = os.path.join(save_path, model_name)

    print(f"\nSaving final model to {model_path}...")
    model.save(model_path)

    # Final evaluation
    print("\n" + "=" * 60)
    print("FINAL EVALUATION (100 games each)")
    print("=" * 60)

    evaluate(model, "random", n_games=100, verbose=verbose)
    evaluate(model, "greedy", n_games=100, verbose=verbose)

    env.close()

    # Summary
    print("\n" + "=" * 60)
    print("TRAINING SUMMARY")
    print("=" * 60)
    status = "PASS" if result["target_reached"] else "FAIL"
    print(f"  vs greedy: {result['final_win_rate']:.1%} (best: {result['best_win_rate']:.1%}) [{status}]")
    print(f"  Total timesteps: {result['timesteps']:,}")
    print(f"\nFinal model: {model_path}.zip")
    print(f"Best model: {save_path}/ppo_best_vs_greedy.zip")
    print("=" * 60)

    return model_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Enhanced PPO Training with Reward Shaping")
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Quick training (~100K steps)",
    )
    parser.add_argument(
        "--extended",
        action="store_true",
        help="Extended training (~1M steps)",
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
        default="./logs/enhanced",
        help="TensorBoard log directory (default: ./logs/enhanced)",
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

    if args.quick:
        mode = "quick"
    elif args.extended:
        mode = "extended"
    else:
        mode = "standard"

    train_enhanced(
        mode=mode,
        save_path=args.save_path,
        log_path=args.log_path,
        seed=args.seed,
        verbose=verbose,
    )


if __name__ == "__main__":
    main()
