# Hot Reload Development Guide

This guide explains how to use hot reloading during ManaCore development to avoid restarting Claude Code/Gemini CLI after every code change.

## Quick Start

### Option 1: Use the Dev Script (Recommended)

```bash
./scripts/start-mcp-server-dev.sh
```

This automatically restarts the MCP server whenever you save changes to:

- `packages/engine/**/*.ts`
- `packages/ai/**/*.ts`
- `packages/mcp-server/**/*.ts`

### Option 2: Environment Variable Method

Set the `MANACORE_DEV` environment variable before starting:

```bash
export MANACORE_DEV=1
./scripts/start-mcp-server.sh
```

### Option 3: Direct Bun Command

```bash
cd packages/mcp-server
bun run dev
```

## Configuration for AI Clients

### Claude Code (Claude Desktop/VSCode)

Update your MCP settings to use the dev script:

**For Linux/Mac** (`~/.config/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "manacore": {
      "command": "/absolute/path/to/manacore/scripts/start-mcp-server-dev.sh",
      "env": {}
    }
  }
}
```

**For Windows** (`%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "manacore": {
      "command": "bash",
      "args": ["C:\\absolute\\path\\to\\manacore\\scripts\\start-mcp-server-dev.sh"],
      "env": {}
    }
  }
}
```

### Gemini CLI

Update your `.gemini-mcp-config.json`:

```json
{
  "mcpServers": {
    "manacore": {
      "command": "/absolute/path/to/manacore/scripts/start-mcp-server-dev.sh"
    }
  }
}
```

## How It Works

### Bun Watch Mode

Bun's `--watch` flag monitors the file system for changes and automatically:

1. ✅ Detects when you save a `.ts` file
2. ✅ Kills the current server process
3. ✅ Re-imports all modules (fresh engine code!)
4. ✅ Restarts the MCP server

**Restart time**: ~50-200ms (very fast!)

### What Happens to Active Games?

⚠️ **Important**: When the server restarts, the current game session is lost. This is because:

- The `GameSession` state lives in memory
- MCP servers are stateless between restarts
- Your AI client (Claude/Gemini) will need to start a new game

### Development Workflow

1. **Make changes** to engine code (e.g., fix a combat bug)
2. **Save the file** (Ctrl+S)
3. **Wait ~100ms** for auto-restart (you'll see console output)
4. **In your AI client**, start a new game with the updated code
5. **Test immediately** - no manual restart needed!

## Monitoring Hot Reloads

Watch the MCP server logs to see when it restarts:

```bash
# The server will log:
🔥 Starting ManaCore MCP Server with HOT RELOAD enabled...
📝 Watching for changes in:
   - packages/engine/**/*.ts
   - packages/ai/**/*.ts
   - packages/mcp-server/**/*.ts

# After you save a file:
[watch] restarting due to changes...
[watch] /home/chris/manacore/packages/engine/src/rules/combat.ts
Started game game-1736294857123 against mcts
```

## Advanced: Persisting Game State (Future Enhancement)

If you need to preserve games across restarts, you could implement:

1. **Checkpoint saving**: Auto-save game state to disk
2. **Resume command**: Load the last saved game
3. **SQLite/JSON storage**: Store active sessions

Example pseudocode:

```typescript
// On restart, check for saved games
const savedGame = loadGameFromDisk(gameId);
if (savedGame) {
  activeSession = GameSession.fromCheckpoint(savedGame);
}
```

This is NOT currently implemented, but could be added if needed.

## Troubleshooting

### Hot Reload Not Working?

**Check 1**: Verify Bun version

```bash
bun --version  # Should be 1.0.0 or higher
```

**Check 2**: Confirm watch mode is active

```bash
ps aux | grep "bun --watch"
```

**Check 3**: File permissions

```bash
ls -la scripts/start-mcp-server-dev.sh  # Should show -rwxr-xr-x
```

### Client Not Reconnecting?

Some MCP clients cache the connection. Try:

1. **Close and reopen** the AI client entirely
2. **Clear MCP cache** (location varies by client)
3. **Check logs** for connection errors

### Too Many Restarts?

If the server is restarting constantly (watch loop):

**Problem**: You might be writing temporary files that trigger watches
**Solution**: Add ignore patterns to Bun's watch (currently watches all .ts files)

## Performance Impact

- ✅ **Dev Mode**: ~50-200ms restart latency (acceptable)
- ✅ **Memory**: No increase (each restart is a fresh process)
- ❌ **Production**: Do NOT use watch mode in production (use `start`, not `dev`)

## Switching Back to Production Mode

For stable/production use, use the original script:

```bash
./scripts/start-mcp-server.sh
```

Or update your MCP config to point to `start-mcp-server.sh` instead of `-dev.sh`.

## Summary

| Mode            | Command                   | Restarts on Change? | Use Case            |
| --------------- | ------------------------- | ------------------- | ------------------- |
| **Production**  | `start-mcp-server.sh`     | ❌ No               | Stable games, demos |
| **Development** | `start-mcp-server-dev.sh` | ✅ Yes (auto)       | Active development  |
| **Manual**      | `bun run dev`             | ✅ Yes (auto)       | Quick testing       |

**Recommendation**: Use `-dev.sh` during active development, switch to production mode when doing long gameplay sessions or demos.

---

**Questions?** Check [DEBUGGING.md](../DEBUGGING.md) or the MCP server source at [packages/mcp-server/src/index.ts](../packages/mcp-server/src/index.ts).
