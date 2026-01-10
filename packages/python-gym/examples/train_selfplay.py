#!/usr/bin/env python3
"""
Historical Self-Play Training for ManaCore.

This script implements Option B: Historical Self-Play where the agent
trains against past checkpoints of itself, creating an adaptive curriculum.

Key features:
- Checkpoints saved every N steps
- Opponent pool grows as training progresses
- Mix of current policy, checkpoints, and random for exploration
- Periodic evaluation against fixed opponents (Random, Greedy)

Usage:
    uv run python examples/train_selfplay.py
    uv run python examples/train_selfplay.py --timesteps 250000
    uv run python examples/train_selfplay.py --timesteps 500000 --checkpoint-freq 50000
"""

import argparse
import time
from datetime import datetime
from pathlib import Path

import gymnasium as gym
import numpy as np

import manacore_gym  # noqa: F401
from manacore_gym import ManaCoreBattleEnv, SelfPlayEnv


class SelfPlayCallback:
    """Callback to save checkpoints and add them to the pool."""

    def __init__(
        self,
        env: SelfPlayEnv,
        save_path: str,
        checkpoint_freq: int = 25_000,
        verbose: int = 1,
    ):
        self.env = env
        self.save_path = Path(save_path)
        self.checkpoint_freq = checkpoint_freq
        self.verbose = verbose
        self.n_calls = 0
        self.checkpoint_count = 0

    def _on_step(self) -> bool:
        self.n_calls += 1

        if self.n_calls % self.checkpoint_freq == 0:
            self.checkpoint_count += 1

            # Save will be called by the training loop
            # We just track when to add to pool
            if self.verbose:
                print(f"\n[SelfPlay] Checkpoint {self.checkpoint_count} at step {self.n_calls}")

            return True  # Signal to save checkpoint

        return False

    def on_checkpoint_saved(self, checkpoint_path: str) -> None:
        """Called after a checkpoint is saved."""
        self.env.add_checkpoint(checkpoint_path)


def train_selfplay(
    timesteps: int = 100_000,
    checkpoint_freq: int = 25_000,
    save_path: str = "./models/selfplay",
    log_path: str = "./logs/selfplay",
    current_weight: float = 0.2,
    random_weight: float = 0.1,
    seed: int = 42,
    n_envs: int = 8,
) -> str:
    """
    Train PPO with historical self-play.

    Args:
        timesteps: Total training timesteps
        checkpoint_freq: Steps between checkpoints
        save_path: Directory for model checkpoints
        log_path: Directory for tensorboard logs
        current_weight: Probability of playing against current policy
        random_weight: Probability of playing against random
        seed: Random seed

    Returns:
        Path to final model
    """
    try:
        from sb3_contrib import MaskablePPO
        from sb3_contrib.common.wrappers import ActionMasker
        from stable_baselines3.common.callbacks import BaseCallback
        from stable_baselines3.common.vec_env import SubprocVecEnv
    except ImportError as e:
        print("Error: sb3-contrib required.")
        print("Install with: pip install sb3-contrib")
        raise SystemExit(1) from e

    print("=" * 60)
    print("Historical Self-Play Training")
    print("=" * 60)
    print(f"Timesteps:       {timesteps:,}")
    print(f"Checkpoint Freq: {checkpoint_freq:,}")
    print(f"Parallel Envs:   {n_envs}")
    print(f"Current Weight:  {current_weight}")
    print(f"Random Weight:   {random_weight}")
    print(f"Pool Weight:     {1 - current_weight - random_weight:.2f}")
    print("=" * 60)

    # Create directories
    save_dir = Path(save_path)
    save_dir.mkdir(parents=True, exist_ok=True)

    # Create self-play environment
    def mask_fn(env: gym.Env) -> np.ndarray:
        assert isinstance(env, SelfPlayEnv)
        return env.action_masks()

    def make_selfplay_env() -> gym.Env:
        """Factory function for creating self-play environments."""
        env: gym.Env = SelfPlayEnv(
            checkpoint_dir=str(save_dir),
            current_weight=current_weight,
            random_weight=random_weight,
        )
        env = ActionMasker(env, mask_fn)
        return env

    # Create vectorized self-play environments
    env = SubprocVecEnv([make_selfplay_env for _ in range(n_envs)])

    # Create model
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
        ent_coef=0.01,  # Standard exploration
        verbose=1,
        seed=seed,
        tensorboard_log=log_path,
    )

    # Set reference to current model for self-play in all envs
    for i in range(n_envs):
        env.env_method("set_current_model", model, indices=[i])

    # Custom callback for checkpointing
    class SelfPlaySaveCallback(BaseCallback):
        def __init__(
            self,
            selfplay_vec_env: SubprocVecEnv,
            save_dir: Path,
            checkpoint_freq: int,
            n_envs: int,
            verbose: int = 1,
        ):
            super().__init__(verbose)
            self.selfplay_vec_env = selfplay_vec_env
            self.save_dir = save_dir
            self.checkpoint_freq = checkpoint_freq
            self.n_envs = n_envs
            self.checkpoint_count = 0

        def _on_step(self) -> bool:
            if self.n_calls % self.checkpoint_freq == 0:
                self.checkpoint_count += 1
                checkpoint_path = self.save_dir / f"checkpoint_{self.checkpoint_count}.zip"

                # Save checkpoint
                self.model.save(str(checkpoint_path).replace(".zip", ""))

                # Add to pool in all environments
                for i in range(self.n_envs):
                    self.selfplay_vec_env.env_method("add_checkpoint", str(checkpoint_path), indices=[i])

                if self.verbose:
                    # Get pool size from first environment
                    pool_sizes = self.selfplay_vec_env.env_method("get_checkpoint_pool_size", indices=[0])
                    pool_size = pool_sizes[0] if pool_sizes else 0
                    print(f"\n[SelfPlay] Saved checkpoint {self.checkpoint_count} (pool: {pool_size})")

            return True

    callback = SelfPlaySaveCallback(
        selfplay_vec_env=env,
        save_dir=save_dir,
        checkpoint_freq=checkpoint_freq,
        n_envs=n_envs,
    )

    # Train
    print(f"\nTraining for {timesteps:,} timesteps...")
    start = time.time()

    model.learn(
        total_timesteps=timesteps,
        callback=callback,
        progress_bar=True,
    )

    elapsed = time.time() - start
    print(f"\nTraining complete in {elapsed / 60:.1f} minutes")

    # Save final model
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    final_path = f"{save_path}/selfplay_final_{timestamp}"
    model.save(final_path)

    env.close()

    return f"{final_path}.zip"


