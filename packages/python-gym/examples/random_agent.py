#!/usr/bin/env python3
"""
Example: Random agent playing Magic: The Gathering.

This script demonstrates basic usage of the ManaCore Gym environment.
"""

import gymnasium as gym
import numpy as np

# Import to register the environment
import manacore_gym  # noqa: F401


def main():
    print("Creating ManaCore environment...")

    # Create environment
    env = gym.make("ManaCore-v0", opponent="greedy")

    print("Starting game...")
    obs, info = env.reset(seed=42)

    total_reward = 0
    step_count = 0
    max_steps = 200

    while step_count < max_steps:
        # Get legal actions from the mask
        mask = info["action_mask"]
        legal_actions = np.where(mask)[0]

        if len(legal_actions) == 0:
            print("No legal actions available!")
            break

        # Random action selection
        action = np.random.choice(legal_actions)

        # Take action
        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward
        step_count += 1

        # Print progress every 10 steps
        if step_count % 10 == 0:
            print(f"Step {step_count}: Life {info.get('playerLife', '?')}/{info.get('opponentLife', '?')}")

        if terminated or truncated:
            winner = "Player" if reward > 0 else "Opponent"
            print(f"\nGame over after {step_count} steps!")
            print(f"Winner: {winner}")
            print(f"Total reward: {total_reward}")
            break

    env.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
