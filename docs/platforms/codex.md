# OpenAI Codex CLI

Codex CLI supports MCP servers natively.

## Configuration

Add to `.codex/config.toml` (project-scoped) or `~/.codex/config.toml` (global):

```toml
[mcp.learnforge]
command = "node"
args = ["/absolute/path/to/learnforge/dist/adapters/mcp.js"]

[mcp.learnforge.env]
LEARNFORGE_DB = "~/.learnforge/learnforge.db"
```

Or manage via CLI:

```bash
codex mcp add learnforge -- node /path/to/learnforge/dist/adapters/mcp.js
```

## Usage

LearnForge tools are automatically available in Codex sessions.
