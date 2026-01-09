#!/usr/bin/env python3
"""
PPO Warm Start v2 - Fixed version with high exploration.

Changes from v1:
- Higher entropy coefficient (0.1 vs 0.01) for more exploration
- Standard clip range (0.2 vs 0.1)
- More aggressive learning rate (3e-4 vs 1e-4)
- Option to NOT initialize value network from imitation weights
- Longer training default (300K vs 200K)

Usage:
    uv run python examples/train_ppo_warmstart_v2.py ./models/imitator-greedy

    # Skip value network initialization (recommended)
    uv run python examples/train_ppo_warmstart_v2.py ./models/imitator-greedy --no-value-init
"""

import argparse
import time
from pathlib import Path
from typing import Any

import numpy as np
import torch

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
        i += 3

    return input_dim, hidden_dims, output_dim


def create_warmstart_policy_kwargs(hidden_dims: list[int]) -> dict[str, Any]:
    """Create policy kwargs matching ImitatorNet architecture."""
    return {
        "net_arch": {
            "pi": hidden_dims,
            "vf": hidden_dims,
        },
    }


def copy_imitator_to_ppo(
    ppo_model: Any,
    imitator_state_dict: dict[str, torch.Tensor],
    init_value_net: bool = False,
) -> int:
    """
    Copy ImitatorNet weights to MaskablePPO's policy network.

    Args:
        ppo_model: The MaskablePPO model
        imitator_state_dict: ImitatorNet weights
        init_value_net: If True, also initialize value network (NOT recommended)

    Returns:
        Number of parameters copied
    """
    ppo_state_dict = ppo_model.policy.state_dict()
    copied_params = 0

    imitator_layer_idx = 0
    ppo_layer_idx = 0

    while f"hidden.{imitator_layer_idx}.weight" in imitator_state_dict:
        weight_key = f"mlp_extractor.policy_net.{ppo_layer_idx}.weight"
        bias_key = f"mlp_extractor.policy_net.{ppo_layer_idx}.bias"

        if weight_key in ppo_state_dict:
            imitator_weight = imitator_state_dict[f"hidden.{imitator_layer_idx}.weight"]
            imitator_bias = imitator_state_dict[f"hidden.{imitator_layer_idx}.bias"]

            if ppo_state_dict[weight_key].shape == imitator_weight.shape:
                ppo_state_dict[weight_key] = imitator_weight.clone()
                ppo_state_dict[bias_key] = imitator_bias.clone()
                copied_params += imitator_weight.numel() + imitator_bias.numel()
                print(f"  Copied {weight_key}: {imitator_weight.shape}")

                # Only copy to value network if explicitly requested
                if init_value_net:
                    vf_weight_key = f"mlp_extractor.value_net.{ppo_layer_idx}.weight"
                    vf_bias_key = f"mlp_extractor.value_net.{ppo_layer_idx}.bias"
                    if vf_weight_key in ppo_state_dict and ppo_state_dict[vf_weight_key].shape == imitator_weight.shape:
                        ppo_state_dict[vf_weight_key] = imitator_weight.clone()
                        ppo_state_dict[vf_bias_key] = imitator_bias.clone()
                        print(f"  Copied {vf_weight_key}: {imitator_weight.shape}")

        imitator_layer_idx += 3
        ppo_layer_idx += 2

    # Copy output layer to action_net
    if "output.weight" in imitator_state_dict and "action_net.weight" in ppo_state_dict:
        imitator_out_weight = imitator_state_dict["output.weight"]
        imitator_out_bias = imitator_state_dict["output.bias"]
        ppo_out_weight = ppo_state_dict["action_net.weight"]

        min_actions = min(imitator_out_weight.shape[0], ppo_out_weight.shape[0])
        min_features = min(imitator_out_weight.shape[1], ppo_out_weight.shape[1])

        if min_features == ppo_out_weight.shape[1]:
            ppo_state_dict["action_net.weight"][:min_actions, :] = imitator_out_weight[:min_actions, :min_features].clone()
            ppo_state_dict["action_net.bias"][:min_actions] = imitator_out_bias[:min_actions].clone()
            copied_params += min_actions * min_features + min_actions
            print(f"  Copied action_net: [{min_actions}, {min_features}]")

    ppo_model.policy.load_state_dict(ppo_state_dict)
    return copied_params


