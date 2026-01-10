"""
ManaCore Gym - Gymnasium environment for Magic: The Gathering AI research.

This package provides a Gymnasium-compatible environment for training
reinforcement learning agents on Magic: The Gathering.

Quick Start:
    >>> import gymnasium as gym
    >>> import manacore_gym
    >>>
    >>> env = gym.make("ManaCore-v0", opponent="greedy")
    >>> obs, info = env.reset()
    >>> action = env.action_space.sample()
    >>> obs, reward, terminated, truncated, info = env.step(action)

For training with Stable Baselines3:
    >>> from sb3_contrib import MaskablePPO
    >>> from manacore_gym import ManaCoreBattleEnv
    >>>
    >>> env = ManaCoreBattleEnv(opponent="greedy")
    >>> model = MaskablePPO("MlpPolicy", env, verbose=1)
    >>> model.learn(total_timesteps=100_000)
"""

__version__ = "0.1.0"

from typing import Any

from gymnasium.envs.registration import register

from .bridge import BunBridge
from .env import ManaCoreBattleEnv
from .selfplay import SelfPlayEnv
from .utils import make_env, make_masked_vec_env, make_parallel_env, make_vec_env


# Training utilities (lazy import to avoid sb3 dependency when not needed)
def __getattr__(name: str) -> Any:
    if name in ("CurriculumScheduler", "CurriculumStage", "STANDARD_CURRICULUM", "FAST_CURRICULUM"):
        from .training import FAST_CURRICULUM, STANDARD_CURRICULUM, CurriculumScheduler, CurriculumStage  # noqa: F401
        return locals()[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

# Register the environment with Gymnasium
register(
    id="ManaCore-v0",
    entry_point="manacore_gym:ManaCoreBattleEnv",
    max_episode_steps=500,
)

__all__ = [
    "ManaCoreBattleEnv",
    "SelfPlayEnv",
    "BunBridge",
    "make_env",
    "make_vec_env",
    "make_masked_vec_env",
    "make_parallel_env",
    "analysis",
    "__version__",
]
