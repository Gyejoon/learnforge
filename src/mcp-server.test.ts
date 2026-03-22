import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabase } from './storage/index.js';
import { LearnForgeHandlers, createServer } from './mcp-server.js';
import { CardState } from './types.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function createInMemoryHandlers(): LearnForgeHandlers {
  const db = initDatabase(':memory:');
  return new LearnForgeHandlers(db);
}

function seedSource(db: Database.Database): string {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO sources (id, title, type, original_path, content_hash, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, 'Test Source', 'text', 'test', id, '{}', new Date().toISOString());
  return id;
}

// ── Server instantiation ─────────────────────────────────────────────────

describe('createServer', () => {
  it('returns an McpServer instance', () => {
    const server = createServer(':memory:');
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe('function');
  });
});

// ── learnforge_ingest ────────────────────────────────────────────────────

describe('LearnForgeHandlers.handleIngest', () => {
  let handlers: LearnForgeHandlers;

  beforeEach(() => {
    handlers = createInMemoryHandlers();
  });

  it('ingests plain text and returns source + stats', async () => {
    const result = await handlers.handleIngest({
      source: 'FSRS is a spaced repetition algorithm used in flashcard apps.',
    });

    expect(result.source.id).toBeTruthy();
    expect(result.source.title).toBeTruthy();
    expect(result.source.type).toBe('text');
    expect(result.stats.chunks).toBeGreaterThanOrEqual(1);
    expect(result.stats.totalTokens).toBeGreaterThan(0);
  });

  it('uses the provided title', async () => {
    const result = await handlers.handleIngest({
      source: 'Some content for testing purposes.',
      title: 'My Custom Title',
    });
    expect(result.source.title).toBe('My Custom Title');
  });

  it('deduplicates identical sources', async () => {
    const text = 'Unique content for deduplication test.';
    const first = await handlers.handleIngest({ source: text });
    const second = await handlers.handleIngest({ source: text });
    expect(first.source.id).toBe(second.source.id);
    // Second call returns 0 chunks (already stored)
    expect(second.stats.chunks).toBe(0);
  });
});

// ── learnforge_sources ───────────────────────────────────────────────────

describe('LearnForgeHandlers.handleSources', () => {
  let handlers: LearnForgeHandlers;

  beforeEach(() => {
    handlers = createInMemoryHandlers();
  });

  it('returns empty array when no sources', () => {
    expect(handlers.handleSources()).toEqual([]);
  });

  it('returns sources after ingestion', async () => {
    await handlers.handleIngest({ source: 'Content A' });
    await handlers.handleIngest({ source: 'Content B different enough' });
    const sources = handlers.handleSources();
    expect(sources.length).toBe(2);
  });
});

// ── learnforge_learn ─────────────────────────────────────────────────────

describe('LearnForgeHandlers.handleLearn', () => {
  let handlers: LearnForgeHandlers;

  beforeEach(() => {
    handlers = createInMemoryHandlers();
  });

  it('returns session config for socratic mode', () => {
    const result = handlers.handleLearn({ mode: 'socratic', topic: 'FSRS' });
    expect(result.mode_name).toBe('socratic');
    expect(result.systemPrompt).toContain('FSRS');
    expect(result.description).toBeTruthy();
    expect(result.principle).toBeTruthy();
  });

  it('returns session config for feynman mode', () => {
    const result = handlers.handleLearn({ mode: 'feynman', topic: 'Machine Learning' });
    expect(result.mode_name).toBe('feynman');
    expect(result.systemPrompt).toContain('Machine Learning');
  });

  it('uses deck as fallback topic', () => {
    const result = handlers.handleLearn({ mode: 'quiz', deck: 'chemistry' });
    expect(result.systemPrompt).toContain('chemistry');
  });

  it('supports all 6 modes', () => {
    const modes = ['socratic', 'feynman', 'quiz', 'teach', 'explore', 'gap'] as const;
    for (const mode of modes) {
      const result = handlers.handleLearn({ mode, topic: 'test' });
      expect(result.mode_name).toBe(mode);
    }
  });
});

// ── learnforge_create_cards ───────────────────────────────────────────────

