#!/usr/bin/env python3
"""Debug test for the self-play environment."""

import numpy as np

import manacore_gym  # noqa: F401
from manacore_gym import SelfPlayEnv


def test_selfplay_debug() -> None:
    """Debug the self-play environment step by step."""
    print("=" * 60)
    print("Debugging SelfPlayEnv")
    print("=" * 60)

    env = SelfPlayEnv(
        checkpoint_dir="./test_checkpoints",
        current_weight=0.0,
        random_weight=1.0,
    )

    print("\n1. Reset...")
    obs, info = env.reset()
    print(f"   Observation shape: {obs.shape}")
    print(f"   Opponent type: {info.get('opponent_type')}")
    print(f"   Legal actions: {info.get('num_legal_actions')}")
    print(f"   Action mask sum: {np.sum(env.action_masks())}")

    # Try a few steps with verbose output
    for step_num in range(10):
        action_mask = env.action_masks()
        legal_actions = np.where(action_mask)[0]

        print(f"\nStep {step_num + 1}:")
        print(f"  Legal actions count: {len(legal_actions)}")
        print(f"  Action mask sum: {np.sum(action_mask)}")

        if len(legal_actions) == 0:
            print("  NO LEGAL ACTIONS - checking state...")
            state = env._current_state
            if state:
                print(f"    done: {state.get('done')}")
                print(f"    info.priorityPlayer: {state.get('info', {}).get('priorityPlayer')}")
                print(f"    info.turn: {state.get('info', {}).get('turn')}")
                print(f"    info.phase: {state.get('info', {}).get('phase')}")
            break

        action = np.random.choice(legal_actions)
        print(f"  Taking action: {action}")

        obs, reward, terminated, truncated, info = env.step(action)

        print(f"  Result: reward={reward}, term={terminated}, trunc={truncated}")
        print(f"  Priority: {info.get('priorityPlayer', 'unknown')}")

        if terminated or truncated:
            print(f"  GAME ENDED - reward: {reward}")
            break

    env.close()


if __name__ == "__main__":
    test_selfplay_debug()
