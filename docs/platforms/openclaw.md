# OpenClaw

OpenClaw supports both MCP and CLI tools. **CLI is recommended** for token efficiency (4-32x savings).

## Option 1: CLI (Recommended)

Install LearnForge globally:

```bash
cd /path/to/learnforge
npm install && npm run build
npm link
```

Then use directly in OpenClaw conversations or automation:

```bash
# Ingest material
learnforge ingest "https://example.com/article"

# Review cards
learnforge review --pretty

# Answer a card
learnforge answer <card-id> 3

# Check progress
learnforge progress --type overview --pretty

# Export to Anki
learnforge export --format tsv --deck math
```

All commands output JSON by default (machine-readable). Add `--pretty` for formatted output.

## Option 2: MCP

OpenClaw also supports MCP servers:

```yaml
# In OpenClaw MCP config
learnforge:
  command: node
  args:
    - /absolute/path/to/learnforge/dist/adapters/mcp.js
  env:
    LEARNFORGE_DB: ~/.learnforge/learnforge.db
```

## CLI Commands Reference

| Command | Description |
|---------|-------------|
| `learnforge ingest <source>` | Ingest text, file, URL, or YouTube |
| `learnforge sources` | List all ingested sources |
| `learnforge learn <mode>` | Get learning session prompt |
| `learnforge create-cards --file cards.json` | Create flashcards |
| `learnforge review [--deck X]` | Get due cards |
| `learnforge answer <id> <1-4>` | Submit review rating |
| `learnforge progress [--type X]` | View statistics |
| `learnforge export --format tsv` | Export cards |
| `learnforge status` | System overview |
