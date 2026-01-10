#!/usr/bin/env python3
"""
Curriculum Learning v2 - Progressive difficulty with mixed opponents.

Key improvements over v1:
1. Mixed opponent stages (e.g., 75% Random + 25% Greedy)
2. Longer training per stage for proper learning
3. Win rate tracking with early stopping
4. Comprehensive evaluation at each stage

Curriculum:
  Stage 1: 100% Random      (100K steps, target 90%)
  Stage 2: 50% Random + 50% Greedy (100K steps, target 70%)
  Stage 3: 100% Greedy      (200K steps, target 55%)

Usage:
    # Full curriculum (~400K steps, ~1 hour)
    uv run python examples/train_curriculum_v2.py

    # Quick test (~100K steps)
    uv run python examples/train_curriculum_v2.py --quick

Monitor:
    tensorboard --logdir ./logs/curriculum_v2/
"""

import argparse
import random
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import gymnasium as gym
import numpy as np

import manacore_gym  # noqa: F401
from manacore_gym import ManaCoreBattleEnv


@dataclass
class CurriculumStage:
    """A curriculum stage with mixed opponents."""
    name: str
    opponents: dict[str, float]  # opponent -> probability
    timesteps: int
    target_win_rate: float
    eval_opponent: str  # Primary opponent for evaluation


# Standard curriculum - progressive difficulty
STANDARD_CURRICULUM = [
    CurriculumStage(
        name="Stage 1: Master Random",
        opponents={"random": 1.0},
        timesteps=100_000,
        target_win_rate=0.90,
        eval_opponent="random",
    ),
    CurriculumStage(
        name="Stage 2: Transition (Mixed)",
        opponents={"random": 0.5, "greedy": 0.5},
        timesteps=100_000,
        target_win_rate=0.70,
        eval_opponent="greedy",
    ),
    CurriculumStage(
        name="Stage 3: Master Greedy",
        opponents={"greedy": 1.0},
        timesteps=200_000,
        target_win_rate=0.55,
        eval_opponent="greedy",
    ),
]

# Quick curriculum for testing
QUICK_CURRICULUM = [
    CurriculumStage(
        name="Stage 1: Beat Random",
        opponents={"random": 1.0},
        timesteps=30_000,
        target_win_rate=0.85,
        eval_opponent="random",
    ),
    CurriculumStage(
        name="Stage 2: Transition",
        opponents={"random": 0.5, "greedy": 0.5},
        timesteps=30_000,
        target_win_rate=0.65,
        eval_opponent="greedy",
    ),
    CurriculumStage(
        name="Stage 3: Beat Greedy",
        opponents={"greedy": 1.0},
        timesteps=50_000,
        target_win_rate=0.50,
        eval_opponent="greedy",
    ),
]


class MixedOpponentEnv(ManaCoreBattleEnv):
    """
    Environment that samples opponents according to curriculum probabilities.
    Extends ManaCoreBattleEnv to maintain gymnasium compatibility.
    """

    def __init__(self, opponents: dict[str, float]):
        # Initialize with random as default, will be overridden on reset
        super().__init__(opponent="random")
        self.opponents = opponents
        self.opponent_list = list(opponents.keys())
        self.opponent_probs = list(opponents.values())

    def _sample_opponent(self) -> str:
        return random.choices(self.opponent_list, weights=self.opponent_probs)[0]

    def reset(self, **kwargs: Any) -> tuple[np.ndarray, dict]:
        # Sample new opponent for each episode
        self.opponent = self._sample_opponent()
        return super().reset(**kwargs)


def evaluate_model(
    model: Any,
    opponent: str,
    n_games: int = 50,
    verbose: bool = True,
) -> dict[str, float]:
    """Evaluate model against a specific opponent."""
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
        if reward > 0:  # type: ignore[operator]
            wins += 1

        if verbose and (game + 1) % 10 == 0:
            print(f"  Progress: {game + 1}/{n_games} ({wins / (game + 1) * 100:.1f}% win rate)")

    env.close()

    return {
        "win_rate": wins / n_games,
        "wins": wins,
        "games": n_games,
        "avg_steps": total_steps / n_games,
    }


