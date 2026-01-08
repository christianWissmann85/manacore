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

from gymnasium.envs.registration import register

from .bridge import BunBridge
from .env import ManaCoreBattleEnv
from .utils import make_env, make_masked_vec_env, make_vec_env

# Register the environment with Gymnasium
register(
    id="ManaCore-v0",
    entry_point="manacore_gym:ManaCoreBattleEnv",
    max_episode_steps=500,
)

__all__ = [
    "ManaCoreBattleEnv",
    "BunBridge",
    "make_env",
    "make_vec_env",
    "make_masked_vec_env",
    "__version__",
]
