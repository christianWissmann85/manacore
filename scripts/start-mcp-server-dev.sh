#!/bin/bash
# Development MCP Server with Hot Reload
# This script automatically restarts the server when you modify engine code

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "Error: 'bun' is not installed or not in PATH." >&2
    exit 1
fi

echo "🔥 Starting ManaCore MCP Server with HOT RELOAD enabled..." >&2
echo "📝 Watching for changes in:" >&2
echo "   - packages/engine/**/*.ts" >&2
echo "   - packages/ai/**/*.ts" >&2
echo "   - packages/mcp-server/**/*.ts" >&2
echo "" >&2

cd "$PROJECT_ROOT"

# Bun's --watch will automatically restart when TypeScript files change
exec bun --watch packages/mcp-server/src/index.ts
