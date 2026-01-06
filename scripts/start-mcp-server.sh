#!/bin/bash
# Helper script to start the ManaCore MCP Server
# Used by MCP clients (Claude, Gemini, etc.) to connect to the game engine

# Resolve the project root (one level up from scripts/)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "Error: 'bun' is not installed or not in PATH." >&2
    exit 1
fi

# Run the server
cd "$PROJECT_ROOT"
exec bun run packages/mcp-server/src/index.ts
