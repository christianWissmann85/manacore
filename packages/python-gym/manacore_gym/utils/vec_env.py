"""
Vectorized environment utilities for parallel training.

This module provides helpers for creating multiple environments
that can run in parallel, significantly speeding up training.
"""

from typing import Any, Callable, Optional

import gymnasium as gym

from ..env import ManaCoreBattleEnv


def make_env(
    opponent: str = "greedy",
    deck: str = "random",
    opponent_deck: str = "random",
    seed: Optional[int] = None,
    server_url: str = "http://localhost:3333",
    auto_start_server: bool = True,
    rank: int = 0,
) -> Callable[[], ManaCoreBattleEnv]:
    """
    Create a factory function for environment instances.

    This is used with vectorized environments where each subprocess
    needs to create its own environment instance.

    Args:
        opponent: Bot type to play against
        deck: Player deck
        opponent_deck: Opponent deck
        seed: Base random seed (will be offset by rank)
        server_url: URL of the gym server
        auto_start_server: Whether to auto-start server
        rank: Environment rank (for seed offset)

    Returns:
        A callable that creates and returns the environment
    """

    def _init() -> ManaCoreBattleEnv:
        env = ManaCoreBattleEnv(
            opponent=opponent,
            deck=deck,
            opponent_deck=opponent_deck,
            server_url=server_url,
            auto_start_server=auto_start_server,
        )
        if seed is not None:
            env.reset(seed=seed + rank)
        return env

    return _init


def make_vec_env(
    n_envs: int = 4,
    opponent: str = "greedy",
    deck: str = "random",
    opponent_deck: str = "random",
    seed: Optional[int] = None,
    server_url: str = "http://localhost:3333",
    auto_start_server: bool = True,
    vec_env_cls: str = "dummy",
) -> Any:
    """
    Create a vectorized environment with multiple parallel instances.

    This enables faster training by running multiple games simultaneously.
    Note: Each environment connects to the same server, which handles
    multiple game sessions internally.

    Args:
        n_envs: Number of parallel environments (default: 4)
        opponent: Bot type to play against
        deck: Player deck
        opponent_deck: Opponent deck
        seed: Base random seed (each env gets seed + rank)
        server_url: URL of the gym server
        auto_start_server: Whether to auto-start server (only first env should)
        vec_env_cls: Type of vectorized env ("dummy" or "subproc")
            - "dummy": DummyVecEnv - runs sequentially, good for debugging
            - "subproc": SubprocVecEnv - true parallel, better performance

    Returns:
        A vectorized environment (DummyVecEnv or SubprocVecEnv)

    Example:
        >>> from manacore_gym import make_vec_env
        >>> vec_env = make_vec_env(n_envs=8, opponent="greedy")
        >>> # Use with SB3
        >>> from sb3_contrib import MaskablePPO
        >>> model = MaskablePPO("MlpPolicy", vec_env, verbose=1)
        >>> model.learn(total_timesteps=100_000)
    """
    try:
        from stable_baselines3.common.vec_env import DummyVecEnv, SubprocVecEnv
    except ImportError as e:
        raise ImportError("stable-baselines3 is required for vectorized environments. Install with: pip install stable-baselines3") from e

    # Create environment factories
    env_fns = [
        make_env(
            opponent=opponent,
            deck=deck,
            opponent_deck=opponent_deck,
            seed=seed,
            server_url=server_url,
            auto_start_server=auto_start_server if i == 0 else False,  # Only first env starts server
            rank=i,
        )
        for i in range(n_envs)
    ]

    # Create vectorized environment
    if vec_env_cls == "subproc":
        return SubprocVecEnv(env_fns)  # type: ignore[arg-type]
    else:
        return DummyVecEnv(env_fns)  # type: ignore[arg-type]


def make_masked_vec_env(
    n_envs: int = 4,
    opponent: str = "greedy",
    deck: str = "random",
    opponent_deck: str = "random",
    seed: Optional[int] = None,
    server_url: str = "http://localhost:3333",
    auto_start_server: bool = True,
    vec_env_cls: str = "dummy",
) -> Any:
    """
    Create a vectorized environment with action masking support.

    This wraps each environment with ActionMasker for use with
    MaskablePPO from sb3-contrib.

    Args:
        n_envs: Number of parallel environments
        opponent: Bot type to play against
        deck: Player deck
        opponent_deck: Opponent deck
        seed: Base random seed
        server_url: URL of the gym server
        auto_start_server: Whether to auto-start server
        vec_env_cls: Type of vectorized env ("dummy" or "subproc")

    Returns:
        A vectorized environment with action masking

    Example:
        >>> from manacore_gym import make_masked_vec_env
        >>> vec_env = make_masked_vec_env(n_envs=8, opponent="greedy")
        >>> from sb3_contrib import MaskablePPO
        >>> model = MaskablePPO("MlpPolicy", vec_env, verbose=1)
        >>> model.learn(total_timesteps=100_000)
    """
    try:
        from sb3_contrib.common.wrappers import ActionMasker
        from stable_baselines3.common.vec_env import DummyVecEnv, SubprocVecEnv
    except ImportError as e:
        raise ImportError("sb3-contrib is required for masked vectorized environments. Install with: pip install sb3-contrib") from e

    import numpy as np

    def mask_fn(env: ManaCoreBattleEnv) -> np.ndarray:
        return env.action_masks()

    def make_masked_env(rank: int) -> Callable[[], Any]:
        def _init() -> Any:
            env = ManaCoreBattleEnv(
                opponent=opponent,
                deck=deck,
                opponent_deck=opponent_deck,
                server_url=server_url,
                auto_start_server=auto_start_server if rank == 0 else False,
            )
            if seed is not None:
                env.reset(seed=seed + rank)
            return ActionMasker(env, mask_fn)  # type: ignore[arg-type]

        return _init

    env_fns = [make_masked_env(i) for i in range(n_envs)]

    if vec_env_cls == "subproc":
        return SubprocVecEnv(env_fns)
    else:
        return DummyVecEnv(env_fns)


def make_parallel_env(
    env_factory: Callable[[], gym.Env],
    n_envs: int = 8,
    vec_env_cls: str = "subproc",
) -> Any:
    """
    Create parallel environments from a factory function.

    This is a generic utility for parallelizing any environment,
    including custom wrapped environments like SelfPlayEnv.

    Args:
        env_factory: Callable that creates a gym.Env instance
        n_envs: Number of parallel environments (default: 8)
        vec_env_cls: "subproc" for parallel or "dummy" for sequential

    Returns:
        SubprocVecEnv or DummyVecEnv

    Example:
        >>> def make_my_env():
        ...     env = ManaCoreBattleEnv(opponent="greedy")
        ...     env = ActionMasker(env, lambda e: e.action_masks())
        ...     return env
        >>> vec_env = make_parallel_env(make_my_env, n_envs=8)
    """
    try:
        from stable_baselines3.common.vec_env import DummyVecEnv, SubprocVecEnv
    except ImportError as e:
        raise ImportError(
            "stable-baselines3 is required. Install with: pip install stable-baselines3"
        ) from e

    env_fns = [env_factory for _ in range(n_envs)]

    if vec_env_cls == "subproc":
        return SubprocVecEnv(env_fns)
    else:
        return DummyVecEnv(env_fns)
