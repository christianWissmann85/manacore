"""
Self-Play Environment for ManaCore.

This module provides a self-play environment where the agent plays
against past versions of itself (historical self-play) with support
for mixed opponent pools including server-side bots (greedy, random).
"""

import os
import random
from pathlib import Path
from typing import Any, Optional, SupportsFloat

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from .bridge import BunBridge


class SelfPlayEnv(gym.Env):
    """
    Self-Play environment for ManaCore with mixed opponent support.

    The agent plays against a mix of opponents:
    - Past checkpoints of itself (historical self-play)
    - Current policy (for stability)
    - Server-side greedy bot (for exploitation skills)
    - Random actions (for exploration)

    Key features:
    - Maintains a pool of checkpoint paths
    - Supports mixed opponent distribution
    - Falls back gracefully when pool is empty
    - Automatic opponent type switching per game

    Args:
        checkpoint_dir: Directory to store/load checkpoints
        pool_size: Maximum number of checkpoints to keep in pool
        checkpoint_weight: Probability of playing against checkpoint (0-1)
        greedy_weight: Probability of playing against greedy bot (0-1)
        current_weight: Probability of playing against current policy (0-1)
        random_weight: Probability of playing against random (0-1)
        deck: Player deck name
        opponent_deck: Opponent deck name
        server_url: URL of the gym server
        auto_start_server: Whether to auto-start server if not running

    Note:
        Weights are normalized internally, so they don't need to sum to 1.
        When checkpoint pool is empty, checkpoint_weight is redistributed
        to other opponent types proportionally.

    Example:
        >>> env = SelfPlayEnv(
        ...     checkpoint_dir="./checkpoints",
        ...     checkpoint_weight=0.3,
        ...     greedy_weight=0.3,
        ...     current_weight=0.2,
        ...     random_weight=0.2,
        ... )
        >>> model = MaskablePPO("MlpPolicy", env)
        >>> model.save("./checkpoints/checkpoint_1")
        >>> env.add_checkpoint("./checkpoints/checkpoint_1.zip")
    """

    metadata = {"render_modes": ["human"], "render_fps": 1}

    OBSERVATION_SIZE = 36
    MAX_ACTIONS = 200

    def __init__(
        self,
        checkpoint_dir: str = "./checkpoints",
        pool_size: int = 20,
        checkpoint_weight: float = 0.3,
        greedy_weight: float = 0.3,
        current_weight: float = 0.2,
        random_weight: float = 0.2,
        deck: str = "random",
        opponent_deck: str = "random",
        server_url: str = "http://localhost:3333",
        auto_start_server: bool = True,
    ):
        super().__init__()

        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)

        self.pool_size = pool_size
        self.checkpoint_weight = checkpoint_weight
        self.greedy_weight = greedy_weight
        self.current_weight = current_weight
        self.random_weight = random_weight
        self.deck = deck
        self.opponent_deck = opponent_deck

        # Checkpoint pool (list of paths)
        self.checkpoint_pool: list[str] = []
        self._current_opponent_model: Optional[Any] = None
        self._current_opponent_type: str = "random"  # "checkpoint", "current", "greedy", or "random"
        self._use_server_opponent: bool = False  # True when using greedy (server handles opponent)

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

        self.bridge = BunBridge(
            host=host,
            port=port,
            auto_start=auto_start_server,
        )

        # Define spaces
        self.observation_space = spaces.Box(
            low=-1.0,
            high=2.0,
            shape=(self.OBSERVATION_SIZE,),
            dtype=np.float32,
        )
        self.action_space = spaces.Discrete(self.MAX_ACTIONS)

        # Game state
        self._game_id: Optional[str] = None
        self._current_state: Optional[dict[str, Any]] = None
        self._legal_action_mask: np.ndarray = np.zeros(self.MAX_ACTIONS, dtype=bool)
        self._num_legal_actions: int = 0

        # Reference to current training model (set externally)
        self._current_model: Optional[Any] = None

    def set_current_model(self, model: Any) -> None:
        """Set reference to the current training model for self-play."""
        self._current_model = model

    def add_checkpoint(self, checkpoint_path: str) -> None:
        """
        Add a checkpoint to the pool.

        If pool is full, removes the oldest checkpoint.
        """
        if not os.path.exists(checkpoint_path):
            print(f"[SelfPlayEnv] Warning: Checkpoint not found: {checkpoint_path}")
            return

        self.checkpoint_pool.append(checkpoint_path)

        # Remove oldest if over limit
        while len(self.checkpoint_pool) > self.pool_size:
            removed = self.checkpoint_pool.pop(0)
            print(f"[SelfPlayEnv] Removed old checkpoint: {removed}")

        print(f"[SelfPlayEnv] Added checkpoint: {checkpoint_path} (pool size: {len(self.checkpoint_pool)})")

    def get_checkpoint_pool_size(self) -> int:
        """Get the current size of the checkpoint pool."""
        return len(self.checkpoint_pool)

    def _select_opponent(self) -> None:
        """Select an opponent for this game using weighted random selection."""
        try:
            from sb3_contrib import MaskablePPO
        except ImportError:
            # Fall back to greedy if sb3-contrib not available
            self._current_opponent_model = None
            self._current_opponent_type = "greedy"
            self._use_server_opponent = True
            return

        # Build weight distribution based on available options
        weights = {
            "checkpoint": self.checkpoint_weight if len(self.checkpoint_pool) > 0 else 0,
            "greedy": self.greedy_weight,
            "current": self.current_weight if self._current_model is not None else 0,
            "random": self.random_weight,
        }

        # Normalize weights
        total = sum(weights.values())
        if total == 0:
            # Fallback to greedy if everything is zero
            self._current_opponent_model = None
            self._current_opponent_type = "greedy"
            self._use_server_opponent = True
            return

        # Weighted random selection
        roll = random.random() * total
        cumulative = 0.0

        for opponent_type, weight in weights.items():
            cumulative += weight
            if roll < cumulative:
                if opponent_type == "checkpoint":
                    checkpoint_path = random.choice(self.checkpoint_pool)
                    try:
                        self._current_opponent_model = MaskablePPO.load(checkpoint_path)
                        self._current_opponent_type = "checkpoint"
                        self._use_server_opponent = False
                    except Exception as e:
                        print(f"[SelfPlayEnv] Failed to load checkpoint {checkpoint_path}: {e}")
                        # Fallback to greedy on load failure
                        self._current_opponent_model = None
                        self._current_opponent_type = "greedy"
                        self._use_server_opponent = True
                elif opponent_type == "greedy":
                    self._current_opponent_model = None
                    self._current_opponent_type = "greedy"
                    self._use_server_opponent = True
                elif opponent_type == "current":
                    self._current_opponent_model = self._current_model
                    self._current_opponent_type = "current"
                    self._use_server_opponent = False
                else:  # random
                    self._current_opponent_model = None
                    self._current_opponent_type = "random"
                    self._use_server_opponent = False
                return

        # Fallback (shouldn't reach here)
        self._current_opponent_model = None
        self._current_opponent_type = "greedy"
        self._use_server_opponent = True

    def _get_opponent_action(self, opponent_mask: np.ndarray) -> int:
        """Get action from the current opponent."""
        if self._current_opponent_model is None:
            # Random action
            legal_actions = np.where(opponent_mask)[0]
            if len(legal_actions) == 0:
                return 0
            return int(np.random.choice(legal_actions))

        # Use the opponent model
        obs = self._get_observation()
        # Note: observation is from player perspective, but we use it anyway
        # In true self-play, both see the same features but from different perspectives
        # This is a simplification that works for symmetric games
        action, _ = self._current_opponent_model.predict(
            obs, action_masks=opponent_mask, deterministic=False
        )
        return int(action)

    def reset(
        self,
        *,
        seed: Optional[int] = None,
        options: Optional[dict[str, Any]] = None,
    ) -> tuple[np.ndarray, dict[str, Any]]:
        """Reset the environment and select a new opponent."""
        super().reset(seed=seed)

        # Select opponent for this game
        self._select_opponent()

        # Determine opponent type for server
        # - "greedy" for server-side greedy bot
        # - "external" for Python-controlled opponents (checkpoint, current, random)
        server_opponent = "greedy" if self._use_server_opponent else "external"

        # Always create a new game to ensure correct opponent type
        # (opponent type can change between games)
        if self._game_id is not None:
            # Delete old game first
            import contextlib
            with contextlib.suppress(Exception):
                self.bridge.delete_game(self._game_id)
            self._game_id = None

        response = self.bridge.create_game(
            opponent=server_opponent,
            deck=self.deck,
            opponent_deck=self.opponent_deck,
            seed=seed,
        )
        self._game_id = response["gameId"]

        self._update_state(response)

        # Handle case where opponent moves first (only for external opponents)
        if not self._use_server_opponent:
            self._handle_opponent_priority()

        return self._get_observation(), self._get_info()

    def _handle_opponent_priority(self) -> None:
        """If opponent has priority, make their moves."""
        if self._current_state is None:
            return

        info = self._current_state.get("info", {})
        priority = info.get("priorityPlayer", "player")

        while priority == "opponent" and not self._current_state.get("done", False):
            # Get opponent's legal actions
            assert self._game_id is not None
            opp_response = self.bridge.get_opponent_actions(self._game_id)
            opp_mask = np.array(opp_response["actionMask"], dtype=bool)

            if not np.any(opp_mask):
                break

            # Get opponent's action
            opp_action = self._get_opponent_action(opp_mask)

            # Execute opponent's action
            response = self.bridge.opponent_step(self._game_id, opp_action)
            self._update_state(response)

            info = self._current_state.get("info", {})
            priority = info.get("priorityPlayer", "player")

        # After opponent is done, refresh player's action mask
        if not self._current_state.get("done", False):
            assert self._game_id is not None
            player_response = self.bridge.get_actions(self._game_id)
            self._legal_action_mask = np.array(player_response.get("actionMask", np.zeros(self.MAX_ACTIONS)), dtype=bool)
            self._num_legal_actions = int(np.sum(self._legal_action_mask))

    def step(self, action: int) -> tuple[np.ndarray, SupportsFloat, bool, bool, dict[str, Any]]:
        """Take a player action and handle opponent response."""
        if self._game_id is None:
            raise RuntimeError("Environment not initialized. Call reset() first.")

        # Validate action
        if not self._legal_action_mask[action]:
            legal_actions = np.where(self._legal_action_mask)[0]
            if len(legal_actions) == 0:
                return (
                    self._get_observation(),
                    -1.0,
                    True,
                    False,
                    self._get_info(),
                )
            action = int(legal_actions[0])

        # Execute player action
        response = self.bridge.step(self._game_id, action)
        self._update_state(response)

        # Handle opponent moves (only for external/Python-controlled opponents)
        # For server-side opponents (greedy), the server already handled opponent moves
        if not response.get("done", False) and not self._use_server_opponent:
            self._handle_opponent_priority()

        observation = self._get_observation()
        reward = float(self._current_state.get("reward", 0) if self._current_state else 0)
        terminated = bool(self._current_state.get("done", False) if self._current_state else False)
        truncated = bool(self._current_state.get("truncated", False) if self._current_state else False)
        info = self._get_info()

        return observation, reward, terminated, truncated, info

    def _update_state(self, response: dict[str, Any]) -> None:
        """Update internal state from server response."""
        self._current_state = response
        self._legal_action_mask = np.array(response.get("actionMask", np.zeros(self.MAX_ACTIONS)), dtype=bool)
        self._num_legal_actions = int(np.sum(self._legal_action_mask))

    def _get_observation(self) -> np.ndarray:
        """Get the current observation."""
        if self._current_state is None:
            return np.zeros(self.OBSERVATION_SIZE, dtype=np.float32)

        features = self._current_state.get("observation", {}).get("features", [])
        if not features:
            return np.zeros(self.OBSERVATION_SIZE, dtype=np.float32)

        obs = np.array(features, dtype=np.float32)
        obs = np.nan_to_num(obs, nan=0.0, posinf=2.0, neginf=-1.0)
        obs = np.clip(obs, -1.0, 2.0)
        return obs

    def _get_info(self) -> dict[str, Any]:
        """Get info dict."""
        if self._current_state is None:
            return {"action_mask": self._legal_action_mask, "opponent_type": self._current_opponent_type}

        info = dict(self._current_state.get("info", {}))
        info["action_mask"] = self._legal_action_mask
        info["num_legal_actions"] = self._num_legal_actions
        info["opponent_type"] = self._current_opponent_type
        info["checkpoint_pool_size"] = len(self.checkpoint_pool)
        return info

    def action_masks(self) -> np.ndarray:
        """Get action mask for SB3's MaskablePPO."""
        return self._legal_action_mask.copy()

    def close(self) -> None:
        """Clean up resources."""
        if self._game_id is not None:
            import contextlib
            with contextlib.suppress(Exception):
                self.bridge.delete_game(self._game_id)
            self._game_id = None

    def render(self) -> None:
        """Render the current state."""
        if self._current_state is None:
            print("No game in progress")
            return

        info = self._current_state.get("info", {})
        print(f"\n=== Turn {info.get('turn', '?')} - {info.get('phase', '?')} ===")
        print(f"Opponent: {self._current_opponent_type}")
        print(f"Legal Actions: {self._num_legal_actions}")
