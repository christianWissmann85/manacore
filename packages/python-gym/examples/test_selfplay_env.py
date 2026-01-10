#!/usr/bin/env python3
"""Quick test for the self-play environment."""

import numpy as np

import manacore_gym  # noqa: F401
from manacore_gym import SelfPlayEnv


def test_selfplay_env() -> None:
    """Test that the self-play environment works correctly."""
    print("=" * 60)
    print("Testing SelfPlayEnv")
    print("=" * 60)

    env = SelfPlayEnv(
        checkpoint_dir="./test_checkpoints",
        current_weight=0.0,  # No current model
        random_weight=1.0,   # All random opponents for testing
    )

    print("\n1. Testing reset...")
    obs, info = env.reset()
    print(f"   Observation shape: {obs.shape}")
    print(f"   Opponent type: {info.get('opponent_type')}")
    print(f"   Legal actions: {info.get('num_legal_actions')}")

    print("\n2. Testing step loop...")
    total_steps = 0
    games_played = 0
    max_games = 5

    while games_played < max_games:
        action_mask = env.action_masks()
        legal_actions = np.where(action_mask)[0]

        if len(legal_actions) == 0:
            print(f"   Game {games_played + 1}: No legal actions, resetting...")
            obs, info = env.reset()
            games_played += 1
            continue

        action = np.random.choice(legal_actions)
        obs, reward, terminated, truncated, info = env.step(action)
        total_steps += 1

        if terminated or truncated:
            games_played += 1
            result = "WON" if float(reward) > 0 else "LOST"
            print(f"   Game {games_played}: {result} after {total_steps} total steps")
            if games_played < max_games:
                obs, info = env.reset()

    env.close()

    print("\n3. Results:")
    print(f"   Games played: {games_played}")
    print(f"   Total steps: {total_steps}")
    print("\n" + "=" * 60)
    print("SelfPlayEnv test PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    test_selfplay_env()
