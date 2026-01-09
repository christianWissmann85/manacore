#!/usr/bin/env python3
"""
Train a MaskablePPO agent to play Magic: The Gathering.

This script demonstrates training with Stable Baselines3's MaskablePPO,
which properly handles action masking for games with variable legal actions.

Requirements:
    pip install sb3-contrib tensorboard

Usage:
    python examples/train_ppo.py                    # Train for 100k steps
    python examples/train_ppo.py --timesteps 500000 # Train longer
    python examples/train_ppo.py --opponent mcts    # Train against MCTS bot

Monitor training:
    tensorboard --logdir ./logs/ppo/
"""

import argparse
import os
from datetime import datetime

import numpy as np

# Import to register the environment
import manacore_gym  # noqa: F401
from manacore_gym import ManaCoreBattleEnv


def train(
    total_timesteps: int = 100_000,
    opponent: str = "greedy",
    save_path: str = "./models",
    log_path: str = "./logs/ppo",
    seed: int = 42,
) -> str:
    """
    Train a MaskablePPO agent.

    Args:
        total_timesteps: Number of environment steps to train for
        opponent: Bot to train against (random, greedy, mcts)
        save_path: Directory to save trained model
        log_path: Directory for TensorBoard logs
        seed: Random seed for reproducibility

    Returns:
        Path to the saved model
    """
    try:
        from sb3_contrib import MaskablePPO
        from sb3_contrib.common.wrappers import ActionMasker
    except ImportError as e:
        print("Error: sb3-contrib is required for MaskablePPO training.")
        print("Install with: pip install sb3-contrib")
        raise SystemExit(1) from e

    print("=" * 60)
    print("ManaCore PPO Training")
    print("=" * 60)
    print(f"Timesteps:    {total_timesteps:,}")
    print(f"Opponent:     {opponent}")
    print(f"Seed:         {seed}")
    print(f"Log dir:      {log_path}")
    print("=" * 60)
    print()

    # Create environment
    print("Creating environment...")
    env = ManaCoreBattleEnv(opponent=opponent)

    # Wrap with action masker for sb3-contrib
    def mask_fn(env: ManaCoreBattleEnv) -> np.ndarray:
        return env.action_masks()

    env = ActionMasker(env, mask_fn)  # type: ignore[assignment,arg-type]

    # Create model
    print("Initializing MaskablePPO model...")
    model = MaskablePPO(
        "MlpPolicy",
        env,
        verbose=1,
        seed=seed,
        tensorboard_log=log_path,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,  # Encourage exploration
    )

    # Train
    print(f"\nStarting training for {total_timesteps:,} timesteps...")
    print("Monitor with: tensorboard --logdir ./logs/ppo/\n")

    model.learn(
        total_timesteps=total_timesteps,
        progress_bar=True,
    )

    # Save model
    os.makedirs(save_path, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_name = f"ppo_manacore_{opponent}_{total_timesteps // 1000}k_{timestamp}"
    model_path = os.path.join(save_path, model_name)

    print(f"\nSaving model to {model_path}...")
    model.save(model_path)

    # Cleanup
    env.close()

    print("\nTraining complete!")
    print(f"Model saved to: {model_path}.zip")

    return model_path


def evaluate_quick(model_path: str, opponent: str = "greedy", n_games: int = 10) -> None:
    """Quick evaluation of the trained model."""
    try:
        from sb3_contrib import MaskablePPO
    except ImportError as e:
        print("Error: sb3-contrib is required.")
        raise SystemExit(1) from e

    print(f"\nQuick evaluation: {n_games} games vs {opponent}")
    print("-" * 40)

    # Load model
    model = MaskablePPO.load(model_path)

    # Create fresh environment
    env = ManaCoreBattleEnv(opponent=opponent)

    wins = 0
    losses = 0
    total_steps = 0

    for game in range(n_games):
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
            result = "WIN"
        else:
            losses += 1
            result = "LOSS"

        print(f"  Game {game + 1}: {result} ({steps} steps)")

    env.close()

    print("-" * 40)
    print(f"Results: {wins}W / {losses}L ({wins / n_games * 100:.1f}% win rate)")
    print(f"Average game length: {total_steps / n_games:.1f} steps")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train MaskablePPO on ManaCore")
    parser.add_argument(
        "--timesteps",
        type=int,
        default=100_000,
        help="Total timesteps to train (default: 100000)",
    )
    parser.add_argument(
        "--opponent",
        type=str,
        default="greedy",
        choices=["random", "greedy", "mcts", "mcts-fast", "mcts-strong"],
        help="Opponent bot type (default: greedy)",
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
        default="./logs/ppo",
        help="TensorBoard log directory (default: ./logs/ppo)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed (default: 42)",
    )
    parser.add_argument(
        "--eval",
        action="store_true",
        help="Run quick evaluation after training",
    )
    parser.add_argument(
        "--eval-games",
        type=int,
        default=10,
        help="Number of evaluation games (default: 10)",
    )

    args = parser.parse_args()

    model_path = train(
        total_timesteps=args.timesteps,
        opponent=args.opponent,
        save_path=args.save_path,
        log_path=args.log_path,
        seed=args.seed,
    )

    if args.eval:
        evaluate_quick(model_path, args.opponent, args.eval_games)


if __name__ == "__main__":
    main()
