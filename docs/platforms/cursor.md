# Cursor IDE

Cursor supports MCP servers natively in Agent mode.

## Configuration

Create `.cursor/mcp.json` in your project root (or global config):

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

In Cursor's Agent mode, LearnForge tools are automatically available.
Ask the agent to ingest materials, create flashcards, or start review sessions.
