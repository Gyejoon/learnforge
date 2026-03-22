import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { LearnForgeHandlers, createDatabase, resolveDbPath } from '../core/index.js';

// ── Server factory ────────────────────────────────────────────────────────

export function createServer(dbPath: string): McpServer {
  const db = createDatabase(dbPath);
  const handlers = new LearnForgeHandlers(db);

  const server = new McpServer({
    name: 'learnforge',
    version: '0.1.0',
  });

  // ── Tool: learnforge_ingest ──────────────────────────────────────────────
  server.tool(
    'learnforge_ingest',
    'Ingest learning material (text, file path, URL, or YouTube link)',
    {
      source: z.string().describe('The source to ingest'),
      title: z.string().optional().describe('Optional title override'),
      deck: z.string().optional().describe('Target deck name'),
    },
    async ({ source, title, deck }) => {
      try {
        const result = await handlers.handleIngest({ source, title, deck });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
      }
    },
  );

  // ── Tool: learnforge_sources ─────────────────────────────────────────────
  server.tool(
    'learnforge_sources',
    'List all ingested sources',
    {},
    () => {
      try {
        const sources = handlers.handleSources();
        return { content: [{ type: 'text', text: JSON.stringify(sources, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
      }
    },
  );

  // ── Tool: learnforge_learn ───────────────────────────────────────────────
  server.tool(
    'learnforge_learn',
    'Start a learning session with a specific pedagogy mode',
    {
      mode: z
        .enum(['socratic', 'feynman', 'quiz', 'teach', 'explore', 'gap'])
        .describe('Learning mode'),
      topic: z.string().optional().describe('Topic to study'),
      deck: z.string().optional().describe('Deck to study from'),
    },
    ({ mode, topic, deck }) => {
      try {
        const result = handlers.handleLearn({ mode, topic, deck });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
      }
    },
  );

  // ── Tool: learnforge_create_cards ────────────────────────────────────────
  server.tool(
    'learnforge_create_cards',
    'Create flashcards with FSRS initial state',
    {
      cards: z
        .array(
          z.object({
            front: z.string(),
            back: z.string(),
            cardType: z.string(),
            tags: z.string().optional(),
          }),
        )
        .describe('Cards to create'),
      sourceId: z.string().optional().describe('Source ID for the cards'),
      deck: z.string().optional().describe('Target deck name'),
    },
    ({ cards, sourceId, deck }) => {
      try {
        const created = handlers.handleCreateCards({ cards, sourceId, deck });
        return { content: [{ type: 'text', text: JSON.stringify(created, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
      }
    },
  );

  // ── Tool: learnforge_review ──────────────────────────────────────────────
  server.tool(
    'learnforge_review',
    'Get cards due for review',
    {
      deck: z.string().optional().describe('Filter by deck'),
      limit: z.number().optional().describe('Maximum number of cards'),
    },
    ({ deck, limit }) => {
      try {
        const result = handlers.handleReview({ deck, limit });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
      }
    },
  );

  // ── Tool: learnforge_answer ──────────────────────────────────────────────
  server.tool(
    'learnforge_answer',
    'Submit a review answer for a card (rating: 1=Again, 2=Hard, 3=Good, 4=Easy)',
    {
      cardId: z.string().describe('The card ID to review'),
      rating: z
        .union([
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
        ])
        .describe('Rating: 1=Again, 2=Hard, 3=Good, 4=Easy'),
    },
    ({ cardId, rating }) => {
      try {
        const result = handlers.handleAnswer({ cardId, rating });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
      }
    },
  );

  // ── Tool: learnforge_progress ────────────────────────────────────────────
  server.tool(
    'learnforge_progress',
    'View learning progress statistics',
    {
      type: z
        .enum(['overview', 'deck', 'heatmap', 'gaps', 'forecast'])
        .optional()
        .describe('Stats type (default: overview)'),
      deck: z.string().optional().describe('Filter by deck'),
      days: z
        .number()
        .optional()
        .describe('Number of days for heatmap/forecast'),
    },
    ({ type, deck, days }) => {
      try {
        const result = handlers.handleProgress({ type, deck, days });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
      }
    },
  );

  // ── Tool: learnforge_export ──────────────────────────────────────────────
  server.tool(
    'learnforge_export',
    'Export flashcards in various formats',
    {
      deck: z.string().optional().describe('Filter by deck'),
      format: z
        .enum(['tsv', 'csv', 'json', 'mochi_md'])
        .describe('Export format'),
    },
    ({ deck, format }) => {
      try {
        const content = handlers.handleExport({ deck, format });
        return { content: [{ type: 'text', text: content }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
      }
    },
  );

  // ── Resource: learnforge://status ────────────────────────────────────────
  server.resource(
    'learnforge-status',
    'learnforge://status',
    { description: 'LearnForge system status overview' },
    () => {
      const status = handlers.getStatus();
      return {
        contents: [
          {
            uri: 'learnforge://status',
            mimeType: 'application/json',
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    },
  );

  // ── Resource: learnforge://due-cards ────────────────────────────────────
  server.resource(
    'learnforge-due-cards',
    'learnforge://due-cards',
    { description: "Today's cards due for review" },
    () => {
      const cards = handlers.getDueCardsList();
      return {
        contents: [
          {
            uri: 'learnforge://due-cards',
            mimeType: 'application/json',
            text: JSON.stringify(cards, null, 2),
          },
        ],
      };
    },
  );

  return server;
}

// ── Main entry point ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  const server = createServer(resolveDbPath());
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isMainModule =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('mcp-server.js') ||
    process.argv[1].endsWith('mcp-server.ts') ||
    process.argv[1].endsWith('adapters/mcp.js') ||
    process.argv[1].endsWith('adapters/mcp.ts'));

if (isMainModule) {
  main().catch(console.error);
}
