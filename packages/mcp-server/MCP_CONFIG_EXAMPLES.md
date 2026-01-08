# Example MCP Client Configurations

## Claude Desktop / Claude Code

**Linux/Mac**: `~/.config/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Development Mode (Hot Reload)
```json
{
  "mcpServers": {
    "manacore-dev": {
      "command": "/home/chris/manacore/scripts/start-mcp-server-dev.sh"
    }
  }
}
```

### Production Mode (Stable)
```json
{
  "mcpServers": {
    "manacore": {
      "command": "/home/chris/manacore/scripts/start-mcp-server.sh"
    }
  }
}
```

### Both Modes (Switch as needed)
```json
{
  "mcpServers": {
    "manacore": {
      "command": "/home/chris/manacore/scripts/start-mcp-server.sh"
    },
    "manacore-dev": {
      "command": "/home/chris/manacore/scripts/start-mcp-server-dev.sh"
    }
  }
}
```

## Gemini CLI

**Config file**: `.gemini-mcp-config.json` (in your project or home directory)

### Development Mode
```json
{
  "mcpServers": {
    "manacore": {
      "command": "/home/chris/manacore/scripts/start-mcp-server-dev.sh",
      "args": []
    }
  }
}
```

## Cline (VSCode Extension)

**Settings**: VSCode Settings → Cline → MCP Servers

```json
{
  "cline.mcpServers": {
    "manacore-dev": {
      "command": "/home/chris/manacore/scripts/start-mcp-server-dev.sh"
    }
  }
}
```

## Testing Your Configuration

After updating your MCP config:

1. **Restart your AI client** (Claude Desktop/Gemini CLI/etc.)
2. **Ask the AI**: "Can you use the manacore tool to start a new game?"
3. **Make a change** to any engine file (add a comment)
4. **Save the file**
5. **Watch the logs** - you should see the server restart
6. **Start a new game** - it will use the updated code!

## Quick Test

```bash
# Terminal 1: Start the server with hot reload
./scripts/start-mcp-server-dev.sh

# Terminal 2: Make a test change
echo "// Test change" >> packages/engine/src/rules/combat.ts

# Terminal 1: You should see:
# [watch] restarting due to changes...
# [watch] /home/chris/manacore/packages/engine/src/rules/combat.ts
```

## Notes

- Replace `/home/chris/manacore` with your actual project path
- On Windows, use forward slashes or escaped backslashes in JSON
- The `-dev` suffix helps distinguish development vs. production servers