describe('LearnForgeHandlers.handleCreateCards', () => {
  let handlers: LearnForgeHandlers;

  beforeEach(() => {
    handlers = createInMemoryHandlers();
  });

  it('creates cards with FSRS initial state', () => {
    const created = handlers.handleCreateCards({
      cards: [
        { front: 'What is FSRS?', back: 'A spaced repetition algorithm.', cardType: 'basic' },
        { front: 'What is stability?', back: 'Memory durability measure.', cardType: 'concept' },
      ],
    });

    expect(created).toHaveLength(2);
    for (const card of created) {
      expect(card.id).toBeTruthy();
      expect(card.state).toBe(CardState.New);
      expect(card.difficulty).toBe(0);
      expect(card.stability).toBe(0);
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
    }
  });

  it('assigns deck if provided', () => {
    const created = handlers.handleCreateCards({
      cards: [{ front: 'Q', back: 'A', cardType: 'basic' }],
      deck: 'chemistry',
    });
    expect(created[0].deck).toBe('chemistry');
  });

  it('defaults deck to "default"', () => {
    const created = handlers.handleCreateCards({
      cards: [{ front: 'Q', back: 'A', cardType: 'basic' }],
    });
    expect(created[0].deck).toBe('default');
  });

  it('assigns tags when provided', () => {
    const created = handlers.handleCreateCards({
      cards: [{ front: 'Q', back: 'A', cardType: 'basic', tags: 'tag1,tag2' }],
    });
    expect(created[0].tags).toBe('tag1,tag2');
  });
});

// ── learnforge_review ────────────────────────────────────────────────────

describe('LearnForgeHandlers.handleReview', () => {
  let handlers: LearnForgeHandlers;

  beforeEach(() => {
    handlers = createInMemoryHandlers();
  });

  it('returns empty when no cards exist', () => {
    const result = handlers.handleReview({});
    expect(result.due_count).toBe(0);
    expect(result.new_count).toBe(0);
    expect(result.cards).toHaveLength(0);
  });

  it('includes new cards in review queue', () => {
    handlers.handleCreateCards({
      cards: [
        { front: 'Q1', back: 'A1', cardType: 'basic' },
        { front: 'Q2', back: 'A2', cardType: 'basic' },
      ],
    });
    const result = handlers.handleReview({});
    expect(result.new_count).toBe(2);
    expect(result.cards).toHaveLength(2);
  });

  it('filters by deck', () => {
    handlers.handleCreateCards({
      cards: [{ front: 'Q1', back: 'A1', cardType: 'basic' }],
      deck: 'math',
    });
    handlers.handleCreateCards({
      cards: [{ front: 'Q2', back: 'A2', cardType: 'basic' }],
      deck: 'science',
    });

    const mathResult = handlers.handleReview({ deck: 'math' });
    expect(mathResult.new_count).toBe(1);

    const scienceResult = handlers.handleReview({ deck: 'science' });
    expect(scienceResult.new_count).toBe(1);
  });

  it('respects limit', () => {
    handlers.handleCreateCards({
      cards: [
        { front: 'Q1', back: 'A1', cardType: 'basic' },
        { front: 'Q2', back: 'A2', cardType: 'basic' },
        { front: 'Q3', back: 'A3', cardType: 'basic' },
      ],
    });
    const result = handlers.handleReview({ limit: 2 });
    expect(result.cards.length).toBeLessThanOrEqual(2);
  });
});

// ── learnforge_answer ────────────────────────────────────────────────────

