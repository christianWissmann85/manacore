#!/usr/bin/env python3
"""
Train PPO with enhanced reward shaping.

This tests whether denser intermediate rewards help break the 45% ceiling.
The gym server has been configured with 5x higher reward shaping scale.

Usage:
    uv run python examples/train_ppo_shaped.py
    uv run python examples/train_ppo_shaped.py --timesteps 200000
"""

import argparse
import time
from datetime import datetime
from pathlib import Path

import numpy as np

import manacore_gym  # noqa: F401
from manacore_gym import ManaCoreBattleEnv


def train_ppo_shaped(
    timesteps: int = 100_000,
    opponent: str = "greedy",
    save_path: str = "./models/shaped",
    log_path: str = "./logs/ppo_shaped",
    seed: int = 42,
) -> str:
    """Train PPO with reward shaping enabled."""
    try:
        from sb3_contrib import MaskablePPO
        from sb3_contrib.common.wrappers import ActionMasker
        from stable_baselines3.common.callbacks import EvalCallback
    except ImportError as e:
        print("Error: sb3-contrib is required.")
        raise SystemExit(1) from e

    print("=" * 60)
    print("PPO Training with Enhanced Reward Shaping")
    print("=" * 60)
    print(f"Timesteps:    {timesteps:,}")
    print(f"Opponent:     {opponent}")
    print("Reward Scale: 0.5 (5x default)")
    print("=" * 60)

    # Create environment
    def mask_fn(env: ManaCoreBattleEnv) -> np.ndarray:
        return env.action_masks()

    env = ActionMasker(ManaCoreBattleEnv(opponent=opponent), mask_fn)  # type: ignore[arg-type]
    eval_env = ActionMasker(ManaCoreBattleEnv(opponent=opponent), mask_fn)  # type: ignore[arg-type]

    Path(save_path).mkdir(parents=True, exist_ok=True)

    # Create model with standard hyperparameters
    model = MaskablePPO(
        "MlpPolicy",
        env,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,
        verbose=1,
        seed=seed,
        tensorboard_log=log_path,
    )

    # Evaluation callback
    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=save_path,
        log_path=log_path,
        eval_freq=25_000,
        n_eval_episodes=50,
        deterministic=True,
        render=False,
    )

    # Train
    print(f"\nTraining for {timesteps:,} timesteps...")
    start = time.time()

    model.learn(
        total_timesteps=timesteps,
        callback=eval_callback,
        progress_bar=True,
    )

    elapsed = time.time() - start
    print(f"\nTraining complete in {elapsed / 60:.1f} minutes")

    # Save final model
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    final_path = f"{save_path}/ppo_shaped_{timestamp}"
    model.save(final_path)

    env.close()
    eval_env.close()

    return f"{final_path}.zip"


def evaluate_model(model_path: str, opponent: str, n_games: int = 100) -> dict:
    """Evaluate trained model."""
    try:
        from sb3_contrib import MaskablePPO
    except ImportError:
        return {"win_rate": 0.0}

    model = MaskablePPO.load(model_path)
    env = ManaCoreBattleEnv(opponent=opponent)

    wins = 0
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

        if (game + 1) % 20 == 0:
            print(f"  Progress: {game + 1}/{n_games} ({wins / (game + 1) * 100:.1f}% win rate)")

    env.close()

    return {
        "win_rate": wins / n_games * 100,
        "wins": wins,
        "games": n_games,
        "avg_steps": total_steps / n_games,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train PPO with reward shaping")
    parser.add_argument("--timesteps", type=int, default=100_000)
    parser.add_argument("--opponent", type=str, default="greedy")
    parser.add_argument("--seed", type=int, default=42)

    args = parser.parse_args()

    # Train
    model_path = train_ppo_shaped(
        timesteps=args.timesteps,
        opponent=args.opponent,
        seed=args.seed,
    )

    # Evaluate
    print("\n" + "=" * 60)
    print("EVALUATION")
    print("=" * 60)

    print("\nvs Random:")
    random_result = evaluate_model(model_path, "random", n_games=100)
    print(f"  Win rate: {random_result['win_rate']:.1f}%")

    print("\nvs Greedy:")
    greedy_result = evaluate_model(model_path, "greedy", n_games=100)
    print(f"  Win rate: {greedy_result['win_rate']:.1f}%")

    # Comparison
    print("\n" + "=" * 60)
    print("COMPARISON TO BASELINE")
    print("=" * 60)
    print("Previous best (pure PPO): 45% vs Greedy")
    print(f"With reward shaping:      {greedy_result['win_rate']:.1f}% vs Greedy")

    diff = greedy_result['win_rate'] - 45
    if diff > 0:
        print(f"\nIMPROVEMENT: +{diff:.1f} percentage points!")
    else:
        print(f"\nNo improvement ({diff:+.1f}%)")
    print("=" * 60)


if __name__ == "__main__":
    main()
