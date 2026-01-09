"""
Bridge client for connecting to the ManaCore Gym server.

This module handles communication with the Bun-based HTTP server
that exposes the ManaCore game engine.
"""

import contextlib
import os
import signal
import subprocess
import time
from pathlib import Path
from typing import Any, Optional

import requests  # type: ignore[import-untyped]


class BunBridge:
    """
    Bridge to the Bun server running the ManaCore engine.

    This class manages the connection to the game server and provides
    methods to create games, step through them, and reset.

    Args:
        host: Server hostname (default: "localhost")
        port: Server port (default: 3333)
        auto_start: Whether to automatically start the server if not running
        server_path: Path to the gym-server package (auto-detected if None)
        timeout: Request timeout in seconds
        max_retries: Maximum connection retries

    Example:
        >>> bridge = BunBridge(auto_start=True)
        >>> game = bridge.create_game(opponent="greedy")
        >>> result = bridge.step(game["gameId"], action=0)
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 3333,
        auto_start: bool = True,
        server_path: Optional[str] = None,
        timeout: float = 30.0,
        max_retries: int = 3,
    ):
        self.host = host
        self.port = port
        self.base_url = f"http://{host}:{port}"
        self.timeout = timeout
        self.max_retries = max_retries
        self.server_process: Optional[subprocess.Popen[bytes]] = None
        self.server_path = server_path or self._find_server_path()

        if auto_start:
            self._ensure_server_running()

    def _find_server_path(self) -> str:
        """Find the gym-server package path."""
        # Try relative to this file
        package_dir = Path(__file__).parent.parent.parent
        gym_server = package_dir / "gym-server" / "src" / "index.ts"
        if gym_server.exists():
            return str(gym_server)

        # Try from current working directory
        cwd = Path.cwd()
        for parent in [cwd] + list(cwd.parents):
            gym_server = parent / "packages" / "gym-server" / "src" / "index.ts"
            if gym_server.exists():
                return str(gym_server)

        raise FileNotFoundError("Could not find gym-server. Please specify server_path or run from the manacore repository root.")

    def _is_server_running(self) -> bool:
        """Check if the server is already running."""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=2)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False

    def _ensure_server_running(self) -> None:
        """Start the server if it's not already running."""
        if self._is_server_running():
            return

        # If port might be in use, wait a bit for it to be released
        time.sleep(1.0)
        if self._is_server_running():
            return

        print(f"[BunBridge] Starting server at {self.base_url}...")

        env = os.environ.copy()
        env["MANACORE_SILENT_INIT"] = "1"

        self.server_process = subprocess.Popen(
            ["bun", "run", self.server_path, "--port", str(self.port)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )

        # Wait for server to be ready
        for _ in range(30):  # 30 second timeout
            if self._is_server_running():
                print("[BunBridge] Server started successfully")
                return
            time.sleep(1)

        raise RuntimeError("Failed to start server within 30 seconds")

    def _request(
        self,
        method: str,
        endpoint: str,
        json: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Make an HTTP request to the server with retry logic."""
        url = f"{self.base_url}{endpoint}"

        for attempt in range(self.max_retries):
            try:
                if method == "GET":
                    response = requests.get(url, timeout=self.timeout)
                elif method == "POST":
                    response = requests.post(url, json=json, timeout=self.timeout)
                elif method == "DELETE":
                    response = requests.delete(url, timeout=self.timeout)
                else:
                    raise ValueError(f"Unknown method: {method}")

                response.raise_for_status()
                return response.json()

            except requests.exceptions.RequestException as e:
                if attempt < self.max_retries - 1:
                    time.sleep(0.5 * (attempt + 1))
                else:
                    # Try to get error details from response
                    error_detail = ""
                    if hasattr(e, "response") and e.response is not None:
                        with contextlib.suppress(Exception):
                            error_detail = f" - Server response: {e.response.text}"
                    raise RuntimeError(f"Request failed after {self.max_retries} attempts: {e}{error_detail}") from e

        raise RuntimeError("Unexpected error in request")

    def health(self) -> dict[str, Any]:
        """Get server health status."""
        return self._request("GET", "/health")

    def info(self) -> dict[str, Any]:
        """Get detailed server information."""
        return self._request("GET", "/health/info")

    def create_game(
        self,
        opponent: str = "greedy",
        deck: str = "random",
        opponent_deck: str = "random",
        seed: Optional[int] = None,
    ) -> dict[str, Any]:
        """
        Create a new game session.

        Args:
            opponent: Bot type ("random", "greedy", "mcts", "mcts-fast", "mcts-strong")
            deck: Player deck name or "random"
            opponent_deck: Opponent deck name or "random"
            seed: Random seed for reproducibility

        Returns:
            Game state including gameId, observation, action mask, etc.
        """
        payload: dict[str, Any] = {
            "opponent": opponent,
            "deck": deck,
            "opponentDeck": opponent_deck,
        }
        if seed is not None:
            payload["seed"] = seed

        return self._request("POST", "/game/create", json=payload)

    def step(self, game_id: str, action: int) -> dict[str, Any]:
        """
        Take an action in a game.

        Args:
            game_id: The game session ID
            action: Action index (0 to num_legal_actions - 1)

        Returns:
            New game state with observation, reward, done, truncated, info
        """
        # Convert numpy int to Python int for JSON serialization
        action = int(action)
        return self._request("POST", f"/game/{game_id}/step", json={"action": action})

    def reset(self, game_id: str, seed: Optional[int] = None) -> dict[str, Any]:
        """
        Reset a game to initial state.

        Args:
            game_id: The game session ID
            seed: Optional new random seed

        Returns:
            New initial game state
        """
        payload: dict[str, Any] = {}
        if seed is not None:
            payload["seed"] = seed
        return self._request("POST", f"/game/{game_id}/reset", json=payload)

    def get_state(self, game_id: str) -> dict[str, Any]:
        """Get current game state without taking an action."""
        return self._request("GET", f"/game/{game_id}/state")

    def get_actions(self, game_id: str) -> dict[str, Any]:
        """Get legal actions for current state."""
        return self._request("GET", f"/game/{game_id}/actions")

    def delete_game(self, game_id: str) -> dict[str, Any]:
        """Delete a game session."""
        return self._request("DELETE", f"/game/{game_id}")

    def get_expert_action(self, game_id: str, expert: str = "greedy") -> dict[str, Any]:
        """
        Query what an expert bot would choose at the current state.
        Used for DAgger (Dataset Aggregation) data collection.

        Args:
            game_id: The game session ID
            expert: Bot type to query (default: "greedy")

        Returns:
            Dict with expertAction (index), expertActionDescription, expertType
        """
        return self._request("GET", f"/game/{game_id}/expert_action?expert={expert}")

    def batch_create(
        self,
        count: int,
        opponent: str = "greedy",
        deck: str = "random",
        opponent_deck: str = "random",
    ) -> dict[str, Any]:
        """Create multiple game sessions at once."""
        return self._request(
            "POST",
            "/batch/create",
            json={
                "count": count,
                "opponent": opponent,
                "deck": deck,
                "opponentDeck": opponent_deck,
            },
        )

    def batch_step(self, steps: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Step multiple games at once.

        Args:
            steps: List of {"gameId": str, "action": int} dicts

        Returns:
            Results for each game
        """
        return self._request("POST", "/batch/step", json={"steps": steps})

    def batch_reset(self, game_ids: list[str]) -> dict[str, Any]:
        """Reset multiple games at once."""
        return self._request("POST", "/batch/reset", json={"gameIds": game_ids})

    def close(self) -> None:
        """Stop the server if we started it."""
        if self.server_process is not None:
            print("[BunBridge] Stopping server...")
            self.server_process.send_signal(signal.SIGTERM)
            try:
                self.server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.server_process.kill()
            self.server_process = None

    def __del__(self) -> None:
        """Cleanup on garbage collection."""
        self.close()

    def __enter__(self) -> "BunBridge":
        """Context manager entry."""
        return self

    def __exit__(self, *args: Any) -> None:
        """Context manager exit."""
        self.close()
