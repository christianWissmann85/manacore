#!/usr/bin/env python3
"""
Test reward shaping in the ManaCore environment.

This script verifies that reward shaping is working and shows
the distribution of shaped rewards during gameplay.

Usage:
    uv run python examples/test_reward_shaping.py
"""

import numpy as np
from collections import defaultdict

import manacore_gym  # noqa: F401
from manacore_gym import ManaCoreBattleEnv


def test_reward_shaping(n_games: int = 20, opponent: str = "greedy") -> None:
    """Test and analyze reward shaping."""
    print("=" * 60)
    print("Reward Shaping Analysis")
    print("=" * 60)
    print(f"Games: {n_games}")
    print(f"Opponent: {opponent}")
    print("=" * 60)

    env = ManaCoreBattleEnv(opponent=opponent)

    all_rewards = []
    shaped_rewards = []
    terminal_rewards = []
    reward_by_step = defaultdict(list)

    wins = 0
    total_steps = 0

    for game in range(n_games):
        obs, info = env.reset()
        done = False
        step = 0
        game_rewards = []

        while not done and step < 500:
            # Take random action for testing
            action_mask = env.action_masks()
            legal_actions = np.where(action_mask)[0]
            action = np.random.choice(legal_actions)

            obs, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated
            step += 1

            game_rewards.append(reward)
            all_rewards.append(reward)
            reward_by_step[step].append(reward)

            # Check if this is a shaped reward (non-terminal, non-zero)
            if not done and reward != 0:
                shaped_rewards.append(reward)
            elif done:
                terminal_rewards.append(reward)

        total_steps += step
        if reward > 0:
            wins += 1

        if (game + 1) % 5 == 0:
            print(f"  Game {game + 1}: {step} steps, final reward: {reward:.3f}")

    env.close()

    # Analysis
    print("\n" + "=" * 60)
    print("REWARD DISTRIBUTION")
    print("=" * 60)

    all_rewards = np.array(all_rewards)
    print(f"Total reward samples: {len(all_rewards)}")
    print(f"Mean reward: {np.mean(all_rewards):.4f}")
    print(f"Std reward: {np.std(all_rewards):.4f}")
    print(f"Min reward: {np.min(all_rewards):.4f}")
    print(f"Max reward: {np.max(all_rewards):.4f}")

    print(f"\nShaped (non-terminal) rewards: {len(shaped_rewards)}")
    if shaped_rewards:
        shaped_rewards = np.array(shaped_rewards)
        print(f"  Mean: {np.mean(shaped_rewards):.4f}")
        print(f"  Std: {np.std(shaped_rewards):.4f}")
        print(f"  Range: [{np.min(shaped_rewards):.4f}, {np.max(shaped_rewards):.4f}]")

        # Distribution of shaped rewards
        positive = np.sum(shaped_rewards > 0)
        negative = np.sum(shaped_rewards < 0)
        zero = np.sum(shaped_rewards == 0)
        print(f"  Positive: {positive} ({positive/len(shaped_rewards)*100:.1f}%)")
        print(f"  Negative: {negative} ({negative/len(shaped_rewards)*100:.1f}%)")
        print(f"  Zero: {zero} ({zero/len(shaped_rewards)*100:.1f}%)")
    else:
        print("  NO SHAPED REWARDS DETECTED!")
        print("  Reward shaping may be disabled or not working.")

    print(f"\nTerminal rewards: {len(terminal_rewards)}")
    if terminal_rewards:
        terminal_rewards = np.array(terminal_rewards)
        wins_terminal = np.sum(terminal_rewards > 0)
        losses_terminal = np.sum(terminal_rewards < 0)
        print(f"  Wins (+1): {wins_terminal}")
        print(f"  Losses (-1): {losses_terminal}")

    print("\n" + "=" * 60)
    print("GAME STATISTICS")
    print("=" * 60)
    print(f"Win rate: {wins}/{n_games} ({wins/n_games*100:.1f}%)")
    print(f"Avg steps per game: {total_steps/n_games:.1f}")

    # Conclusion
    print("\n" + "=" * 60)
    print("CONCLUSION")
    print("=" * 60)
    if len(shaped_rewards) > 0:
        print("Reward shaping IS ACTIVE")
        print(f"Average shaped reward magnitude: {np.mean(np.abs(shaped_rewards)):.4f}")
    else:
        print("Reward shaping appears to be DISABLED or returning only zeros")
        print("All experiments so far used sparse rewards only!")


if __name__ == "__main__":
    test_reward_shaping()
