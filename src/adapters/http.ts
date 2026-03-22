import http from 'node:http';
import { LearnForgeHandlers } from '../core/index.js';
import { createDatabase, resolveDbPath } from '../core/index.js';

// ── Request helpers ─────────────────────────────────────────────────────

function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (raw.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function parseQuery(url: string): Record<string, string> {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const params = new URLSearchParams(url.slice(idx + 1));
  const result: Record<string, string> = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

function sendJson(res: http.ServerResponse, data: unknown, status: number = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function sendError(res: http.ServerResponse, message: string, status: number = 400): void {
  sendJson(res, { error: message }, status);
}

function sendText(res: http.ServerResponse, text: string, status: number = 200): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

// ── Server factory ──────────────────────────────────────────────────────

export function createHttpServer(handlers: LearnForgeHandlers): http.Server {
  return http.createServer(async (req, res) => {
    const url = req.url ?? '/';
    const pathname = url.split('?')[0];
    const method = req.method ?? 'GET';

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // POST /api/ingest
      if (method === 'POST' && pathname === '/api/ingest') {
        const body = await parseBody(req);
        if (typeof body.source !== 'string' || body.source.length === 0) {
          sendError(res, 'Missing required field: source');
          return;
        }
        const result = await handlers.handleIngest({
          source: body.source,
          title: typeof body.title === 'string' ? body.title : undefined,
          deck: typeof body.deck === 'string' ? body.deck : undefined,
        });
        sendJson(res, result);
        return;
      }

      // GET /api/sources
      if (method === 'GET' && pathname === '/api/sources') {
        sendJson(res, handlers.handleSources());
        return;
      }

      // POST /api/learn
      if (method === 'POST' && pathname === '/api/learn') {
        const body = await parseBody(req);
        const validModes = ['socratic', 'feynman', 'quiz', 'teach', 'explore', 'gap'];
        if (typeof body.mode !== 'string' || !validModes.includes(body.mode)) {
          sendError(res, `Invalid or missing field: mode. Must be one of: ${validModes.join(', ')}`);
          return;
        }
        const result = handlers.handleLearn({
          mode: body.mode as 'socratic' | 'feynman' | 'quiz' | 'teach' | 'explore' | 'gap',
          topic: typeof body.topic === 'string' ? body.topic : undefined,
          deck: typeof body.deck === 'string' ? body.deck : undefined,
        });
        sendJson(res, result);
        return;
      }

      // POST /api/cards
      if (method === 'POST' && pathname === '/api/cards') {
        const body = await parseBody(req);
        if (!Array.isArray(body.cards) || body.cards.length === 0) {
          sendError(res, 'Missing or empty required field: cards (must be a non-empty array)');
          return;
        }
        const result = handlers.handleCreateCards({
          cards: body.cards as Array<{ front: string; back: string; cardType: string; tags?: string }>,
          sourceId: typeof body.sourceId === 'string' ? body.sourceId : undefined,
          deck: typeof body.deck === 'string' ? body.deck : undefined,
        });
        sendJson(res, result, 201);
        return;
      }

      // GET /api/review
      if (method === 'GET' && pathname === '/api/review') {
        const query = parseQuery(url);
        const result = handlers.handleReview({
          deck: query.deck,
          limit: query.limit !== undefined ? parseInt(query.limit, 10) : undefined,
        });
        sendJson(res, result);
        return;
      }

      // POST /api/answer
      if (method === 'POST' && pathname === '/api/answer') {
        const body = await parseBody(req);
        if (typeof body.cardId !== 'string' || body.cardId.length === 0) {
          sendError(res, 'Missing required field: cardId');
          return;
        }
        const validRatings = [1, 2, 3, 4];
        if (typeof body.rating !== 'number' || !validRatings.includes(body.rating)) {
          sendError(res, 'Invalid or missing field: rating. Must be 1, 2, 3, or 4.');
          return;
        }
        const result = handlers.handleAnswer({
          cardId: body.cardId,
          rating: body.rating as 1 | 2 | 3 | 4,
        });
        sendJson(res, result);
        return;
      }

      // GET /api/progress
      if (method === 'GET' && pathname === '/api/progress') {
        const query = parseQuery(url);
        const result = handlers.handleProgress({
          type: query.type as 'overview' | 'deck' | 'heatmap' | 'gaps' | 'forecast' | undefined,
          deck: query.deck,
          days: query.days !== undefined ? parseInt(query.days, 10) : undefined,
        });
        sendJson(res, result);
        return;
      }

      // GET /api/export
      if (method === 'GET' && pathname === '/api/export') {
        const query = parseQuery(url);
        if (query.format === undefined) {
          sendError(res, 'Missing required query parameter: format');
          return;
        }
        const result = handlers.handleExport({
          format: query.format as 'tsv' | 'csv' | 'json' | 'mochi_md',
          deck: query.deck,
        });
        if (query.format === 'json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(result);
        } else {
          sendText(res, result);
        }
        return;
      }

      // GET /api/status
      if (method === 'GET' && pathname === '/api/status') {
        sendJson(res, handlers.getStatus());
        return;
      }

      // 404
      sendError(res, `Not found: ${method} ${pathname}`, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendError(res, message, 500);
    }
  });
}

// ── Main entry point ────────────────────────────────────────────────────

export function startHttpServer(port: number = 3737): http.Server {
  const db = createDatabase(resolveDbPath());
  const handlers = new LearnForgeHandlers(db);
  const server = createHttpServer(handlers);

  server.listen(port, () => {
    console.log(`LearnForge HTTP server listening on http://localhost:${port}`);
    console.log('Endpoints:');
    console.log('  POST /api/ingest      — Ingest learning material');
    console.log('  GET  /api/sources     — List all sources');
    console.log('  POST /api/learn       — Start learning session');
    console.log('  POST /api/cards       — Create flashcards');
    console.log('  GET  /api/review      — Get cards due for review');
    console.log('  POST /api/answer      — Submit review answer');
    console.log('  GET  /api/progress    — View progress statistics');
    console.log('  GET  /api/export      — Export flashcards');
    console.log('  GET  /api/status      — System status');
  });

  return server;
}

const isMainModule =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('adapters/http.js') ||
    process.argv[1].endsWith('adapters/http.ts'));

if (isMainModule) {
  const port = process.env.LEARNFORGE_PORT !== undefined
    ? parseInt(process.env.LEARNFORGE_PORT, 10)
    : 3737;
  startHttpServer(port);
}
