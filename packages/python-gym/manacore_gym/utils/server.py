"""
Server management utilities.
"""

import subprocess
import os
import time
from pathlib import Path
from typing import Optional

import requests


def find_server_path() -> str:
    """
    Find the path to the gym-server entry point.

    Searches in common locations relative to the package and current directory.

    Returns:
        Path to the gym-server index.ts file

    Raises:
        FileNotFoundError: If the server cannot be found
    """
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

    raise FileNotFoundError(
        "Could not find gym-server. Please ensure you're running from the "
        "manacore repository or specify the server path explicitly."
    )


def is_server_running(host: str = "localhost", port: int = 3333) -> bool:
    """
    Check if the gym server is running.

    Args:
        host: Server hostname
        port: Server port

    Returns:
        True if server is responding
    """
    try:
        response = requests.get(f"http://{host}:{port}/health", timeout=2)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False


def ensure_server_running(
    host: str = "localhost",
    port: int = 3333,
    server_path: Optional[str] = None,
    timeout: int = 30,
) -> subprocess.Popen[bytes]:
    """
    Ensure the gym server is running, starting it if necessary.

    Args:
        host: Server hostname
        port: Server port
        server_path: Path to gym-server (auto-detected if None)
        timeout: Seconds to wait for server startup

    Returns:
        The server process (or None if server was already running)

    Raises:
        RuntimeError: If server fails to start
        FileNotFoundError: If server path cannot be found
    """
    if is_server_running(host, port):
        return None  # type: ignore

    if server_path is None:
        server_path = find_server_path()

    env = os.environ.copy()
    env["MANACORE_SILENT_INIT"] = "1"

    process = subprocess.Popen(
        ["bun", "run", server_path, "--port", str(port)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )

    # Wait for server to be ready
    for _ in range(timeout):
        if is_server_running(host, port):
            return process
        time.sleep(1)

    process.kill()
    raise RuntimeError(f"Failed to start server within {timeout} seconds")
