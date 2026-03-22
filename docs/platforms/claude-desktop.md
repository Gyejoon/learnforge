# Claude Desktop

## Setup

```bash
git clone https://github.com/Gyejoon/learnforge.git
cd learnforge
npm install && npm run build
npm run setup-db
```

## Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

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

Once configured, LearnForge tools are available directly in Claude Desktop conversations:

- "이 PDF 학습하자" → `learnforge_ingest`
- "소크라테스 모드로" → `learnforge_learn`
- "복습하자" → `learnforge_review`
- "진행도 보여줘" → `learnforge_progress`
