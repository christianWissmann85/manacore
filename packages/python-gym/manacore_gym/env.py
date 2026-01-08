"""
ManaCore Gymnasium Environment.

This module provides a Gymnasium-compatible environment for training
reinforcement learning agents on Magic: The Gathering.
"""

import contextlib
from typing import Any, Optional, SupportsFloat

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from .bridge import BunBridge


class ManaCoreBattleEnv(gym.Env):
    """
    Gymnasium environment for ManaCore battles.

    This environment allows training RL agents to play Magic: The Gathering
    against various bot opponents.

    Observation Space:
        Box(25,) - 25 normalized features representing the game state:
        - Life totals (player, opponent, delta)
        - Board state (creature counts, power, toughness)
        - Card advantage (hand sizes, library sizes)
        - Mana availability (lands, untapped)
        - Game state (turn, phase, combat)

    Action Space:
        Discrete(200) - Action index into legal actions
        Use action_masks() to get valid actions

    Reward:
        +1.0 for winning
        -1.0 for losing
        0.0 for ongoing game

    Args:
        opponent: Bot type ("random", "greedy", "mcts", "mcts-fast", "mcts-strong")
        deck: Player deck name or "random"
        opponent_deck: Opponent deck name or "random"
        server_url: URL of the gym server (default: http://localhost:3333)
        auto_start_server: Whether to auto-start server if not running
        render_mode: Rendering mode (None or "human")

    Example:
        >>> env = ManaCoreBattleEnv(opponent="greedy")
        >>> obs, info = env.reset()
        >>> while True:
        ...     # Get legal actions
        ...     mask = env.action_masks()
        ...     legal_actions = np.where(mask)[0]
        ...     action = np.random.choice(legal_actions)
        ...     obs, reward, terminated, truncated, info = env.step(action)
        ...     if terminated or truncated:
        ...         break
    """

    metadata = {"render_modes": ["human"], "render_fps": 1}

    # Constants
    OBSERVATION_SIZE = 25
    MAX_ACTIONS = 200

    def __init__(
        self,
        opponent: str = "greedy",
        deck: str = "random",
        opponent_deck: str = "random",
        server_url: str = "http://localhost:3333",
        auto_start_server: bool = True,
        render_mode: Optional[str] = None,
    ):
        super().__init__()

        self.opponent = opponent
        self.deck = deck
        self.opponent_deck = opponent_deck
        self.render_mode = render_mode

        # Parse server URL
        if "://" in server_url:
            _, rest = server_url.split("://", 1)
            if ":" in rest:
                host, port_str = rest.split(":", 1)
                port = int(port_str)
            else:
                host = rest
                port = 3333
        else:
            host = "localhost"
            port = 3333

        # Create bridge to server
        self.bridge = BunBridge(
            host=host,
            port=port,
            auto_start=auto_start_server,
        )

        # Define spaces
        self.observation_space = spaces.Box(
            low=-1.0,
            high=1.0,
            shape=(self.OBSERVATION_SIZE,),
            dtype=np.float32,
        )

        self.action_space = spaces.Discrete(self.MAX_ACTIONS)

        # Game state
        self._game_id: Optional[str] = None
        self._current_state: Optional[dict[str, Any]] = None
        self._legal_action_mask: np.ndarray = np.zeros(self.MAX_ACTIONS, dtype=bool)
        self._num_legal_actions: int = 0

    def reset(
        self,
        *,
        seed: Optional[int] = None,
        options: Optional[dict[str, Any]] = None,
    ) -> tuple[np.ndarray, dict[str, Any]]:
        """
        Reset the environment to initial state.

        Args:
            seed: Random seed for reproducibility
            options: Additional options (unused)

        Returns:
            observation: Initial observation
            info: Additional information including action_mask
        """
        super().reset(seed=seed)

        # Create new game or reset existing
        if self._game_id is None:
            response = self.bridge.create_game(
                opponent=self.opponent,
                deck=self.deck,
                opponent_deck=self.opponent_deck,
                seed=seed,
            )
            self._game_id = response["gameId"]
        else:
            response = self.bridge.reset(self._game_id, seed=seed)

        self._update_state(response)

        return self._get_observation(), self._get_info()

    def step(self, action: int) -> tuple[np.ndarray, SupportsFloat, bool, bool, dict[str, Any]]:
        """
        Take an action in the environment.

        Args:
            action: Action index (must be a legal action)

        Returns:
            observation: New observation
            reward: Reward for this step (+1 win, -1 loss, 0 ongoing)
            terminated: Whether the game ended naturally
            truncated: Whether the game was cut short (max steps)
            info: Additional information
        """
        if self._game_id is None:
            raise RuntimeError("Environment not initialized. Call reset() first.")

        # Validate action
        if not self._legal_action_mask[action]:
            # Find nearest legal action (fallback)
            legal_actions = np.where(self._legal_action_mask)[0]
            if len(legal_actions) == 0:
                # No legal actions - game may be over, return terminal state
                return (
                    self._get_observation(),
                    -1.0,  # Treat as loss since we can't act
                    True,  # terminated
                    False,  # truncated
                    self._get_info(),
                )
            action = int(legal_actions[0])

        response = self.bridge.step(self._game_id, action)
        self._update_state(response)

        observation = self._get_observation()
        reward = float(response["reward"])
        terminated = bool(response["done"])
        truncated = bool(response["truncated"])
        info = self._get_info()

        if self.render_mode == "human":
            self.render()

        return observation, reward, terminated, truncated, info

    def _update_state(self, response: dict[str, Any]) -> None:
        """Update internal state from server response."""
        self._current_state = response
        self._legal_action_mask = np.array(response["actionMask"], dtype=bool)
        self._num_legal_actions = len(response.get("legalActions", []))

    def _get_observation(self) -> np.ndarray:
        """Get the current observation as a numpy array."""
        if self._current_state is None:
            return np.zeros(self.OBSERVATION_SIZE, dtype=np.float32)

        features = self._current_state["observation"]["features"]
        obs = np.array(features, dtype=np.float32)

        # Replace NaN/Inf with zeros for numerical stability
        obs = np.nan_to_num(obs, nan=0.0, posinf=1.0, neginf=-1.0)

        # Clip to observation space bounds
        obs = np.clip(obs, -1.0, 1.0)

        return obs

    def _get_info(self) -> dict[str, Any]:
        """Get additional information about the current state."""
        if self._current_state is None:
            return {"action_mask": self._legal_action_mask}

        info = dict(self._current_state.get("info", {}))
        info["action_mask"] = self._legal_action_mask
        info["num_legal_actions"] = self._num_legal_actions
        info["legal_actions"] = self._current_state.get("legalActions", [])
        return info

    def action_masks(self) -> np.ndarray:
        """
        Get the action mask for the current state.

        Returns:
            Boolean array where True indicates a legal action.
            This is used by SB3's MaskablePPO.
        """
        return self._legal_action_mask.copy()

    def render(self) -> None:
        """Render the current game state."""
        if self._current_state is None:
            print("No game in progress")
            return

        info = self._current_state.get("info", {})
        print(f"\n=== Turn {info.get('turn', '?')} - {info.get('phase', '?')} ===")
        print(f"Player Life: {info.get('playerLife', '?')}")
        print(f"Opponent Life: {info.get('opponentLife', '?')}")
        print(f"Legal Actions: {self._num_legal_actions}")

        if info.get("winner"):
            print(f"Winner: {info['winner']}")

    def close(self) -> None:
        """Clean up resources."""
        if self._game_id is not None:
            with contextlib.suppress(Exception):
                self.bridge.delete_game(self._game_id)
            self._game_id = None

        # Don't close bridge here - let garbage collection handle it
        # This allows multiple envs to share the same server

    def get_legal_action_descriptions(self) -> list[str]:
        """Get human-readable descriptions of legal actions."""
        if self._current_state is None:
            return []
        return [a["description"] for a in self._current_state.get("legalActions", [])]


def make_env(
    opponent: str = "greedy",
    deck: str = "random",
    opponent_deck: str = "random",
    seed: Optional[int] = None,
) -> ManaCoreBattleEnv:
    """
    Factory function to create a ManaCore environment.

    Args:
        opponent: Bot type
        deck: Player deck
        opponent_deck: Opponent deck
        seed: Random seed

    Returns:
        Configured ManaCoreBattleEnv
    """
    env = ManaCoreBattleEnv(
        opponent=opponent,
        deck=deck,
        opponent_deck=opponent_deck,
    )
    if seed is not None:
        env.reset(seed=seed)
    return env
