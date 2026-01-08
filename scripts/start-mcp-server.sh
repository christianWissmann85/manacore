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

# Run the server with hot reload if DEV mode is enabled
cd "$PROJECT_ROOT"

if [ "$MANACORE_DEV" = "1" ]; then
    echo "Starting MCP server in HOT RELOAD mode..." >&2
    exec bun --watch packages/mcp-server/src/index.ts
else
    exec bun run packages/mcp-server/src/index.ts
fi
