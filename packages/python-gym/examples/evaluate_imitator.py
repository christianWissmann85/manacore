#!/usr/bin/env python3
"""
Evaluate trained ImitatorNet against different opponents.

This script tests how well the behavior-cloned ImitatorNet performs
in actual games against RandomBot and GreedyBot.

Usage:
    # Evaluate against both random and greedy
    uv run python examples/evaluate_imitator.py ./models/imitator-greedy

    # Evaluate against specific opponents
    uv run python examples/evaluate_imitator.py ./models/imitator-greedy --opponents random greedy

    # More games for statistical significance
    uv run python examples/evaluate_imitator.py ./models/imitator-greedy --games 500

Requirements:
    pip install torch
"""

import argparse
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch

# Import to register the environment
import manacore_gym  # noqa: F401
from manacore_gym import ManaCoreBattleEnv
from manacore_gym.neural.imitator import ImitatorNet


@dataclass
class EvalResult:
    """Results from evaluating against a single opponent."""

    opponent: str
    games: int
    wins: int
    losses: int
    draws: int
    total_steps: int
    total_time: float

    @property
    def win_rate(self) -> float:
        return self.wins / self.games if self.games > 0 else 0.0

    @property
    def avg_steps(self) -> float:
        return self.total_steps / self.games if self.games > 0 else 0.0

    @property
    def games_per_sec(self) -> float:
        return self.games / self.total_time if self.total_time > 0 else 0.0


def load_imitator_model(model_dir: str, device: str = "cpu") -> ImitatorNet:
    """
    Load a trained ImitatorNet from a directory.

    Args:
        model_dir: Directory containing best_model.pt
        device: Device to load model on

    Returns:
        Loaded ImitatorNet model
    """
    from manacore_gym.neural import ImitatorNet as ImitatorNetClass

    model_path = Path(model_dir) / "best_model.pt"
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")

    # Load checkpoint
    checkpoint = torch.load(model_path, map_location=device, weights_only=False)

    # Infer architecture from state dict
    state_dict = checkpoint["model_state_dict"]

    # Get input dim from first layer
    input_dim = state_dict["hidden.0.weight"].shape[1]

    # Get output dim from last layer
    output_dim = state_dict["output.weight"].shape[0]

    # Infer hidden dims from weight shapes
    # Hidden layers follow pattern: hidden.0.weight, hidden.3.weight, hidden.6.weight
    # (each block is Linear + ReLU + Dropout = 3 modules)
    hidden_dims = []
    i = 0
    while f"hidden.{i}.weight" in state_dict:
        hidden_dims.append(state_dict[f"hidden.{i}.weight"].shape[0])
        i += 3  # Skip ReLU and Dropout

    print(f"  Detected architecture: {input_dim} -> {hidden_dims} -> {output_dim}")

    # Create model
    model = ImitatorNetClass(
        input_dim=input_dim,
        hidden_dims=tuple(hidden_dims),
        output_dim=output_dim,
        dropout=0.1,  # Doesn't matter for eval
    )

    # Load weights
    model.load_state_dict(state_dict)
    model = model.to(device)
    model.eval()

    return model


def evaluate_imitator(
    model: ImitatorNet,
    opponent: str = "greedy",
    n_games: int = 100,
    temperature: float = 0.5,
    sample: bool = False,
    verbose: bool = True,
    seed: int | None = None,
    device: str = "cpu",
) -> EvalResult:
    """
    Evaluate ImitatorNet against a specific opponent.

    Args:
        model: Trained ImitatorNet
        opponent: Bot type to play against
        n_games: Number of games to play
        temperature: Softmax temperature (lower = more deterministic)
        sample: If True, sample from distribution; if False, take argmax
        verbose: Print progress
        seed: Random seed for reproducibility
        device: Device for inference

    Returns:
        EvalResult with statistics
    """
    # Create environment
    env = ManaCoreBattleEnv(opponent=opponent)

    wins = 0
    losses = 0
    draws = 0
    total_steps = 0

    start_time = time.time()

    for game in range(n_games):
        obs, info = env.reset(seed=seed + game if seed else None)
        done = False
        steps = 0

        while not done:
            # Get legal action mask
            mask = env.action_masks()

            # Pad mask to match model output dimension if needed
            if len(mask) < model.output_dim:
                padded_mask = np.zeros(model.output_dim, dtype=bool)
                padded_mask[: len(mask)] = mask
                mask = padded_mask

            # Convert to tensors
            obs_tensor = torch.tensor(obs, dtype=torch.float32, device=device).unsqueeze(0)
            mask_tensor = torch.tensor(mask, dtype=torch.bool, device=device).unsqueeze(0)

            # Predict action
            with torch.no_grad():
                action_idx_tensor, _ = model.predict_action(
                    obs_tensor,
                    mask_tensor,
                    temperature=temperature,
                    sample=sample,
                )
            action = int(action_idx_tensor.item())

            # Take step
            obs, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated
            steps += 1

        total_steps += steps

        if float(reward) > 0:
            wins += 1
        elif float(reward) < 0:
            losses += 1
        else:
            draws += 1

        if verbose and (game + 1) % 10 == 0:
            current_wr = wins / (game + 1) * 100
            print(f"  Progress: {game + 1}/{n_games} games ({current_wr:.1f}% win rate)")

    elapsed = time.time() - start_time
    env.close()

    return EvalResult(
        opponent=opponent,
        games=n_games,
        wins=wins,
        losses=losses,
        draws=draws,
        total_steps=total_steps,
        total_time=elapsed,
    )


