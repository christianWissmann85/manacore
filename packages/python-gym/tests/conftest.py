"""
Pytest configuration and fixtures for manacore_gym tests.
"""

import pytest
from manacore_gym.bridge import BunBridge


@pytest.fixture(scope="session")
def shared_server():
    """
    Provide a shared game server for all tests.
    
    This fixture starts a single server at the beginning of the test session
    and keeps it running for all tests, avoiding the overhead and issues
    of repeatedly starting/stopping the server between tests.
    """
    bridge = BunBridge(auto_start=True)
    yield bridge
    bridge.close()


@pytest.fixture(scope="function")
def env_no_auto_start():
    """
    Mark tests that should not auto-start their own server.
    
    When using the shared_server fixture, individual tests should create
    environments with auto_start_server=False to use the shared server.
    """
    return {"auto_start_server": False}
