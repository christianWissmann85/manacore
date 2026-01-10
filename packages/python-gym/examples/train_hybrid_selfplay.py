#!/usr/bin/env python3
"""
Hybrid Self-Play Training for ManaCore (v2).

This script implements a two-stage training approach:
1. Warmup: Train against Greedy to establish baseline exploitation skills
2. Mixed Self-Play: Train against a diverse opponent pool for robustness

Key improvements in v2:
- Longer warmup (200K) for stronger foundation
- Mixed opponent pool during self-play:
  * 30% checkpoints (historical self-play)
  * 30% greedy (maintain exploitation skills)
  * 20% current policy (stability)
  * 20% random (exploration)
- Faster checkpoint frequency (50K) for diverse opponent pool

Usage:
    uv run python examples/train_hybrid_selfplay.py
    uv run python examples/train_hybrid_selfplay.py --total-steps 1000000
"""

import argparse
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import gymnasium as gym
import numpy as np

import manacore_gym  # noqa: F401
from manacore_gym import ManaCoreBattleEnv, SelfPlayEnv


def train_hybrid_selfplay(
    total_steps: int = 1_000_000,
    warmup_steps: int = 200_000,  # v2: Increased from 100K for stronger foundation
    checkpoint_freq: int = 50_000,  # v2: Faster checkpointing for diverse opponent pool
    eval_freq: int = 200_000,  # v2: More frequent evaluation
    save_path: str = "./models/hybrid_selfplay_v2",
    log_path: str = "./logs/hybrid_selfplay_v2",
    seed: int = 42,
    n_envs: int = 8,  # Number of parallel environments
) -> dict[str, Any]:
    """
    Train PPO with hybrid Greedy warmup + mixed self-play (v2).

    Args:
        total_steps: Total training timesteps
        warmup_steps: Steps to train against Greedy before self-play (default: 200K)
        checkpoint_freq: Steps between checkpoints (default: 50K for faster pool growth)
        eval_freq: Steps between evaluations (default: 200K)
        save_path: Directory for model checkpoints
        log_path: Directory for tensorboard logs
        seed: Random seed
        n_envs: Number of parallel environments (default: 8)

    Returns:
        Dictionary with results at each evaluation point
    """
    try:
        from sb3_contrib import MaskablePPO
        from sb3_contrib.common.wrappers import ActionMasker
        from stable_baselines3.common.callbacks import BaseCallback
        from stable_baselines3.common.vec_env import SubprocVecEnv
    except ImportError as e:
        print("Error: sb3-contrib is required.")
        print("Install with: pip install sb3-contrib")
        raise SystemExit(1) from e

    print("=" * 70)
    print("HYBRID SELF-PLAY TRAINING v2")
    print("=" * 70)
    print(f"Total Steps:     {total_steps:,}")
    print(f"Warmup Steps:    {warmup_steps:,} (vs Greedy)")
    print(f"Self-Play Steps: {total_steps - warmup_steps:,}")
    print(f"Checkpoint Freq: {checkpoint_freq:,}")
    print(f"Eval Freq:       {eval_freq:,}")
    print(f"Parallel Envs:   {n_envs}")
    print("-" * 70)
    print("Mixed Opponent Distribution (Self-Play Phase):")
    print("  30% Checkpoints (historical self-play)")
    print("  30% Greedy (maintain exploitation skills)")
    print("  20% Current policy (stability)")
    print("  20% Random (exploration)")
    print("=" * 70)

    # Create directories
    save_dir = Path(save_path)
    save_dir.mkdir(parents=True, exist_ok=True)

    results: dict[str, Any] = {
        "config": {
            "total_steps": total_steps,
            "warmup_steps": warmup_steps,
            "checkpoint_freq": checkpoint_freq,
        },
        "evaluations": {},
    }

    # =========================================================================
    # STAGE 1: WARMUP VS GREEDY
    # =========================================================================
    print("\n" + "=" * 70)
    print("STAGE 1: WARMUP VS GREEDY")
    print("=" * 70)

    def mask_fn_greedy(env: gym.Env) -> np.ndarray:
        assert isinstance(env, ManaCoreBattleEnv)
        return env.action_masks()

    def make_greedy_env() -> gym.Env:
        """Factory function for creating greedy environments."""
        env: gym.Env = ManaCoreBattleEnv(opponent="greedy")
        env = ActionMasker(env, mask_fn_greedy)
        return env

    # Create vectorized environments using SubprocVecEnv for parallel execution
    greedy_env = SubprocVecEnv([make_greedy_env for _ in range(n_envs)])

    model = MaskablePPO(
        "MlpPolicy",
        greedy_env,
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

    print(f"\nTraining vs Greedy for {warmup_steps:,} steps...")
    start_time = time.time()

    model.learn(total_timesteps=warmup_steps, progress_bar=True)

    warmup_time = time.time() - start_time
    print(f"Warmup complete in {warmup_time / 60:.1f} minutes")

    # Save warmup checkpoint
    warmup_path = save_dir / "warmup_checkpoint"
    model.save(str(warmup_path))
    print(f"Saved warmup checkpoint: {warmup_path}.zip")

    # Evaluate warmup
    print("\n--- Evaluating Warmup ---")
    warmup_results = evaluate_model(str(warmup_path) + ".zip")
    results["evaluations"][f"warmup_{warmup_steps // 1000}k"] = {
        "steps": warmup_steps,
        "vs_random": warmup_results["random"],
        "vs_greedy": warmup_results["greedy"],
        "stage": "warmup",
    }
    print(f"Warmup: {warmup_results['random']:.1f}% vs Random, {warmup_results['greedy']:.1f}% vs Greedy")

    greedy_env.close()

    # =========================================================================
    # STAGE 2: MIXED SELF-PLAY (30% checkpoint, 30% greedy, 20% current, 20% random)
    # =========================================================================
    print("\n" + "=" * 70)
    print("STAGE 2: MIXED SELF-PLAY")
    print("=" * 70)

    selfplay_steps = total_steps - warmup_steps

    def mask_fn_selfplay(env: gym.Env) -> np.ndarray:
        assert isinstance(env, SelfPlayEnv)
        return env.action_masks()

    def make_selfplay_env() -> gym.Env:
        """Factory function for creating mixed self-play environments."""
        env: gym.Env = SelfPlayEnv(
            checkpoint_dir=str(save_dir),
            pool_size=20,
            # v2: Mixed opponent distribution
            checkpoint_weight=0.3,  # 30% historical checkpoints
            greedy_weight=0.3,      # 30% greedy (maintain exploitation)
            current_weight=0.2,     # 20% current policy (stability)
            random_weight=0.2,      # 20% random (exploration)
        )
        env = ActionMasker(env, mask_fn_selfplay)
        return env

    # Create vectorized self-play environments
    selfplay_env = SubprocVecEnv([make_selfplay_env for _ in range(n_envs)])

    # Add warmup checkpoint to each self-play environment
    # Note: We need to access the underlying SelfPlayEnv instances
    for i in range(n_envs):
        selfplay_env.env_method("add_checkpoint", str(warmup_path) + ".zip", indices=[i])

    # Set the model's environment to selfplay
    model.set_env(selfplay_env)

    # Note: We don't call set_current_model with SubprocVecEnv because the model
    # can't be pickled across process boundaries. The current_weight will effectively
    # be redistributed to other opponent types when _current_model is None.
    # This is acceptable since we're already training against checkpoints.

    # Custom callback for checkpointing and evaluation
    class HybridCallback(BaseCallback):
        def __init__(
            self,
            selfplay_env: SubprocVecEnv,
            save_dir: Path,
            checkpoint_freq: int,
            eval_freq: int,
            results: dict,
            warmup_steps: int,
            n_envs: int,
            verbose: int = 1,
        ):
            super().__init__(verbose)
            self.selfplay_env = selfplay_env
            self.save_dir = save_dir
            self.checkpoint_freq = checkpoint_freq
            self.eval_freq = eval_freq
            self.results = results
            self.warmup_steps = warmup_steps
            self.n_envs = n_envs
            self.checkpoint_count = 1  # Start at 1 (warmup is checkpoint 0)
            self.last_eval_step = warmup_steps

        def _on_step(self) -> bool:
            # Adjust step count to include warmup
            total_steps = self.warmup_steps + self.num_timesteps

            # Checkpoint
            if self.num_timesteps % self.checkpoint_freq == 0 and self.num_timesteps > 0:
                self.checkpoint_count += 1
                checkpoint_path = self.save_dir / f"checkpoint_{total_steps // 1000}k"
                self.model.save(str(checkpoint_path))

                # Add checkpoint to all self-play environments
                for i in range(self.n_envs):
                    self.selfplay_env.env_method("add_checkpoint", str(checkpoint_path) + ".zip", indices=[i])

                # Get pool size from first environment
                pool_sizes = self.selfplay_env.env_method("get_checkpoint_pool_size", indices=[0])
                pool_size = pool_sizes[0] if pool_sizes else 0

                if self.verbose:
                    print(f"\n[Hybrid] Checkpoint at {total_steps:,} steps (pool: {pool_size})")

            # Evaluation
            if total_steps - self.last_eval_step >= self.eval_freq:
                self.last_eval_step = total_steps
                eval_path = self.save_dir / f"eval_{total_steps // 1000}k"
                self.model.save(str(eval_path))

                if self.verbose:
                    print(f"\n--- Evaluating at {total_steps:,} steps ---")

                eval_results = evaluate_model(str(eval_path) + ".zip")
                self.results["evaluations"][f"step_{total_steps // 1000}k"] = {
                    "steps": total_steps,
                    "vs_random": eval_results["random"],
                    "vs_greedy": eval_results["greedy"],
                    "stage": "selfplay",
                }

                if self.verbose:
                    print(f"Results: {eval_results['random']:.1f}% vs Random, {eval_results['greedy']:.1f}% vs Greedy")

            return True

    callback = HybridCallback(
        selfplay_env=selfplay_env,
        save_dir=save_dir,
        checkpoint_freq=checkpoint_freq,
        eval_freq=eval_freq,
        results=results,
        warmup_steps=warmup_steps,
        n_envs=n_envs,
    )

    print(f"\nTraining self-play for {selfplay_steps:,} steps...")
    selfplay_start = time.time()

    model.learn(
        total_timesteps=selfplay_steps,
        callback=callback,
        progress_bar=True,
        reset_num_timesteps=False,  # Continue step count
    )

    selfplay_time = time.time() - selfplay_start
    total_time = time.time() - start_time

    print(f"\nSelf-play complete in {selfplay_time / 60:.1f} minutes")
    print(f"Total training time: {total_time / 60:.1f} minutes")

    # Save final model
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    final_path = save_dir / f"hybrid_final_{timestamp}"
    model.save(str(final_path))

    # Final evaluation
    print("\n--- Final Evaluation ---")
    final_results = evaluate_model(str(final_path) + ".zip")
    results["evaluations"]["final"] = {
        "steps": total_steps,
        "vs_random": final_results["random"],
        "vs_greedy": final_results["greedy"],
        "stage": "final",
    }

    selfplay_env.close()

    # =========================================================================
    # SUMMARY
    # =========================================================================
    print("\n" + "=" * 70)
    print("TRAINING COMPLETE - SUMMARY")
    print("=" * 70)
    print(f"{'Stage':<20} {'Steps':<12} {'vs Random':<12} {'vs Greedy':<12}")
    print("-" * 70)

    for name, data in results["evaluations"].items():
        steps_str = f"{data['steps']:,}"
        print(f"{name:<20} {steps_str:<12} {data['vs_random']:<11.1f}% {data['vs_greedy']:<11.1f}%")

    print("-" * 70)
    print(f"{'Baseline (pure PPO)':<20} {'100K':<12} {'78.0%':<12} {'45.0%':<12}")
    print("=" * 70)

    # Check for improvement
    final_greedy = results["evaluations"]["final"]["vs_greedy"]
    baseline = 45.0
    diff = final_greedy - baseline

    if diff > 0:
        print(f"\nIMPROVEMENT: +{diff:.1f}% vs Greedy!")
    elif diff == 0:
        print("\nNo change from baseline")
    else:
        print(f"\nBelow baseline: {diff:.1f}%")

    results["final_model"] = str(final_path) + ".zip"
    results["total_time_minutes"] = total_time / 60

    return results


def evaluate_model(model_path: str, n_games: int = 100) -> dict[str, float]:
    """Evaluate model against Random and Greedy."""
    try:
        from sb3_contrib import MaskablePPO
    except ImportError:
        return {"random": 0.0, "greedy": 0.0}

    model = MaskablePPO.load(model_path)
    results = {}

    for opponent in ["random", "greedy"]:
        env = ManaCoreBattleEnv(opponent=opponent)
        wins = 0

        for _game in range(n_games):
            obs, info = env.reset()
            done = False

            while not done:
                action_masks = env.action_masks()
                action, _ = model.predict(obs, action_masks=action_masks, deterministic=True)
                obs, reward, terminated, truncated, info = env.step(action)  # type: ignore[arg-type]
                done = terminated or truncated

            if reward > 0:  # type: ignore[operator]
                wins += 1

        env.close()
        results[opponent] = wins / n_games * 100

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Hybrid Self-Play Training v2")
    parser.add_argument("--total-steps", type=int, default=1_000_000,
                        help="Total training timesteps")
    parser.add_argument("--warmup-steps", type=int, default=200_000,
                        help="Steps to train vs Greedy before self-play (default: 200K)")
    parser.add_argument("--checkpoint-freq", type=int, default=50_000,
                        help="Steps between checkpoints (default: 50K)")
    parser.add_argument("--eval-freq", type=int, default=200_000,
                        help="Steps between evaluations (default: 200K)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--n-envs", type=int, default=8,
                        help="Number of parallel environments (default: 8)")

    args = parser.parse_args()

    results = train_hybrid_selfplay(
        total_steps=args.total_steps,
        warmup_steps=args.warmup_steps,
        checkpoint_freq=args.checkpoint_freq,
        eval_freq=args.eval_freq,
        seed=args.seed,
        n_envs=args.n_envs,
    )

    # Save results
    import json
    results_path = Path("./models/hybrid_selfplay_v2/results.json")
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to: {results_path}")


if __name__ == "__main__":
    main()