def evaluate_model(model_path: str, opponent: str, n_games: int = 100) -> dict:
    """Evaluate trained model against a fixed opponent."""
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


def run_scaling_experiment(
    stages: list[int] | None = None,
    checkpoint_freq: int = 25_000,
    seed: int = 42,
) -> dict:
    """
    Run scaling experiment with increasing timesteps.

    Args:
        stages: List of timestep counts for each stage
        checkpoint_freq: Steps between checkpoints
        seed: Random seed

    Returns:
        Results dictionary with metrics for each stage
    """
    if stages is None:
        stages = [100_000, 250_000, 500_000]

    print("\n" + "=" * 60)
    print("SELF-PLAY SCALING EXPERIMENT")
    print("=" * 60)
    print(f"Stages: {stages}")
    print("=" * 60)

    results = {}

    for i, timesteps in enumerate(stages):
        print(f"\n{'=' * 60}")
        print(f"STAGE {i + 1}: {timesteps:,} timesteps")
        print("=" * 60)

        stage_name = f"stage_{i + 1}_{timesteps // 1000}k"
        save_path = f"./models/selfplay/{stage_name}"

        # Train
        model_path = train_selfplay(
            timesteps=timesteps,
            checkpoint_freq=checkpoint_freq,
            save_path=save_path,
            log_path=f"./logs/selfplay/{stage_name}",
            seed=seed,
        )

        # Evaluate
        print(f"\n--- Evaluating Stage {i + 1} ---")

        print("\nvs Random:")
        random_result = evaluate_model(model_path, "random", n_games=100)
        print(f"  Win rate: {random_result['win_rate']:.1f}%")

        print("\nvs Greedy:")
        greedy_result = evaluate_model(model_path, "greedy", n_games=100)
        print(f"  Win rate: {greedy_result['win_rate']:.1f}%")

        results[stage_name] = {
            "timesteps": timesteps,
            "vs_random": random_result["win_rate"],
            "vs_greedy": greedy_result["win_rate"],
            "model_path": model_path,
        }

        # Report progress
        print(f"\n--- Stage {i + 1} Complete ---")
        print(f"vs Random: {random_result['win_rate']:.1f}%")
        print(f"vs Greedy: {greedy_result['win_rate']:.1f}%")

        # Compare to baseline
        baseline_greedy = 45.0
        diff = greedy_result['win_rate'] - baseline_greedy
        if diff > 0:
            print(f"IMPROVEMENT vs baseline: +{diff:.1f}%")
        else:
            print(f"vs baseline: {diff:+.1f}%")

    # Final summary
    print("\n" + "=" * 60)
    print("SCALING EXPERIMENT RESULTS")
    print("=" * 60)
    print(f"{'Stage':<20} {'Timesteps':<12} {'vs Random':<12} {'vs Greedy':<12}")
    print("-" * 60)

    for stage_name, data in results.items():
        print(f"{stage_name:<20} {data['timesteps']:>10,} {data['vs_random']:>10.1f}% {data['vs_greedy']:>10.1f}%")

    print("-" * 60)
    print(f"Baseline (pure PPO): {'100K':<12} {'78.0%':<12} {'45.0%':<12}")
    print("=" * 60)

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Historical Self-Play Training")
    parser.add_argument("--timesteps", type=int, default=100_000,
                        help="Total training timesteps (for single run)")
    parser.add_argument("--checkpoint-freq", type=int, default=25_000,
                        help="Steps between checkpoints")
    parser.add_argument("--current-weight", type=float, default=0.2,
                        help="Probability of playing against current policy")
    parser.add_argument("--random-weight", type=float, default=0.1,
                        help="Probability of playing against random")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--n-envs", type=int, default=8,
                        help="Number of parallel environments (default: 8)")
    parser.add_argument("--scaling", action="store_true",
                        help="Run full scaling experiment (100K, 250K, 500K)")

    args = parser.parse_args()

    if args.scaling:
        # Run full scaling experiment
        run_scaling_experiment(
            stages=[100_000, 250_000, 500_000],
            checkpoint_freq=args.checkpoint_freq,
            seed=args.seed,
        )
    else:
        # Single training run
        model_path = train_selfplay(
            timesteps=args.timesteps,
            checkpoint_freq=args.checkpoint_freq,
            current_weight=args.current_weight,
            random_weight=args.random_weight,
            seed=args.seed,
            n_envs=args.n_envs,
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
        print(f"Self-play:                {greedy_result['win_rate']:.1f}% vs Greedy")

        diff = greedy_result['win_rate'] - 45
        if diff > 0:
            print(f"\nIMPROVEMENT: +{diff:.1f} percentage points!")
        else:
            print(f"\nNo improvement ({diff:+.1f}%)")
        print("=" * 60)


if __name__ == "__main__":
    main()