describe('LearnForgeHandlers.handleAnswer', () => {
  let handlers: LearnForgeHandlers;

  beforeEach(() => {
    handlers = createInMemoryHandlers();
  });

  it('throws when card not found', () => {
    expect(() =>
      handlers.handleAnswer({ cardId: 'nonexistent', rating: 3 }),
    ).toThrow('Card not found: nonexistent');
  });

  it('schedules a new card with Good rating', () => {
    const [card] = handlers.handleCreateCards({
      cards: [{ front: 'Q', back: 'A', cardType: 'basic' }],
    });

    const result = handlers.handleAnswer({ cardId: card.id, rating: 3 });
    expect(result.next_due).toBeTruthy();
    expect(result.new_stability).toBeGreaterThan(0);
    expect(result.interval).toBeGreaterThanOrEqual(0);
  });

  it('schedules a new card with Again rating (stays Learning)', () => {
    const [card] = handlers.handleCreateCards({
      cards: [{ front: 'Q', back: 'A', cardType: 'basic' }],
    });
    const result = handlers.handleAnswer({ cardId: card.id, rating: 1 });
    expect(result.next_due).toBeTruthy();
  });

  it('updates card state after answering', () => {
    const db = initDatabase(':memory:');
    const handlers2 = new LearnForgeHandlers(db);

    const [card] = handlers2.handleCreateCards({
      cards: [{ front: 'Q', back: 'A', cardType: 'basic' }],
    });

    handlers2.handleAnswer({ cardId: card.id, rating: 3 });

    // Verify by reviewing again — should be in review queue
    const review = handlers2.handleReview({});
    // After Good rating on new card, it graduates to Review state and is not "new" anymore
    expect(review.new_count).toBe(0);
  });
});

// ── learnforge_progress ───────────────────────────────────────────────────

describe('LearnForgeHandlers.handleProgress', () => {
  let handlers: LearnForgeHandlers;

  beforeEach(() => {
    handlers = createInMemoryHandlers();
  });

  it('returns overview with zero stats for empty db', () => {
    const result = handlers.handleProgress({ type: 'overview' }) as {
      total_cards: number;
      reviewed_today: number;
      retention_rate: number;
      due_today: number;
      new_cards: number;
      total_reviews: number;
    };
    expect(result.total_cards).toBe(0);
    expect(result.reviewed_today).toBe(0);
    expect(result.retention_rate).toBe(0);
  });

  it('counts cards after creation', () => {
    handlers.handleCreateCards({
      cards: [
        { front: 'Q1', back: 'A1', cardType: 'basic' },
        { front: 'Q2', back: 'A2', cardType: 'basic' },
      ],
    });
    const result = handlers.handleProgress({ type: 'overview' }) as {
      total_cards: number;
      new_cards: number;
    };
    expect(result.total_cards).toBe(2);
    expect(result.new_cards).toBe(2);
  });

  it('returns deck stats', () => {
    handlers.handleCreateCards({
      cards: [{ front: 'Q', back: 'A', cardType: 'basic' }],
      deck: 'math',
    });
    const result = handlers.handleProgress({ type: 'deck' }) as { decks: { deck: string; total: number }[] };
    expect(result.decks).toHaveLength(1);
    expect(result.decks[0].deck).toBe('math');
  });

  it('returns heatmap data', () => {
    const result = handlers.handleProgress({ type: 'heatmap', days: 7 }) as {
      heatmap: unknown[];
      days: number;
    };
    expect(result.days).toBe(7);
    expect(Array.isArray(result.heatmap)).toBe(true);
  });

  it('returns gaps data', () => {
    const result = handlers.handleProgress({ type: 'gaps' }) as { gaps: unknown[] };
    expect(Array.isArray(result.gaps)).toBe(true);
  });

  it('returns forecast data', () => {
    const result = handlers.handleProgress({ type: 'forecast', days: 5 }) as {
      forecast: unknown[];
      days: number;
    };
    expect(result.days).toBe(5);
    expect(result.forecast).toHaveLength(5);
  });

  it('defaults to overview when no type specified', () => {
    const result = handlers.handleProgress({}) as { total_cards: number };
    expect(typeof result.total_cards).toBe('number');
  });
});

// ── learnforge_export ────────────────────────────────────────────────────

