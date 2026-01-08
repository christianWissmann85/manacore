#!/usr/bin/env python3
"""
Benchmark throughput of the ManaCore Gym environment.

This script measures games per second to verify performance
targets for ML training workloads.

Target: >100 games/second from Python

Usage:
    python examples/benchmark_throughput.py                  # Quick benchmark
    python examples/benchmark_throughput.py --games 1000     # Extended test
    python examples/benchmark_throughput.py --parallel 8     # Test parallel envs
"""

import argparse
import time

import numpy as np

# Import to register the environment
import manacore_gym  # noqa: F401
from manacore_gym import ManaCoreBattleEnv


def benchmark_sequential(n_games: int = 100, opponent: str = "random", max_steps: int = 200) -> dict:
    """Benchmark sequential game execution."""
    print(f"\n[Sequential Benchmark] {n_games} games vs {opponent}")
    print("-" * 50)

    env = ManaCoreBattleEnv(opponent=opponent)

    total_steps = 0
    wins = 0

    start_time = time.time()

    for game in range(n_games):
        obs, info = env.reset()
        done = False
        steps = 0

        while not done and steps < max_steps:
            mask = env.action_masks()
            legal_actions = np.where(mask)[0]
            action = np.random.choice(legal_actions)
            obs, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated
            steps += 1

        total_steps += steps
        if reward > 0:
            wins += 1

        # Progress update
        if (game + 1) % 20 == 0:
            elapsed = time.time() - start_time
            gps = (game + 1) / elapsed
            print(f"  Progress: {game + 1}/{n_games} games ({gps:.1f} games/sec)")

    elapsed = time.time() - start_time
    env.close()

    results = {
        "type": "sequential",
        "games": n_games,
        "total_steps": total_steps,
        "elapsed_sec": elapsed,
        "games_per_sec": n_games / elapsed,
        "steps_per_sec": total_steps / elapsed,
        "avg_steps_per_game": total_steps / n_games,
        "win_rate": wins / n_games,
    }

    return results


def benchmark_parallel(n_games: int = 100, n_envs: int = 4, opponent: str = "random", max_steps: int = 200) -> dict:
    """Benchmark parallel game execution using vectorized environments."""
    print(f"\n[Parallel Benchmark] {n_games} games across {n_envs} envs vs {opponent}")
    print("-" * 50)

    try:
        from manacore_gym import make_vec_env
    except ImportError:
        print("  Error: stable-baselines3 required for parallel benchmark")
        print("  Install with: pip install stable-baselines3")
        return {"type": "parallel", "error": "stable-baselines3 not installed"}

    vec_env = make_vec_env(n_envs=n_envs, opponent=opponent, vec_env_cls="dummy")

    total_steps = 0
    games_completed = 0
    wins = 0

    start_time = time.time()
    obs = vec_env.reset()

    while games_completed < n_games:
        # Random actions for all envs
        actions = []
        for i in range(n_envs):
            # Get action mask from underlying env
            mask = vec_env.envs[i].action_masks()
            legal = np.where(mask)[0]
            actions.append(np.random.choice(legal))

        obs, rewards, dones, infos = vec_env.step(actions)
        total_steps += n_envs

        # Count completed games
        for i, done in enumerate(dones):
            if done:
                games_completed += 1
                if rewards[i] > 0:
                    wins += 1

                if games_completed % 20 == 0:
                    elapsed = time.time() - start_time
                    gps = games_completed / elapsed
                    print(f"  Progress: {games_completed}/{n_games} games ({gps:.1f} games/sec)")

                if games_completed >= n_games:
                    break

    elapsed = time.time() - start_time
    vec_env.close()

    results = {
        "type": "parallel",
        "n_envs": n_envs,
        "games": games_completed,
        "total_steps": total_steps,
        "elapsed_sec": elapsed,
        "games_per_sec": games_completed / elapsed,
        "steps_per_sec": total_steps / elapsed,
        "avg_steps_per_game": total_steps / games_completed if games_completed > 0 else 0,
        "win_rate": wins / games_completed if games_completed > 0 else 0,
    }

    return results


