#!/usr/bin/env python3
"""
Train MaskablePPO with ImitatorNet warm start.

This script initializes MaskablePPO's policy network from a trained ImitatorNet,
then fine-tunes using reinforcement learning. This combines:
- Imitation learning: Start with expert-like behavior
- RL: Learn to recover from mistakes and optimize strategy

Usage:
    # Basic warm start training
    uv run python examples/train_ppo_warmstart.py ./models/imitator-greedy

    # With DAgger-improved model
    uv run python examples/train_ppo_warmstart.py ./models/imitator-dagger

    # Extended training
    uv run python examples/train_ppo_warmstart.py ./models/imitator-greedy --timesteps 500000

Requirements:
    pip install sb3-contrib torch
"""

import argparse
import time
from pathlib import Path
from typing import Any

import numpy as np
import torch

# Import to register the environment
import manacore_gym  # noqa: F401
from manacore_gym import ManaCoreBattleEnv


def load_imitator_weights(model_dir: str, device: str = "cpu") -> dict[str, torch.Tensor]:
    """Load ImitatorNet weights from a directory."""
    model_path = Path(model_dir) / "best_model.pt"
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")

    checkpoint = torch.load(model_path, map_location=device, weights_only=False)
    return checkpoint["model_state_dict"]


def get_imitator_architecture(state_dict: dict[str, torch.Tensor]) -> tuple[int, list[int], int]:
    """Infer ImitatorNet architecture from state dict."""
    input_dim = state_dict["hidden.0.weight"].shape[1]
    output_dim = state_dict["output.weight"].shape[0]

    hidden_dims = []
    i = 0
    while f"hidden.{i}.weight" in state_dict:
        hidden_dims.append(state_dict[f"hidden.{i}.weight"].shape[0])
        i += 3  # Skip ReLU and Dropout

    return input_dim, hidden_dims, output_dim


def create_warmstart_policy_kwargs(hidden_dims: list[int]) -> dict[str, Any]:
    """
    Create policy kwargs matching ImitatorNet architecture.

    SB3 MLP policy has separate pi (policy) and vf (value) networks.
    We'll use the same architecture for both.
    """
    return {
        "net_arch": {
            "pi": hidden_dims,  # Policy network (same as ImitatorNet)
            "vf": hidden_dims,  # Value function network (same structure)
        },
    }


def copy_imitator_to_ppo(
    ppo_model: Any,
    imitator_state_dict: dict[str, torch.Tensor],
) -> int:
    """
    Copy ImitatorNet weights to MaskablePPO's policy network.

    MaskablePPO structure:
    - policy.mlp_extractor.policy_net: The pi network (shared with value)
    - policy.mlp_extractor.value_net: The vf network
    - policy.action_net: Final action layer

    ImitatorNet structure:
    - hidden.0, hidden.3, hidden.6, ...: Hidden layers
    - output: Output layer

    Returns:
        Number of parameters copied
    """
    ppo_state_dict = ppo_model.policy.state_dict()
    copied_params = 0

    # Map ImitatorNet layers to PPO policy network layers
    # PPO uses: policy_net.0.weight, policy_net.2.weight, etc. (Linear, ReLU pairs)
    # ImitatorNet uses: hidden.0.weight, hidden.3.weight, etc. (Linear, ReLU, Dropout triplets)

    imitator_layer_idx = 0
    ppo_layer_idx = 0

    while f"hidden.{imitator_layer_idx}.weight" in imitator_state_dict:
        # Copy weight
        weight_key = f"mlp_extractor.policy_net.{ppo_layer_idx}.weight"
        bias_key = f"mlp_extractor.policy_net.{ppo_layer_idx}.bias"

        if weight_key in ppo_state_dict:
            imitator_weight = imitator_state_dict[f"hidden.{imitator_layer_idx}.weight"]
            imitator_bias = imitator_state_dict[f"hidden.{imitator_layer_idx}.bias"]

            # Check shape compatibility
            if ppo_state_dict[weight_key].shape == imitator_weight.shape:
                ppo_state_dict[weight_key] = imitator_weight.clone()
                ppo_state_dict[bias_key] = imitator_bias.clone()
                copied_params += imitator_weight.numel() + imitator_bias.numel()
                print(f"  Copied {weight_key}: {imitator_weight.shape}")

                # Also copy to value network for a reasonable starting point
                vf_weight_key = f"mlp_extractor.value_net.{ppo_layer_idx}.weight"
                vf_bias_key = f"mlp_extractor.value_net.{ppo_layer_idx}.bias"
                if vf_weight_key in ppo_state_dict and ppo_state_dict[vf_weight_key].shape == imitator_weight.shape:
                    ppo_state_dict[vf_weight_key] = imitator_weight.clone()
                    ppo_state_dict[vf_bias_key] = imitator_bias.clone()
            else:
                print(f"  Shape mismatch for {weight_key}: PPO={ppo_state_dict[weight_key].shape}, Imitator={imitator_weight.shape}")

        imitator_layer_idx += 3  # Skip ReLU and Dropout in ImitatorNet
        ppo_layer_idx += 2  # Skip ReLU in PPO

    # Copy output layer to action_net
    if "output.weight" in imitator_state_dict and "action_net.weight" in ppo_state_dict:
        imitator_out_weight = imitator_state_dict["output.weight"]
        imitator_out_bias = imitator_state_dict["output.bias"]
        ppo_out_weight = ppo_state_dict["action_net.weight"]

        # PPO action space might be smaller - only copy the matching part
        min_actions = min(imitator_out_weight.shape[0], ppo_out_weight.shape[0])
        min_features = min(imitator_out_weight.shape[1], ppo_out_weight.shape[1])

        if min_features == ppo_out_weight.shape[1]:
            ppo_state_dict["action_net.weight"][:min_actions, :] = imitator_out_weight[:min_actions, :min_features].clone()
            ppo_state_dict["action_net.bias"][:min_actions] = imitator_out_bias[:min_actions].clone()
            copied_params += min_actions * min_features + min_actions
            print(f"  Copied action_net: [{min_actions}, {min_features}]")
        else:
            print(f"  Shape mismatch for action_net: PPO={ppo_out_weight.shape}, Imitator={imitator_out_weight.shape}")

    # Load the modified state dict
    ppo_model.policy.load_state_dict(ppo_state_dict)

    return copied_params


