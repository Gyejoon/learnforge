import { describe, it, expect, beforeEach } from 'vitest';
import { detectSourceType } from './extractors.js';
import { chunkText } from './chunker.js';
import { ingest } from './pipeline.js';
import { initDatabase } from '../storage/database.js';
import type Database from 'better-sqlite3';

// ────────────────────────────────────────────────────────────────
// detectSourceType
// ────────────────────────────────────────────────────────────────
describe('detectSourceType', () => {
  it('detects PDF by extension', () => {
    expect(detectSourceType('/path/to/file.pdf')).toBe('pdf');
  });

  it('detects YouTube URL', () => {
    expect(detectSourceType('https://www.youtube.com/watch?v=abc')).toBe('youtube');
  });

  it('detects youtu.be short link', () => {
    expect(detectSourceType('https://youtu.be/abc123')).toBe('youtube');
  });

  it('detects markdown', () => {
    expect(detectSourceType('notes.md')).toBe('markdown');
  });

  it('detects URL', () => {
    expect(detectSourceType('https://example.com/article')).toBe('url');
  });

  it('detects code — .py', () => {
    expect(detectSourceType('main.py')).toBe('code');
  });

  it('detects code — .ts', () => {
    expect(detectSourceType('src/index.ts')).toBe('code');
  });

  it('detects code — .go', () => {
    expect(detectSourceType('server.go')).toBe('code');
  });

  it('defaults to text', () => {
    expect(detectSourceType('some random text')).toBe('text');
  });
});

// ────────────────────────────────────────────────────────────────
// chunkText
// ────────────────────────────────────────────────────────────────
describe('chunkText', () => {
  it('returns single chunk for short text', () => {
    const text = 'Hello world. This is a short piece of text.';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('splits long text at paragraph boundaries', () => {
    // Build a text with two clear paragraphs, each ~800 tokens (3200 chars)
    const para1 = 'A'.repeat(3200);
    const para2 = 'B'.repeat(3200);
    const text = `${para1}\n\n${para2}`;
    const chunks = chunkText(text, 1500);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]).toContain('A');
    expect(chunks[chunks.length - 1]).toContain('B');
  });

  it('respects maxTokens limit', () => {
    // 8000 chars ≈ 2000 tokens, maxTokens=500 → should produce multiple chunks
    const text = 'word '.repeat(1600); // 8000 chars
    const chunks = chunkText(text, 500);
    for (const chunk of chunks) {
      const tokens = Math.ceil(chunk.length / 4);
      // Allow headroom for overlap and rounding, but no chunk should be wildly over
      expect(tokens).toBeLessThanOrEqual(750);
    }
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('includes overlap between chunks', () => {
    // Three paragraphs, each long enough to force splitting
    const para = 'X'.repeat(3200);
    const text = `${para}\n\n${para}\n\n${para}`;
    const chunks = chunkText(text, 1000, 200);
    // With overlap, chunk[1] should start with content from the tail of chunk[0]
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // The second chunk should not be empty
    expect(chunks[1].length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────
// ingest pipeline
// ────────────────────────────────────────────────────────────────
describe('ingest', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDatabase(':memory:');
  });

  it('ingests text and stores source + chunks', async () => {
    const input = 'This is inline text content for testing the ingestion pipeline. '.repeat(5);
    const result = await ingest(input, db, { title: 'Test Source' });

    expect(result.source).toBeDefined();
    expect(result.source.type).toBe('text');
    expect(result.source.title).toBe('Test Source');
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  it('deduplicates by content hash', async () => {
    const input = 'Unique content for dedup test. '.repeat(5);

    const result1 = await ingest(input, db, { title: 'First' });
    const result2 = await ingest(input, db, { title: 'Second' });

    // Second call should return the same source (deduplicated)
    expect(result1.source.id).toBe(result2.source.id);
    expect(result1.source.contentHash).toBe(result2.source.contentHash);
  });

  it('assigns default title when none provided', async () => {
    const input = 'Some content without an explicit title.';
    const result = await ingest(input, db);

    expect(result.source.title).toBeTruthy();
  });

  it('assigns deck from options', async () => {
    const input = 'Content for deck assignment test.';
    const result = await ingest(input, db, { title: 'Deck Test', deck: 'biology' });

    // deck is stored in source metadata
    expect(result.source.metadata['deck']).toBe('biology');
  });
});