def benchmark_step_latency(n_steps: int = 1000, opponent: str = "random") -> dict:
    """Benchmark individual step latency."""
    print(f"\n[Step Latency Benchmark] {n_steps} steps vs {opponent}")
    print("-" * 50)

    env = ManaCoreBattleEnv(opponent=opponent)
    obs, info = env.reset()

    latencies = []

    for _ in range(n_steps):
        mask = env.action_masks()
        legal_actions = np.where(mask)[0]
        action = np.random.choice(legal_actions)

        start = time.perf_counter()
        obs, reward, terminated, truncated, info = env.step(action)
        latency = (time.perf_counter() - start) * 1000  # ms

        latencies.append(latency)

        if terminated or truncated:
            obs, info = env.reset()

    env.close()

    latencies_arr = np.array(latencies)

    results = {
        "type": "step_latency",
        "n_steps": n_steps,
        "mean_ms": float(np.mean(latencies_arr)),
        "median_ms": float(np.median(latencies_arr)),
        "p95_ms": float(np.percentile(latencies_arr, 95)),
        "p99_ms": float(np.percentile(latencies_arr, 99)),
        "min_ms": float(np.min(latencies_arr)),
        "max_ms": float(np.max(latencies_arr)),
    }

    return results


def print_results(results: dict) -> None:
    """Print benchmark results."""
    print("\n" + "=" * 60)
    print(f"BENCHMARK RESULTS: {results['type'].upper()}")
    print("=" * 60)

    if "error" in results:
        print(f"Error: {results['error']}")
        return

    if results["type"] == "step_latency":
        print(f"Steps measured:  {results['n_steps']}")
        print(f"Mean latency:    {results['mean_ms']:.2f} ms")
        print(f"Median latency:  {results['median_ms']:.2f} ms")
        print(f"P95 latency:     {results['p95_ms']:.2f} ms")
        print(f"P99 latency:     {results['p99_ms']:.2f} ms")
        print(f"Min latency:     {results['min_ms']:.2f} ms")
        print(f"Max latency:     {results['max_ms']:.2f} ms")

        # Check target
        target_ms = 5.0
        if results["mean_ms"] < target_ms:
            print(f"\n[PASS] Mean latency < {target_ms}ms target")
        else:
            print(f"\n[FAIL] Mean latency >= {target_ms}ms target")

    else:
        print(f"Games completed: {results['games']}")
        print(f"Total steps:     {results['total_steps']}")
        print(f"Elapsed time:    {results['elapsed_sec']:.2f} sec")
        print(f"Games/second:    {results['games_per_sec']:.1f}")
        print(f"Steps/second:    {results['steps_per_sec']:.1f}")
        print(f"Avg game length: {results['avg_steps_per_game']:.1f} steps")
        print(f"Win rate:        {results['win_rate'] * 100:.1f}%")

        if results["type"] == "parallel":
            print(f"Parallel envs:   {results['n_envs']}")

        # Check target
        target_gps = 100.0
        if results["games_per_sec"] >= target_gps:
            print(f"\n[PASS] >= {target_gps} games/sec target")
        else:
            print(f"\n[WARN] < {target_gps} games/sec target (got {results['games_per_sec']:.1f})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark ManaCore Gym throughput")
    parser.add_argument(
        "--games",
        type=int,
        default=100,
        help="Number of games to run (default: 100)",
    )
    parser.add_argument(
        "--parallel",
        type=int,
        default=0,
        help="Number of parallel environments (0 = sequential only)",
    )
    parser.add_argument(
        "--opponent",
        type=str,
        default="random",
        choices=["random", "greedy"],
        help="Opponent type (default: random)",
    )
    parser.add_argument(
        "--latency",
        action="store_true",
        help="Also run step latency benchmark",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Run all benchmarks",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("ManaCore Gym Throughput Benchmark")
    print("=" * 60)
    print(f"Games:    {args.games}")
    print(f"Opponent: {args.opponent}")
    if args.parallel > 0:
        print(f"Parallel: {args.parallel} envs")

    all_results = []

    # Sequential benchmark
    results = benchmark_sequential(args.games, args.opponent)
    print_results(results)
    all_results.append(results)

    # Parallel benchmark
    if args.parallel > 0 or args.all:
        n_envs = args.parallel if args.parallel > 0 else 4
        results = benchmark_parallel(args.games, n_envs, args.opponent)
        print_results(results)
        all_results.append(results)

    # Step latency benchmark
    if args.latency or args.all:
        results = benchmark_step_latency(1000, args.opponent)
        print_results(results)
        all_results.append(results)

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    for r in all_results:
        if "error" in r:
            continue
        if r["type"] == "step_latency":
            print(f"  Step latency: {r['mean_ms']:.2f}ms mean")
        else:
            label = f"{r['type']}"
            if r["type"] == "parallel":
                label += f" ({r['n_envs']} envs)"
            print(f"  {label}: {r['games_per_sec']:.1f} games/sec")


if __name__ == "__main__":
    main()