def train_stage(
    model: Any,
    stage: CurriculumStage,
    n_envs: int = 8,
    eval_freq: int = 20_000,
    eval_games: int = 30,
    verbose: bool = True,
) -> dict[str, Any]:
    """Train for one curriculum stage."""
    from sb3_contrib.common.wrappers import ActionMasker
    from stable_baselines3.common.vec_env import SubprocVecEnv

    if verbose:
        print(f"\n{'=' * 70}")
        print(f"  {stage.name}")
        print(f"  Opponents: {stage.opponents}")
        print(f"  Target: {stage.target_win_rate:.0%} vs {stage.eval_opponent}")
        print(f"  Timesteps: {stage.timesteps:,}")
        print(f"{'=' * 70}\n")

    # Create parallel mixed opponent environments
    def mask_fn(env: gym.Env) -> np.ndarray:
        assert isinstance(env, MixedOpponentEnv)
        return env.action_masks()

    def make_mixed_env() -> gym.Env:
        env_inst: gym.Env = MixedOpponentEnv(stage.opponents)
        env_inst = ActionMasker(env_inst, mask_fn)
        return env_inst

    wrapped_env = SubprocVecEnv([make_mixed_env for _ in range(n_envs)])

    # Update model's environment
    model.set_env(wrapped_env)

    # Track progress
    best_win_rate = 0.0
    checkpoints = []
    start_time = time.time()

    # Train in chunks with evaluation
    trained = 0
    while trained < stage.timesteps:
        chunk = min(eval_freq, stage.timesteps - trained)

        model.learn(
            total_timesteps=chunk,
            reset_num_timesteps=False,
            progress_bar=verbose,
        )
        trained += chunk

        # Evaluate
        eval_result = evaluate_model(model, stage.eval_opponent, n_games=eval_games, verbose=False)
        win_rate = eval_result["win_rate"]

        if win_rate > best_win_rate:
            best_win_rate = win_rate

        checkpoints.append({
            "timesteps": trained,
            "win_rate": win_rate,
        })

        if verbose:
            print(f"\n  [{trained:,}/{stage.timesteps:,}] vs {stage.eval_opponent}: {win_rate:.1%} (best: {best_win_rate:.1%})")

        # Early success
        if win_rate >= stage.target_win_rate:
            if verbose:
                print(f"\n  Target {stage.target_win_rate:.0%} reached!")
            break

    elapsed = time.time() - start_time
    wrapped_env.close()

    return {
        "stage_name": stage.name,
        "eval_opponent": stage.eval_opponent,
        "timesteps_trained": trained,
        "best_win_rate": best_win_rate,
        "final_win_rate": checkpoints[-1]["win_rate"] if checkpoints else 0,
        "target_reached": best_win_rate >= stage.target_win_rate,
        "elapsed_seconds": elapsed,
        "checkpoints": checkpoints,
    }


