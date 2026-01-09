"""
Tests for the ManaCore Gymnasium environment.
"""

import numpy as np
import pytest


def test_import() -> None:
    """Test that the package can be imported."""
    import manacore_gym

    assert manacore_gym.__version__ == "0.1.0"


def test_env_creation(shared_server) -> None:
    """Test environment creation."""
    from manacore_gym import ManaCoreBattleEnv

    env = ManaCoreBattleEnv(opponent="greedy", auto_start_server=False)
    assert env is not None
    env.close()


def test_env_reset(shared_server) -> None:
    """Test environment reset."""
    from manacore_gym import ManaCoreBattleEnv

    env = ManaCoreBattleEnv(opponent="greedy", auto_start_server=False)
    obs, info = env.reset(seed=42)

    # Check observation shape
    assert obs.shape == (36,)
    assert obs.dtype == np.float32

    # Check info contains action mask
    assert "action_mask" in info
    assert len(info["action_mask"]) == 200

    env.close()


def test_env_step(shared_server) -> None:
    """Test environment step."""
    from manacore_gym import ManaCoreBattleEnv

    env = ManaCoreBattleEnv(opponent="greedy", auto_start_server=False)
    obs, info = env.reset(seed=42)

    # Get a legal action
    mask = info["action_mask"]
    legal_actions = np.where(mask)[0]
    assert len(legal_actions) > 0

    action = legal_actions[0]
    obs, reward, terminated, truncated, info = env.step(action)

    # Check outputs
    assert obs.shape == (36,)
    assert isinstance(reward, (int, float))
    assert isinstance(terminated, bool)
    assert isinstance(truncated, bool)
    assert "action_mask" in info

    env.close()


def test_action_masks(shared_server) -> None:
    """Test action masking."""
    from manacore_gym import ManaCoreBattleEnv

    env = ManaCoreBattleEnv(opponent="greedy", auto_start_server=False)
    obs, info = env.reset(seed=42)

    mask = env.action_masks()
    assert mask.shape == (200,)
    assert mask.dtype == bool
    assert np.any(mask)  # At least one legal action

    env.close()


def test_gymnasium_registration(shared_server) -> None:
    """Test that environment is registered with Gymnasium."""
    import gymnasium as gym

    import manacore_gym  # noqa: F401

    env = gym.make("ManaCore-v0", opponent="random", auto_start_server=False)
    assert env is not None
    env.close()


def test_full_game(shared_server) -> None:
    """Test playing a complete game."""
    from manacore_gym import ManaCoreBattleEnv

    env = ManaCoreBattleEnv(opponent="random", auto_start_server=False)
    obs, info = env.reset(seed=12345)

    total_reward = 0
    max_steps = 300
    step_count = 0

    while step_count < max_steps:
        mask = env.action_masks()
        legal_actions = np.where(mask)[0]

        if len(legal_actions) == 0:
            break

        action = legal_actions[0]
        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward  # type: ignore[operator]
        step_count += 1

        if terminated or truncated:
            break

    # Game should end eventually
    assert terminated or truncated or step_count >= max_steps
    # Check reward is close to -1.0 (loss), 0.0 (draw), or 1.0 (win)
    # Allow for small deviation due to reward shaping (e.g., time penalties)
    assert -1.5 <= total_reward <= 1.5
    assert abs(round(total_reward) - total_reward) < 0.1 or abs(total_reward) < 0.1

    env.close()


def test_determinism(shared_server) -> None:
    """Test that same seed produces same game."""
    from manacore_gym import ManaCoreBattleEnv

    env = ManaCoreBattleEnv(opponent="greedy", auto_start_server=False)

    # First run
    obs1, info1 = env.reset(seed=42)
    mask1 = info1["action_mask"].copy()

    # Second run with same seed
    obs2, info2 = env.reset(seed=42)
    mask2 = info2["action_mask"].copy()

    # Should be identical
    np.testing.assert_array_equal(obs1, obs2)
    np.testing.assert_array_equal(mask1, mask2)

    env.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