def evaluate_against_all(
    model: ImitatorNet,
    opponents: list[str],
    n_games: int = 100,
    temperature: float = 0.5,
    sample: bool = False,
    seed: int | None = None,
    device: str = "cpu",
) -> list[EvalResult]:
    """Evaluate model against multiple opponents."""
    results = []

    for opponent in opponents:
        print(f"\nEvaluating vs {opponent}...")
        result = evaluate_imitator(
            model=model,
            opponent=opponent,
            n_games=n_games,
            temperature=temperature,
            sample=sample,
            seed=seed,
            device=device,
        )
        results.append(result)

    return results


def print_results_table(results: list[EvalResult]) -> None:
    """Print a formatted results table."""
    print("\n" + "=" * 70)
    print("IMITATION MODEL EVALUATION RESULTS")
    print("=" * 70)
    print(f"{'Opponent':<15} {'Games':>8} {'Wins':>8} {'Losses':>8} {'Win %':>10} {'Avg Steps':>10}")
    print("-" * 70)

    total_games = 0
    total_wins = 0
    total_losses = 0

    for r in results:
        print(f"{r.opponent:<15} {r.games:>8} {r.wins:>8} {r.losses:>8} {r.win_rate * 100:>9.1f}% {r.avg_steps:>10.1f}")
        total_games += r.games
        total_wins += r.wins
        total_losses += r.losses

    print("-" * 70)
    overall_wr = total_wins / total_games * 100 if total_games > 0 else 0
    print(f"{'OVERALL':<15} {total_games:>8} {total_wins:>8} {total_losses:>8} {overall_wr:>9.1f}%")
    print("=" * 70)


def compare_with_random_baseline(
    model: ImitatorNet,
    opponent: str = "greedy",
    n_games: int = 100,
    temperature: float = 0.5,
    device: str = "cpu",
) -> None:
    """Compare ImitatorNet performance with random baseline."""
    print("\nComparing ImitatorNet vs random baseline...")

    # Evaluate ImitatorNet
    print("\n[ImitatorNet]")
    imitator_result = evaluate_imitator(
        model=model,
        opponent=opponent,
        n_games=n_games,
        temperature=temperature,
        device=device,
    )

    # Evaluate random baseline
    print("\n[Random Baseline]")
    env = ManaCoreBattleEnv(opponent=opponent)

    random_wins = 0
    random_steps = 0
    start = time.time()

    for game in range(n_games):
        obs, info = env.reset()
        done = False
        steps = 0

        while not done:
            mask = env.action_masks()
            legal_actions = np.where(mask)[0]
            action = np.random.choice(legal_actions)
            obs, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated
            steps += 1

        random_steps += steps
        if float(reward) > 0:
            random_wins += 1

        if (game + 1) % 10 == 0:
            print(f"  Progress: {game + 1}/{n_games} games ({random_wins / (game + 1) * 100:.1f}% win rate)")

    random_time = time.time() - start
    env.close()

    # Print comparison
    print("\n" + "=" * 50)
    print("COMPARISON: ImitatorNet vs Random Baseline")
    print("=" * 50)
    print(f"Opponent: {opponent}")
    print(f"Games: {n_games}")
    print("-" * 50)
    print(f"{'Metric':<20} {'Imitator':>12} {'Random':>12}")
    print("-" * 50)
    print(f"{'Win Rate':<20} {imitator_result.win_rate * 100:>11.1f}% {random_wins / n_games * 100:>11.1f}%")
    print(f"{'Avg Steps':<20} {imitator_result.avg_steps:>12.1f} {random_steps / n_games:>12.1f}")
    print(f"{'Games/sec':<20} {imitator_result.games_per_sec:>12.2f} {n_games / random_time:>12.2f}")
    print("-" * 50)

    improvement = (imitator_result.win_rate - random_wins / n_games) * 100
    print(f"\nImprovement over random: {improvement:+.1f} percentage points")


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate trained ImitatorNet")
    parser.add_argument(
        "model_dir",
        type=str,
        help="Path to model directory containing best_model.pt",
    )
    parser.add_argument(
        "--games",
        type=int,
        default=100,
        help="Number of games per opponent (default: 100)",
    )
    parser.add_argument(
        "--opponents",
        nargs="+",
        default=["random", "greedy"],
        help="Opponents to evaluate against (default: random greedy)",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.5,
        help="Softmax temperature (default: 0.5, lower = more deterministic)",
    )
    parser.add_argument(
        "--sample",
        action="store_true",
        help="Sample from distribution instead of argmax",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Random seed for reproducibility",
    )
    parser.add_argument(
        "--compare-random",
        action="store_true",
        help="Also compare with random baseline",
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
    print("ManaCore ImitatorNet Evaluation")
    print("=" * 60)
    print(f"Model:       {args.model_dir}")
    print(f"Games:       {args.games} per opponent")
    print(f"Opponents:   {', '.join(args.opponents)}")
    print(f"Temperature: {args.temperature}")
    print(f"Device:      {args.device}")
    print("=" * 60)

    # Load model
    print("\nLoading model...")
    model = load_imitator_model(args.model_dir, device=args.device)
    print("  Model loaded successfully")

    # Run evaluation
    results = evaluate_against_all(
        model=model,
        opponents=args.opponents,
        n_games=args.games,
        temperature=args.temperature,
        sample=args.sample,
        seed=args.seed,
        device=args.device,
    )

    # Print results
    print_results_table(results)

    # Optional: Compare with random baseline
    if args.compare_random:
        compare_with_random_baseline(
            model=model,
            opponent=args.opponents[0],
            n_games=args.games,
            temperature=args.temperature,
            device=args.device,
        )


if __name__ == "__main__":
    main()