def train_ppo_warmstart(
    imitator_dir: str,
    opponent: str = "greedy",
    total_timesteps: int = 200_000,
    eval_freq: int = 25_000,
    save_path: str = "./models",
    log_path: str = "./logs/ppo_warmstart",
    seed: int = 42,
    verbose: int = 1,
) -> str:
    """
    Train MaskablePPO with ImitatorNet warm start.

    Args:
        imitator_dir: Path to trained ImitatorNet directory
        opponent: Bot to train against
        total_timesteps: Total training timesteps
        eval_freq: Evaluation frequency
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
        from stable_baselines3.common.callbacks import EvalCallback
    except ImportError as e:
        print("Error: sb3-contrib is required.")
        print("Install with: uv pip install sb3-contrib")
        raise SystemExit(1) from e

    # Load ImitatorNet weights and get architecture
    print(f"\nLoading ImitatorNet from: {imitator_dir}")
    imitator_state_dict = load_imitator_weights(imitator_dir)
    input_dim, hidden_dims, output_dim = get_imitator_architecture(imitator_state_dict)
    print(f"  Architecture: {input_dim} -> {hidden_dims} -> {output_dim}")

    # Create environment
    print(f"\nCreating environment (opponent: {opponent})...")

    def mask_fn(env: ManaCoreBattleEnv) -> np.ndarray:
        return env.action_masks()

    env = ActionMasker(ManaCoreBattleEnv(opponent=opponent), mask_fn)  # type: ignore[arg-type]
    eval_env = ActionMasker(ManaCoreBattleEnv(opponent=opponent), mask_fn)  # type: ignore[arg-type]

    # Create policy kwargs matching ImitatorNet architecture
    policy_kwargs = create_warmstart_policy_kwargs(hidden_dims)
    print(f"  Policy architecture: {policy_kwargs}")

    # Create MaskablePPO
    print("\nInitializing MaskablePPO...")
    model = MaskablePPO(
        "MlpPolicy",
        env,
        learning_rate=1e-4,  # Lower LR for fine-tuning
        n_steps=2048,
        batch_size=128,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.1,  # Smaller clip range for fine-tuning
        ent_coef=0.01,  # Less exploration since we have a good start
        vf_coef=0.5,
        max_grad_norm=0.5,
        policy_kwargs=policy_kwargs,
        verbose=verbose,
        seed=seed,
        tensorboard_log=log_path,
    )

    # Copy ImitatorNet weights to PPO
    print("\nCopying ImitatorNet weights to PPO...")
    copied = copy_imitator_to_ppo(model, imitator_state_dict)
    print(f"  Copied {copied:,} parameters")

    # Setup evaluation callback
    Path(save_path).mkdir(parents=True, exist_ok=True)
    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=save_path,
        log_path=log_path,
        eval_freq=eval_freq,
        n_eval_episodes=50,
        deterministic=True,
        render=False,
    )

    # Train
    print(f"\nStarting training for {total_timesteps:,} timesteps...")
    print("=" * 60)
    start_time = time.time()

    model.learn(
        total_timesteps=total_timesteps,
        callback=eval_callback,
        progress_bar=True,
    )

    elapsed = time.time() - start_time
    print("=" * 60)
    print(f"Training complete in {elapsed:.1f}s")

    # Save final model
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    final_path = f"{save_path}/ppo_warmstart_{opponent}_{timestamp}"
    model.save(final_path)
    print(f"Final model saved to: {final_path}.zip")

    # Cleanup
    env.close()
    eval_env.close()

    return f"{final_path}.zip"


def main() -> None:
    parser = argparse.ArgumentParser(description="Train MaskablePPO with ImitatorNet warm start")
    parser.add_argument(
        "imitator_dir",
        type=str,
        help="Path to trained ImitatorNet directory",
    )
    parser.add_argument(
        "--opponent",
        type=str,
        default="greedy",
        help="Opponent to train against (default: greedy)",
    )
    parser.add_argument(
        "--timesteps",
        type=int,
        default=200_000,
        help="Total training timesteps (default: 200000)",
    )
    parser.add_argument(
        "--eval-freq",
        type=int,
        default=25_000,
        help="Evaluation frequency (default: 25000)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="./models",
        help="Output directory for models",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed",
    )
    parser.add_argument(
        "--verbose",
        type=int,
        default=1,
        help="Verbosity level",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("MaskablePPO Training with ImitatorNet Warm Start")
    print("=" * 60)
    print(f"ImitatorNet:  {args.imitator_dir}")
    print(f"Opponent:     {args.opponent}")
    print(f"Timesteps:    {args.timesteps:,}")
    print(f"Eval freq:    {args.eval_freq:,}")
    print(f"Output:       {args.output}")
    print("=" * 60)

    train_ppo_warmstart(
        imitator_dir=args.imitator_dir,
        opponent=args.opponent,
        total_timesteps=args.timesteps,
        eval_freq=args.eval_freq,
        save_path=args.output,
        seed=args.seed,
        verbose=args.verbose,
    )


if __name__ == "__main__":
    main()
