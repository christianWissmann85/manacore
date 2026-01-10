#!/usr/bin/env python3
"""
DAgger (Dataset Aggregation) data collection for ManaCore.

This script implements the DAgger algorithm to improve imitation learning:
1. Run the current policy (ImitatorNet) to collect trajectories
2. At each state, query what the expert (GreedyBot) would do
3. Aggregate this data with the original training data
4. The learner visits its own states but learns from expert labels

This addresses the distribution mismatch problem in behavior cloning.

Usage:
    # Collect DAgger data using current ImitatorNet
    uv run python examples/collect_dagger.py ./models/imitator-greedy --games 100

    # Collect multiple iterations
    uv run python examples/collect_dagger.py ./models/imitator-greedy --games 200 --iterations 3

    # Combine with existing data
    uv run python examples/collect_dagger.py ./models/imitator-greedy --games 100 \
        --existing-data ./data/greedy-training-data.npz

Requirements:
    pip install torch numpy
"""

import argparse
import time
from pathlib import Path

import numpy as np
import torch

# Import to register the environment
import manacore_gym  # noqa: F401
from manacore_gym.bridge import BunBridge
from manacore_gym.neural.imitator import ImitatorNet


def load_imitator_model(model_dir: str, device: str = "cpu") -> ImitatorNet:
    """Load a trained ImitatorNet from a directory."""
    from manacore_gym.neural import ImitatorNet as ImitatorNetClass

    model_path = Path(model_dir) / "best_model.pt"
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")

    checkpoint = torch.load(model_path, map_location=device, weights_only=False)
    state_dict = checkpoint["model_state_dict"]

    # Infer architecture from state dict
    input_dim = state_dict["hidden.0.weight"].shape[1]
    output_dim = state_dict["output.weight"].shape[0]

    hidden_dims = []
    i = 0
    while f"hidden.{i}.weight" in state_dict:
        hidden_dims.append(state_dict[f"hidden.{i}.weight"].shape[0])
        i += 3

    model = ImitatorNetClass(
        input_dim=input_dim,
        hidden_dims=tuple(hidden_dims),
        output_dim=output_dim,
        dropout=0.1,
    )
    model.load_state_dict(state_dict)
    model = model.to(device)
    model.eval()

    return model


