#!/usr/bin/env python3
"""
Evaluate trained agents against different opponents.

This script provides comprehensive evaluation of trained MaskablePPO models,
including win rates against multiple opponents and statistical analysis.

Requirements:
    pip install sb3-contrib

Usage:
    python examples/evaluate_agent.py models/ppo_manacore_greedy_100k.zip
    python examples/evaluate_agent.py models/my_model.zip --games 100
    python examples/evaluate_agent.py models/my_model.zip --opponents random greedy mcts
"""

import argparse
import time
from dataclasses import dataclass

import numpy as np

# Import to register the environment
import manacore_gym  # noqa: F401
from manacore_gym import ManaCoreBattleEnv


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


def evaluate_model(
    model_path: str,
    opponent: str = "greedy",
    n_games: int = 100,
    deterministic: bool = True,
    verbose: bool = True,
    seed: int | None = None,
) -> EvalResult:
    """
    Evaluate a trained model against a specific opponent.

    Args:
        model_path: Path to saved MaskablePPO model
        opponent: Bot type to play against
        n_games: Number of games to play
        deterministic: Use deterministic actions (no exploration)
        verbose: Print progress
        seed: Random seed for reproducibility

    Returns:
        EvalResult with statistics
    """
    try:
        from sb3_contrib import MaskablePPO
    except ImportError:
        print("Error: sb3-contrib is required.")
        print("Install with: pip install sb3-contrib")
        raise SystemExit(1)

    # Load model
    model = MaskablePPO.load(model_path)

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
            action_masks = env.action_masks()
            action, _ = model.predict(obs, action_masks=action_masks, deterministic=deterministic)
            obs, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated
            steps += 1

        total_steps += steps

        if reward > 0:
            wins += 1
        elif reward < 0:
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
    model_path: str,
    opponents: list[str],
    n_games: int = 100,
    seed: int | None = None,
) -> list[EvalResult]:
    """Evaluate model against multiple opponents."""
    results = []

    for opponent in opponents:
        print(f"\nEvaluating vs {opponent}...")
        result = evaluate_model(
            model_path=model_path,
            opponent=opponent,
            n_games=n_games,
            seed=seed,
        )
        results.append(result)

    return results


def print_results_table(results: list[EvalResult]) -> None:
    """Print a formatted results table."""
    print("\n" + "=" * 70)
    print("EVALUATION RESULTS")
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


def compare_with_random(
    model_path: str,
    opponent: str = "greedy",
    n_games: int = 100,
) -> None:
    """Compare trained model performance with random baseline."""
    print("\nComparing trained model vs random baseline...")

    # Evaluate trained model
    print("\n[Trained Model]")
    trained_result = evaluate_model(model_path, opponent, n_games)

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
        if reward > 0:
            random_wins += 1

        if (game + 1) % 10 == 0:
            print(f"  Progress: {game + 1}/{n_games} games ({random_wins / (game + 1) * 100:.1f}% win rate)")

    random_time = time.time() - start
    env.close()

    # Print comparison
    print("\n" + "=" * 50)
    print("COMPARISON: Trained Model vs Random Baseline")
    print("=" * 50)
    print(f"Opponent: {opponent}")
    print(f"Games: {n_games}")
    print("-" * 50)
    print(f"{'Metric':<20} {'Trained':>12} {'Random':>12}")
    print("-" * 50)
    print(f"{'Win Rate':<20} {trained_result.win_rate * 100:>11.1f}% {random_wins / n_games * 100:>11.1f}%")
    print(f"{'Avg Steps':<20} {trained_result.avg_steps:>12.1f} {random_steps / n_games:>12.1f}")
    print(f"{'Games/sec':<20} {trained_result.games_per_sec:>12.2f} {n_games / random_time:>12.2f}")
    print("-" * 50)

    improvement = (trained_result.win_rate - random_wins / n_games) * 100
    print(f"\nImprovement over random: {improvement:+.1f} percentage points")


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate trained ManaCore agents")
    parser.add_argument(
        "model_path",
        type=str,
        help="Path to saved model (e.g., models/ppo_manacore_100k.zip)",
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
        "--stochastic",
        action="store_true",
        help="Use stochastic (non-deterministic) actions",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("ManaCore Agent Evaluation")
    print("=" * 60)
    print(f"Model:     {args.model_path}")
    print(f"Games:     {args.games} per opponent")
    print(f"Opponents: {', '.join(args.opponents)}")
    print("=" * 60)

    # Run evaluation
    results = evaluate_against_all(
        model_path=args.model_path,
        opponents=args.opponents,
        n_games=args.games,
        seed=args.seed,
    )

    # Print results
    print_results_table(results)

    # Optional: Compare with random baseline
    if args.compare_random:
        compare_with_random(
            model_path=args.model_path,
            opponent=args.opponents[0],  # Use first opponent
            n_games=args.games,
        )


if __name__ == "__main__":
    main()
