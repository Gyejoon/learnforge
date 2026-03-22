// ── Backward-compatible facade ───────────────────────────────────────────
// Re-exports from core/ and adapters/mcp so existing imports continue to work.

export {
  LearnForgeHandlers,
  MODE_METADATA,
  type IngestInput,
  type IngestOutput,
  type LearnInput,
  type LearnOutput,
  type CreateCardsInput,
  type ReviewOutput,
  type AnswerInput,
  type AnswerOutput,
  type ProgressInput,
  type ProgressOverview,
  type ExportInput,
  resolveDbPath,
  createDatabase,
} from './core/index.js';

export { createServer } from './adapters/mcp.js';

// ── Main entry point (kept for backward compatibility) ──────────────────

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './adapters/mcp.js';
import { resolveDbPath } from './core/index.js';

async function main(): Promise<void> {
  const server = createServer(resolveDbPath());
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isMainModule =
  process.argv[1] !== undefined &&
  process.argv[1].endsWith('mcp-server.js');

if (isMainModule) {
  main().catch(console.error);
}
