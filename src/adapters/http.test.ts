import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { initDatabase } from '../storage/index.js';
import { LearnForgeHandlers } from '../core/index.js';
import { createHttpServer } from './http.js';

let server: http.Server;
let port: number;
let handlers: LearnForgeHandlers;

function request(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: 'localhost',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          data = { raw };
        }
        resolve({ status: res.statusCode ?? 0, data });
      });
    });

    req.on('error', reject);
    if (body !== undefined) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

beforeAll(async () => {
  const db = initDatabase(':memory:');
  handlers = new LearnForgeHandlers(db);
  server = createHttpServer(handlers);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      if (addr !== null && typeof addr === 'object') {
        port = addr.port;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe('HTTP 어댑터', () => {
  it('GET /api/status로 시스템 상태를 반환해야 한다', async () => {
    const { status, data } = await request('GET', '/api/status');
    expect(status).toBe(200);
    expect(typeof data.total_sources).toBe('number');
    expect(typeof data.total_cards).toBe('number');
  });

  it('GET /api/sources로 빈 배열을 반환해야 한다', async () => {
    const { status, data } = await request('GET', '/api/sources');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('POST /api/ingest로 텍스트를 수집해야 한다', async () => {
    const { status, data } = await request('POST', '/api/ingest', {
      source: 'HTTP test content for ingestion',
    });
    expect(status).toBe(200);
    const source = data.source as { type: string };
    expect(source.type).toBe('text');
  });

  it('POST /api/learn으로 학습 세션을 생성해야 한다', async () => {
    const { status, data } = await request('POST', '/api/learn', {
      mode: 'socratic',
      topic: 'Testing',
    });
    expect(status).toBe(200);
    expect(data.mode_name).toBe('socratic');
    expect(typeof data.systemPrompt).toBe('string');
  });

  it('POST /api/cards로 카드를 생성해야 한다', async () => {
    const { status, data } = await request('POST', '/api/cards', {
      cards: [{ front: 'HTTP Q', back: 'HTTP A', cardType: 'basic' }],
    });
    expect(status).toBe(201);
    expect(Array.isArray(data)).toBe(true);
  });

  it('GET /api/review로 복습 카드를 조회해야 한다', async () => {
    const { status, data } = await request('GET', '/api/review');
    expect(status).toBe(200);
    expect(typeof data.due_count).toBe('number');
    expect(typeof data.new_count).toBe('number');
  });

  it('GET /api/progress로 통계를 조회해야 한다', async () => {
    const { status, data } = await request('GET', '/api/progress?type=overview');
    expect(status).toBe(200);
    expect(typeof data.total_cards).toBe('number');
  });

  it('존재하지 않는 경로에 404를 반환해야 한다', async () => {
    const { status, data } = await request('GET', '/api/nonexistent');
    expect(status).toBe(404);
    expect(data.error).toBeTruthy();
  });

  it('GET /api/export?format=json으로 카드를 내보내야 한다', async () => {
    const { status, data } = await request('GET', '/api/export?format=json');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  // ── 입력 검증 테스트 ──────────────────────────────────────────────────

  it('POST /api/ingest에 source 없이 요청하면 400을 반환해야 한다', async () => {
    const { status, data } = await request('POST', '/api/ingest', {});
    expect(status).toBe(400);
    expect(data.error).toContain('source');
  });

  it('POST /api/learn에 잘못된 mode를 넣으면 400을 반환해야 한다', async () => {
    const { status, data } = await request('POST', '/api/learn', { mode: 'invalid' });
    expect(status).toBe(400);
    expect(data.error).toContain('mode');
  });

  it('POST /api/answer에 잘못된 rating을 넣으면 400을 반환해야 한다', async () => {
    const { status, data } = await request('POST', '/api/answer', { cardId: 'x', rating: 5 });
    expect(status).toBe(400);
    expect(data.error).toContain('rating');
  });

  it('POST /api/cards에 빈 cards 배열을 넣으면 400을 반환해야 한다', async () => {
    const { status, data } = await request('POST', '/api/cards', { cards: [] });
    expect(status).toBe(400);
    expect(data.error).toContain('cards');
  });
});