def collect_dagger_data(
    model: ImitatorNet,
    bridge: BunBridge,
    n_games: int = 100,
    expert: str = "greedy",
    temperature: float = 0.5,
    device: str = "cpu",
    verbose: bool = True,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Collect DAgger data by running the learner and querying the expert.

    Args:
        model: The current ImitatorNet policy
        bridge: BunBridge instance for server communication
        n_games: Number of games to collect
        expert: Expert bot type to query
        temperature: Softmax temperature for learner
        device: Device for inference
        verbose: Print progress

    Returns:
        Tuple of (features, actions, legal_counts, outcomes) arrays
    """
    all_features = []
    all_actions = []
    all_legal_counts = []
    all_outcomes = []

    total_samples = 0
    expert_matches = 0

    for game_idx in range(n_games):
        # Create a game where ImitatorNet plays against the expert
        # We'll query the expert for what it would do as player at each state
        game_response = bridge.create_game(
            opponent=expert,
            deck="random",
            opponent_deck="random",
        )
        game_id = game_response["gameId"]

        game_features = []
        game_actions = []
        game_legal_counts = []

        done = False
        while not done:
            # Get current state
            state = bridge.get_state(game_id)
            if state.get("done", False):
                break

            # Get observation features
            features = np.array(state["observation"]["features"], dtype=np.float32)
            action_mask = np.array(game_response.get("actionMask", state.get("actionMask", [])), dtype=bool)
            legal_count = int(np.sum(action_mask))

            # Query what expert would do at this state
            expert_response = bridge.get_expert_action(game_id, expert=expert)
            expert_action = expert_response.get("expertAction", -1)

            if expert_action < 0 or expert_action >= len(action_mask):
                # Skip if expert couldn't decide
                break

            # Store the (state, expert_action) pair
            game_features.append(features)
            game_actions.append(expert_action)
            game_legal_counts.append(legal_count)
            total_samples += 1

            # Decide what action the learner takes
            if len(action_mask) < model.output_dim:
                padded_mask = np.zeros(model.output_dim, dtype=bool)
                padded_mask[: len(action_mask)] = action_mask
                action_mask = padded_mask

            obs_tensor = torch.tensor(features, dtype=torch.float32, device=device).unsqueeze(0)
            mask_tensor = torch.tensor(action_mask, dtype=torch.bool, device=device).unsqueeze(0)

            with torch.no_grad():
                learner_action_idx_tensor, _ = model.predict_action(
                    obs_tensor,
                    mask_tensor,
                    temperature=temperature,
                    sample=False,
                )
            learner_action = int(learner_action_idx_tensor.item())

            # Track how often learner matches expert
            if learner_action == expert_action:
                expert_matches += 1

            # Execute the LEARNER's action (key to DAgger!)
            try:
                game_response = bridge.step(game_id, learner_action)
                done = game_response.get("done", False) or game_response.get("truncated", False)
            except Exception:
                done = True

        # Determine game outcome
        winner = game_response.get("info", {}).get("winner", None)
        if winner is None:
            # Check from state
            state = bridge.get_state(game_id)
            winner = state.get("winner", None)

        if winner == "player":
            outcome = 1
        elif winner == "opponent":
            outcome = -1
        else:
            outcome = 0

        # Store all samples from this game with the outcome
        for f, a, lc in zip(game_features, game_actions, game_legal_counts):
            all_features.append(f)
            all_actions.append(a)
            all_legal_counts.append(lc)
            all_outcomes.append(outcome)

        # Clean up
        from contextlib import suppress

        with suppress(Exception):
            bridge.delete_game(game_id)

        if verbose and (game_idx + 1) % 10 == 0:
            match_rate = expert_matches / total_samples * 100 if total_samples > 0 else 0
            print(f"  Progress: {game_idx + 1}/{n_games} games, {total_samples} samples, {match_rate:.1f}% expert match")

    # Convert to numpy arrays
    features = np.array(all_features, dtype=np.float32)
    actions = np.array(all_actions, dtype=np.int32)
    legal_counts = np.array(all_legal_counts, dtype=np.int32)
    outcomes = np.array(all_outcomes, dtype=np.int32)

    return features, actions, legal_counts, outcomes


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect DAgger data for ManaCore")
    parser.add_argument(
        "model_dir",
        type=str,
        help="Path to ImitatorNet model directory",
    )
    parser.add_argument(
        "--games",
        type=int,
        default=100,
        help="Number of games per iteration (default: 100)",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=1,
        help="Number of DAgger iterations (default: 1)",
    )
    parser.add_argument(
        "--expert",
        type=str,
        default="greedy",
        help="Expert bot to query (default: greedy)",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.5,
        help="Softmax temperature for learner (default: 0.5)",
    )
    parser.add_argument(
        "--existing-data",
        type=str,
        default=None,
        help="Path to existing NPZ data to combine with",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="./data/dagger-data.npz",
        help="Output path for aggregated data",
    )
    parser.add_argument(
        "--device",
        type=str,
        default=None,
        help="Device (default: auto)",
    )

    args = parser.parse_args()

    # Determine device
    if args.device is None:
        args.device = "cuda" if torch.cuda.is_available() else "cpu"

    print("=" * 60)
    print("DAgger Data Collection")
    print("=" * 60)
    print(f"Model:       {args.model_dir}")
    print(f"Games:       {args.games} per iteration")
    print(f"Iterations:  {args.iterations}")
    print(f"Expert:      {args.expert}")
    print(f"Temperature: {args.temperature}")
    print(f"Device:      {args.device}")
    print("=" * 60)

    # Load existing data if specified and exists
    all_features = []
    all_actions = []
    all_legal_counts = []
    all_outcomes = []

    if args.existing_data:
        existing_path = Path(args.existing_data)
        if existing_path.exists():
            print(f"\nLoading existing data from: {args.existing_data}")
            existing = np.load(args.existing_data)
            all_features = list(existing["features"])
            all_actions = list(existing["actions"])
            all_legal_counts = list(existing["legal_counts"])
            all_outcomes = list(existing["outcomes"])
            print(f"  Loaded {len(all_actions)} existing samples")
        else:
            print(f"\nNote: Existing data not found at {args.existing_data}, starting fresh")

    # Create bridge
    bridge = BunBridge(auto_start=True)

    # Load model
    print("\nLoading model...")
    model = load_imitator_model(args.model_dir, device=args.device)
    print(f"  Input dim: {model.input_dim}, Output dim: {model.output_dim}")

    # Run DAgger iterations
    for iteration in range(args.iterations):
        print(f"\n{'=' * 60}")
        print(f"DAgger Iteration {iteration + 1}/{args.iterations}")
        print("=" * 60)

        start_time = time.time()

        features, actions, legal_counts, outcomes = collect_dagger_data(
            model=model,
            bridge=bridge,
            n_games=args.games,
            expert=args.expert,
            temperature=args.temperature,
            device=args.device,
        )

        elapsed = time.time() - start_time
        print(f"\n  Collected {len(actions)} samples in {elapsed:.1f}s")
        print(f"  Games/sec: {args.games / elapsed:.2f}")

        # Aggregate with previous data
        all_features.extend(features)
        all_actions.extend(actions)
        all_legal_counts.extend(legal_counts)
        all_outcomes.extend(outcomes)

        print(f"  Total samples: {len(all_actions)}")

        # SCOPE DECISION (2026-01-10): In-process retraining NOT implemented.
        # Rationale:
        # 1. Experimental results show limited value (see docs/training-reports/2026-01-09_dagger_ppo_warmstart.md)
        #    - DAgger improved accuracy 40.6% → 53.1% but game performance only 15.5% → 18% vs Greedy
        #    - Pure PPO from scratch achieves 45% vs Greedy (better than any imitation approach)
        # 2. For true iterative DAgger, use run_dagger_ppo_pipeline.py which orchestrates the loop
        # 3. Platform focus is RL/LLM training gym, not imitation learning reference implementation
        # 4. Separation of concerns: keep collection and training as separate, composable tools

    # Save aggregated data
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    np.savez(
        output_path,
        features=np.array(all_features, dtype=np.float32),
        actions=np.array(all_actions, dtype=np.int32),
        legal_counts=np.array(all_legal_counts, dtype=np.int32),
        outcomes=np.array(all_outcomes, dtype=np.int32),
    )

    print("\n" + "=" * 60)
    print("DAgger Data Collection Complete!")
    print("=" * 60)
    print(f"Total samples: {len(all_actions)}")
    print(f"Output saved to: {output_path}")
    print("\nNext steps:")
    print(f"  1. Retrain: uv run python examples/train_imitator.py --data {output_path}")
    print("  2. Evaluate: uv run python examples/evaluate_imitator.py ./models/imitator")
    print("  3. Repeat DAgger if needed")


if __name__ == "__main__":
    main()
