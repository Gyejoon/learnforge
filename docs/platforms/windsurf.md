# Windsurf IDE

Windsurf supports MCP via Cascade (stdio transport).

## Configuration

Add to Windsurf Settings > Cascade > MCP Servers, or edit `mcp_config.json`:

```json
{
  "mcpServers": {
    "learnforge": {
      "command": "node",
      "args": ["/absolute/path/to/learnforge/dist/adapters/mcp.js"],
      "env": {
        "LEARNFORGE_DB": "~/.learnforge/learnforge.db"
      }
    }
  }
}
```

## Usage

LearnForge tools are available in Cascade conversations once configured.