describe('LearnForgeHandlers.handleExport', () => {
  let handlers: LearnForgeHandlers;

  beforeEach(() => {
    handlers = createInMemoryHandlers();
    handlers.handleCreateCards({
      cards: [
        { front: 'What is FSRS?', back: 'A spaced repetition algorithm', cardType: 'basic', tags: 'srs' },
        { front: 'What is stability?', back: 'Memory durability', cardType: 'concept', tags: 'memory' },
      ],
      deck: 'study',
    });
  });

  it('exports as TSV', () => {
    const result = handlers.handleExport({ format: 'tsv' });
    expect(result).toContain('front\tback\ttags\tdeck');
    expect(result).toContain('What is FSRS?');
  });

  it('exports as CSV', () => {
    const result = handlers.handleExport({ format: 'csv' });
    expect(result).toContain('"front","back","tags","deck"');
    expect(result).toContain('What is FSRS?');
  });

  it('exports as JSON', () => {
    const result = handlers.handleExport({ format: 'json' });
    const parsed = JSON.parse(result) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });

  it('exports as Mochi markdown', () => {
    const result = handlers.handleExport({ format: 'mochi_md' });
    expect(result).toContain('# What is FSRS?');
    expect(result).toContain('---');
  });

  it('filters by deck', () => {
    handlers.handleCreateCards({
      cards: [{ front: 'Other Q', back: 'Other A', cardType: 'basic' }],
      deck: 'other',
    });
    const result = handlers.handleExport({ format: 'json', deck: 'study' });
    const parsed = JSON.parse(result) as unknown[];
    expect(parsed).toHaveLength(2);
  });
});

// ── Resources ────────────────────────────────────────────────────────────

describe('LearnForgeHandlers resources', () => {
  let handlers: LearnForgeHandlers;

  beforeEach(() => {
    handlers = createInMemoryHandlers();
  });

  it('getStatus returns expected shape', () => {
    const status = handlers.getStatus() as {
      total_sources: number;
      total_cards: number;
      due_today: number;
    };
    expect(typeof status.total_sources).toBe('number');
    expect(typeof status.total_cards).toBe('number');
    expect(typeof status.due_today).toBe('number');
  });

  it('getDueCardsList returns array', () => {
    const cards = handlers.getDueCardsList();
    expect(Array.isArray(cards)).toBe(true);
  });

  it('getDueCardsList includes new cards', () => {
    handlers.handleCreateCards({
      cards: [{ front: 'Q', back: 'A', cardType: 'basic' }],
    });
    const cards = handlers.getDueCardsList();
    expect(cards).toHaveLength(1);
  });
});

// ── Integration: full flow ────────────────────────────────────────────────

describe('Integration', () => {
  it('full flow: ingest → create cards → review → answer → progress', async () => {
    const db = initDatabase(':memory:');
    const handlers = new LearnForgeHandlers(db);

    // 1. Ingest text
    const ingested = await handlers.handleIngest({
      source: 'The FSRS algorithm uses stability and difficulty to schedule reviews.',
      title: 'FSRS Overview',
    });
    expect(ingested.source.id).toBeTruthy();

    // 2. Create cards
    const cards = handlers.handleCreateCards({
      cards: [
        {
          front: 'What does FSRS stand for?',
          back: 'Free Spaced Repetition Scheduler',
          cardType: 'basic',
          tags: 'fsrs',
        },
        {
          front: 'What is stability in FSRS?',
          back: 'A measure of memory durability',
          cardType: 'concept',
          tags: 'fsrs,memory',
        },
      ],
      sourceId: ingested.source.id,
      deck: 'fsrs-deck',
    });
    expect(cards).toHaveLength(2);

    // 3. Get review cards (should include new cards)
    const review = handlers.handleReview({ deck: 'fsrs-deck' });
    expect(review.new_count).toBe(2);
    expect(review.cards).toHaveLength(2);

    // 4. Answer a card with Good (3)
    const card = review.cards[0];
    const answerResult = handlers.handleAnswer({ cardId: card.id, rating: 3 });
    expect(answerResult.new_stability).toBeGreaterThan(0);
    expect(answerResult.next_due).toBeTruthy();

    // 5. Check progress — one card reviewed
    const progress = handlers.handleProgress({ type: 'overview', deck: 'fsrs-deck' }) as {
      total_cards: number;
      reviewed_today: number;
      total_reviews: number;
      new_cards: number;
    };
    expect(progress.total_cards).toBe(2);
    expect(progress.reviewed_today).toBe(1);
    expect(progress.total_reviews).toBe(1);
    expect(progress.new_cards).toBe(1); // One card still new

    // 6. Export cards
    const tsv = handlers.handleExport({ format: 'tsv', deck: 'fsrs-deck' });
    expect(tsv).toContain('What does FSRS stand for?');

    const json = handlers.handleExport({ format: 'json', deck: 'fsrs-deck' });
    const parsed = JSON.parse(json) as unknown[];
    expect(parsed).toHaveLength(2);
  });
});