def train_ppo_warmstart_v2(
    imitator_dir: str,
    opponent: str = "greedy",
    total_timesteps: int = 300_000,
    eval_freq: int = 25_000,
    save_path: str = "./models",
    log_path: str = "./logs/ppo_warmstart_v2",
    seed: int = 42,
    verbose: int = 1,
    init_value_net: bool = False,
) -> str:
    """
    Train MaskablePPO with ImitatorNet warm start - v2 with fixes.

    Key changes from v1:
    - entropy_coef=0.1 (10x higher for exploration)
    - clip_range=0.2 (standard PPO value)
    - learning_rate=3e-4 (more aggressive)
    - init_value_net=False by default (let value learn from scratch)
    """
    try:
        from sb3_contrib import MaskablePPO
        from sb3_contrib.common.wrappers import ActionMasker
        from stable_baselines3.common.callbacks import EvalCallback
    except ImportError as e:
        print("Error: sb3-contrib is required.")
        print("Install with: uv pip install sb3-contrib")
        raise SystemExit(1) from e

    print(f"\nLoading ImitatorNet from: {imitator_dir}")
    imitator_state_dict = load_imitator_weights(imitator_dir)
    input_dim, hidden_dims, output_dim = get_imitator_architecture(imitator_state_dict)
    print(f"  Architecture: {input_dim} -> {hidden_dims} -> {output_dim}")

    print(f"\nCreating environment (opponent: {opponent})...")

    def mask_fn(env: ManaCoreBattleEnv) -> np.ndarray:
        return env.action_masks()

    env = ActionMasker(ManaCoreBattleEnv(opponent=opponent), mask_fn)  # type: ignore[arg-type]
    eval_env = ActionMasker(ManaCoreBattleEnv(opponent=opponent), mask_fn)  # type: ignore[arg-type]

    policy_kwargs = create_warmstart_policy_kwargs(hidden_dims)
    print(f"  Policy architecture: {policy_kwargs}")

    # V2 Hyperparameters - key changes highlighted
    print("\nInitializing MaskablePPO with V2 hyperparameters...")
    print("  learning_rate: 3e-4 (was 1e-4)")
    print("  clip_range: 0.2 (was 0.1)")
    print("  ent_coef: 0.1 (was 0.01) <- KEY CHANGE")
    print(f"  init_value_net: {init_value_net}")

    model = MaskablePPO(
        "MlpPolicy",
        env,
        learning_rate=3e-4,      # More aggressive (was 1e-4)
        n_steps=2048,
        batch_size=128,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,          # Standard PPO (was 0.1)
        ent_coef=0.1,            # HIGH EXPLORATION (was 0.01)
        vf_coef=0.5,
        max_grad_norm=0.5,
        policy_kwargs=policy_kwargs,
        verbose=verbose,
        seed=seed,
        tensorboard_log=log_path,
    )

    print("\nCopying ImitatorNet weights to PPO policy network...")
    if not init_value_net:
        print("  (Value network will learn from scratch - NOT initialized)")
    copied = copy_imitator_to_ppo(model, imitator_state_dict, init_value_net=init_value_net)
    print(f"  Copied {copied:,} parameters to policy network")

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
    print(f"Training complete in {elapsed:.1f}s ({elapsed/60:.1f} min)")

    timestamp = time.strftime("%Y%m%d_%H%M%S")
    final_path = f"{save_path}/ppo_warmstart_v2_{opponent}_{timestamp}"
    model.save(final_path)
    print(f"Final model saved to: {final_path}.zip")

    env.close()
    eval_env.close()

    return f"{final_path}.zip"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="PPO Warm Start v2 - Fixed with high exploration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Key changes from v1:
  - entropy_coef: 0.1 (was 0.01) - 10x more exploration
  - clip_range: 0.2 (was 0.1) - standard PPO value
  - learning_rate: 3e-4 (was 1e-4) - more aggressive
  - --no-value-init: Don't initialize value network (recommended)
        """,
    )
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
        default=300_000,
        help="Total training timesteps (default: 300000)",
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
        "--no-value-init",
        action="store_true",
        help="Don't initialize value network from imitation (recommended)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed",
    )

    args = parser.parse_args()

    print("=" * 70)
    print("PPO Warm Start v2 - High Exploration Fix")
    print("=" * 70)
    print(f"ImitatorNet:     {args.imitator_dir}")
    print(f"Opponent:        {args.opponent}")
    print(f"Timesteps:       {args.timesteps:,}")
    print(f"Value Net Init:  {not args.no_value_init}")
    print(f"Output:          {args.output}")
    print("=" * 70)

    train_ppo_warmstart_v2(
        imitator_dir=args.imitator_dir,
        opponent=args.opponent,
        total_timesteps=args.timesteps,
        eval_freq=args.eval_freq,
        save_path=args.output,
        seed=args.seed,
        init_value_net=not args.no_value_init,
    )


if __name__ == "__main__":
    main()
