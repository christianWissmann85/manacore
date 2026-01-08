"""
Action masking wrapper for compatibility with various RL libraries.
"""

from typing import Any

import gymnasium as gym
import numpy as np


class ActionMasker(gym.ActionWrapper):
    """
    Wrapper that provides action masking functionality.

    This wrapper is useful for libraries that don't natively support
    action masking. It automatically filters illegal actions.

    Example:
        >>> env = ActionMasker(ManaCoreBattleEnv())
        >>> obs, info = env.reset()
        >>> # action_space.sample() now only returns legal actions
        >>> action = env.action_space.sample()
    """

    def __init__(self, env: gym.Env):
        super().__init__(env)
        self._last_mask: np.ndarray = np.ones(env.action_space.n, dtype=bool)

    def reset(self, **kwargs: Any) -> tuple[np.ndarray, dict[str, Any]]:
        obs, info = self.env.reset(**kwargs)
        self._last_mask = info.get("action_mask", np.ones(self.action_space.n, dtype=bool))
        return obs, info

    def step(self, action: int) -> tuple[np.ndarray, float, bool, bool, dict[str, Any]]:
        # Ensure action is legal
        if not self._last_mask[action]:
            legal_actions = np.where(self._last_mask)[0]
            if len(legal_actions) > 0:
                action = int(legal_actions[0])

        obs, reward, terminated, truncated, info = self.env.step(action)
        self._last_mask = info.get("action_mask", np.ones(self.action_space.n, dtype=bool))
        return obs, reward, terminated, truncated, info

    def action(self, action: int) -> int:
        """Convert action if needed."""
        return action

    def action_masks(self) -> np.ndarray:
        """Get current action mask."""
        return self._last_mask.copy()

    def sample_legal_action(self) -> int:
        """Sample a random legal action."""
        legal_actions = np.where(self._last_mask)[0]
        if len(legal_actions) == 0:
            return 0
        return int(np.random.choice(legal_actions))