def train_curriculum_v2(
    curriculum: list[CurriculumStage],
    save_path: str = "./models/curriculum_v2",
    log_path: str = "./logs/curriculum_v2",
    seed: int = 42,
    n_envs: int = 8,
    verbose: bool = True,
) -> str:
    """Train through the full curriculum."""
    try:
        from sb3_contrib import MaskablePPO
        from sb3_contrib.common.wrappers import ActionMasker
        from stable_baselines3.common.vec_env import SubprocVecEnv
    except ImportError as e:
        print("Error: sb3-contrib is required.")
        raise SystemExit(1) from e

    print("=" * 70)
    print("Curriculum Learning v2 - Progressive Difficulty")
    print("=" * 70)
    print(f"Stages: {len(curriculum)}")
    total_steps = sum(s.timesteps for s in curriculum)
    print(f"Total timesteps: {total_steps:,}")
    print(f"Parallel Envs: {n_envs}")
    print(f"Seed: {seed}")
    print()
    for i, stage in enumerate(curriculum):
        print(f"  {i + 1}. {stage.name}")
        print(f"     Opponents: {stage.opponents}")
        print(f"     Steps: {stage.timesteps:,}, Target: {stage.target_win_rate:.0%}")
    print("=" * 70)

    # Initialize with random opponent
    def mask_fn(env: gym.Env) -> np.ndarray:
        assert isinstance(env, (ManaCoreBattleEnv, MixedOpponentEnv))
        return env.action_masks()

    def make_env(opponents: dict[str, float]) -> gym.Env:
        """Factory function for creating mixed opponent environments."""
        env_inst: gym.Env = MixedOpponentEnv(opponents)
        env_inst = ActionMasker(env_inst, mask_fn)
        return env_inst

    # Start with random opponent for first stage
    first_stage = curriculum[0]
    env = SubprocVecEnv([lambda: make_env(first_stage.opponents) for _ in range(n_envs)])

    # Create model with good hyperparameters
    model = MaskablePPO(
        "MlpPolicy",
        env,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=128,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.02,  # Slightly higher for exploration during curriculum
        vf_coef=0.5,
        max_grad_norm=0.5,
        verbose=0,
        seed=seed,
        tensorboard_log=log_path,
    )

    # Train through stages
    results = []
    total_start = time.time()

    for stage in curriculum:
        result = train_stage(
            model=model,
            stage=stage,
            n_envs=n_envs,
            eval_freq=20_000,
            eval_games=30,
            verbose=verbose,
        )
        results.append(result)

    total_elapsed = time.time() - total_start

    # Save model
    Path(save_path).mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_path = f"{save_path}/curriculum_v2_{timestamp}"
    model.save(model_path)

    # Final comprehensive evaluation
    print("\n" + "=" * 70)
    print("FINAL EVALUATION")
    print("=" * 70)

    final_random = evaluate_model(model, "random", n_games=100, verbose=True)
    final_greedy = evaluate_model(model, "greedy", n_games=100, verbose=True)

    print(f"\n  vs Random: {final_random['win_rate']:.1%}")
    print(f"  vs Greedy: {final_greedy['win_rate']:.1%}")

    # Summary
    print("\n" + "=" * 70)
    print("TRAINING SUMMARY")
    print("=" * 70)
    print(f"Total time: {total_elapsed / 60:.1f} minutes")
    print()
    for r in results:
        status = "PASS" if r["target_reached"] else "FAIL"
        print(f"  {r['stage_name']}")
        print(f"    vs {r['eval_opponent']}: {r['final_win_rate']:.1%} (target: {status})")
        print(f"    Time: {r['elapsed_seconds'] / 60:.1f} min")

    print(f"\nModel saved: {model_path}.zip")

    # Comparison to baseline
    print("\n" + "=" * 70)
    print("COMPARISON TO BASELINE")
    print("=" * 70)
    print("Previous best (pure PPO): 45% vs Greedy")
    print(f"Curriculum v2:            {final_greedy['win_rate']:.1%} vs Greedy")

    diff = final_greedy["win_rate"] * 100 - 45
    if diff > 0:
        print(f"\nIMPROVEMENT: +{diff:.1f} percentage points!")
    else:
        print(f"\nNo improvement ({diff:+.1f}%)")

    print("=" * 70)

    env.close()
    return f"{model_path}.zip"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Curriculum Learning v2 - Progressive Difficulty",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Curriculum Stages:
  1. Master Random (100% random) - Learn basics
  2. Transition (50/50 mixed) - Bridge to harder opponents
  3. Master Greedy (100% greedy) - Target: break 50%

Example:
  uv run python examples/train_curriculum_v2.py
  uv run python examples/train_curriculum_v2.py --quick
        """,
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Quick test (~100K steps)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed",
    )
    parser.add_argument(
        "--n-envs",
        type=int,
        default=8,
        help="Number of parallel environments (default: 8)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="./models/curriculum_v2",
        help="Output directory",
    )

    args = parser.parse_args()

    curriculum = QUICK_CURRICULUM if args.quick else STANDARD_CURRICULUM

    train_curriculum_v2(
        curriculum=curriculum,
        save_path=args.output,
        seed=args.seed,
        n_envs=args.n_envs,
    )


if __name__ == "__main__":
    main()
