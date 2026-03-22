import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabase } from './database.js';
import { insertSource, getSourceById, getSourceByHash, getAllSources, deleteSource } from './sources.js';
import { insertChunk, getChunksBySource, getChunkById } from './chunks.js';
import { insertCard, getCardById, updateCard, getCardsByDeck, getDueCards, getNewCards } from './cards.js';
import { insertReview, getReviewsByCard } from './reviews.js';
import { insertSession, getSessionById, updateSessionEnd } from './sessions.js';
import { upsertKnowledgeEntry, getKnowledgeEntry } from './knowledge-map.js';
import { getSetting, setSetting } from './settings.js';
import type { Source, Chunk, Card, Review, Session, KnowledgeEntry } from '../types.js';
import { CardState, Rating } from '../types.js';

// ─── Database ────────────────────────────────────────────────────────────────

describe('Database', () => {
  let db: Database.Database;
  beforeEach(() => { db = initDatabase(':memory:'); });

  it('creates all 7 tables', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    const names = tables.map(t => t.name);
    expect(names).toContain('sources');
    expect(names).toContain('chunks');
    expect(names).toContain('cards');
    expect(names).toContain('reviews');
    expect(names).toContain('sessions');
    expect(names).toContain('knowledge_map');
    expect(names).toContain('settings');
  });
});

// ─── Sources ─────────────────────────────────────────────────────────────────

describe('Sources', () => {
  let db: Database.Database;
  beforeEach(() => { db = initDatabase(':memory:'); });

  const makeSource = (overrides: Partial<Source> = {}): Source => ({
    id: crypto.randomUUID(),
    title: 'Test Source',
    type: 'markdown',
    originalPath: '/tmp/test.md',
    contentHash: crypto.randomUUID(),
    metadata: { pages: 10 },
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  it('inserts and retrieves a source', () => {
    const source = makeSource();
    insertSource(db, source);
    const retrieved = getSourceById(db, source.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(source.id);
    expect(retrieved!.title).toBe(source.title);
    expect(retrieved!.type).toBe(source.type);
    expect(retrieved!.originalPath).toBe(source.originalPath);
    expect(retrieved!.contentHash).toBe(source.contentHash);
    expect(retrieved!.metadata).toEqual(source.metadata);
  });

  it('finds source by content hash', () => {
    const source = makeSource({ contentHash: 'abc123hash' });
    insertSource(db, source);
    const found = getSourceByHash(db, 'abc123hash');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(source.id);
  });

  it('returns null for unknown hash', () => {
    const result = getSourceByHash(db, 'nonexistent');
    expect(result).toBeNull();
  });

  it('lists all sources', () => {
    const s1 = makeSource({ id: 'id-1', contentHash: 'hash-1' });
    const s2 = makeSource({ id: 'id-2', contentHash: 'hash-2' });
    insertSource(db, s1);
    insertSource(db, s2);
    const all = getAllSources(db);
    expect(all).toHaveLength(2);
  });

  it('deletes a source', () => {
    const source = makeSource();
    insertSource(db, source);
    deleteSource(db, source.id);
    expect(getSourceById(db, source.id)).toBeNull();
  });
});

// ─── Chunks ──────────────────────────────────────────────────────────────────

describe('Chunks', () => {
  let db: Database.Database;
  let sourceId: string;
  beforeEach(() => {
    db = initDatabase(':memory:');
    sourceId = crypto.randomUUID();
    insertSource(db, {
      id: sourceId,
      title: 'Parent Source',
      type: 'text',
      originalPath: '/tmp/parent.txt',
      contentHash: crypto.randomUUID(),
      metadata: {},
      createdAt: new Date().toISOString(),
    });
  });

  const makeChunk = (overrides: Partial<Chunk> = {}): Chunk => ({
    id: crypto.randomUUID(),
    sourceId,
    chunkIndex: 0,
    content: 'Hello world chunk content',
    tokenCount: 10,
    summary: null,
    keyConcepts: null,
    ...overrides,
  });

  it('inserts and retrieves a chunk by id', () => {
    const chunk = makeChunk();
    insertChunk(db, chunk);
    const retrieved = getChunkById(db, chunk.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(chunk.id);
    expect(retrieved!.content).toBe(chunk.content);
    expect(retrieved!.sourceId).toBe(sourceId);
  });

  it('retrieves chunks by source', () => {
    insertChunk(db, makeChunk({ id: crypto.randomUUID(), chunkIndex: 0 }));
    insertChunk(db, makeChunk({ id: crypto.randomUUID(), chunkIndex: 1 }));
    const chunks = getChunksBySource(db, sourceId);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);
  });

  it('returns null for unknown chunk id', () => {
    expect(getChunkById(db, 'nope')).toBeNull();
  });
});

// ─── Cards ───────────────────────────────────────────────────────────────────

describe('Cards', () => {
  let db: Database.Database;
  let sourceId: string;
  beforeEach(() => {
    db = initDatabase(':memory:');
    sourceId = crypto.randomUUID();
    insertSource(db, {
      id: sourceId,
      title: 'Source',
      type: 'text',
      originalPath: '/tmp/s.txt',
      contentHash: crypto.randomUUID(),
      metadata: {},
      createdAt: new Date().toISOString(),
    });
  });

  const makeCard = (overrides: Partial<Card> = {}): Card => ({
    id: crypto.randomUUID(),
    sourceId,
    chunkId: null,
    deck: 'default',
    front: 'What is X?',
    back: 'X is Y.',
    cardType: 'basic',
    tags: '',
    difficulty: 0,
    stability: 0,
    retrievability: 0,
    state: CardState.New,
    due: new Date().toISOString(),
    lastReview: null,
    reps: 0,
    lapses: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  it('inserts and retrieves a card', () => {
    const card = makeCard();
    insertCard(db, card);
    const retrieved = getCardById(db, card.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(card.id);
    expect(retrieved!.front).toBe(card.front);
    expect(retrieved!.state).toBe(CardState.New);
  });

  it('updates a card', () => {
    const card = makeCard();
    insertCard(db, card);
    const updated: Card = { ...card, state: CardState.Review, reps: 3, stability: 5.5 };
    updateCard(db, updated);
    const retrieved = getCardById(db, card.id);
    expect(retrieved!.state).toBe(CardState.Review);
    expect(retrieved!.reps).toBe(3);
    expect(retrieved!.stability).toBe(5.5);
  });

  it('retrieves cards by deck', () => {
    insertCard(db, makeCard({ id: crypto.randomUUID(), deck: 'spanish' }));
    insertCard(db, makeCard({ id: crypto.randomUUID(), deck: 'spanish' }));
    insertCard(db, makeCard({ id: crypto.randomUUID(), deck: 'math' }));
    const spanish = getCardsByDeck(db, 'spanish');
    expect(spanish).toHaveLength(2);
  });

  it('getDueCards returns Learning/Review/Relearning cards due now', () => {
    const past = new Date(Date.now() - 10000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();

    insertCard(db, makeCard({ id: 'c1', state: CardState.New, due: past }));
    insertCard(db, makeCard({ id: 'c2', state: CardState.Learning, due: past }));
    insertCard(db, makeCard({ id: 'c3', state: CardState.Review, due: past }));
    insertCard(db, makeCard({ id: 'c4', state: CardState.Relearning, due: past }));
    insertCard(db, makeCard({ id: 'c5', state: CardState.Review, due: future }));

    const due = getDueCards(db, new Date().toISOString());
    // Should include Learning(1), Review(2), Relearning(3) — NOT New(0), NOT future
    const ids = due.map(c => c.id);
    expect(ids).not.toContain('c1');
    expect(ids).toContain('c2');
    expect(ids).toContain('c3');
    expect(ids).toContain('c4');
    expect(ids).not.toContain('c5');
  });

  it('getNewCards returns only New state cards', () => {
    insertCard(db, makeCard({ id: 'n1', state: CardState.New }));
    insertCard(db, makeCard({ id: 'n2', state: CardState.New }));
    insertCard(db, makeCard({ id: 'r1', state: CardState.Review }));

    const newCards = getNewCards(db);
    const ids = newCards.map(c => c.id);
    expect(ids).toContain('n1');
    expect(ids).toContain('n2');
    expect(ids).not.toContain('r1');
  });

  it('getDueCards respects deck filter', () => {
    const past = new Date(Date.now() - 10000).toISOString();
    insertCard(db, makeCard({ id: 'a1', deck: 'alpha', state: CardState.Review, due: past }));
    insertCard(db, makeCard({ id: 'b1', deck: 'beta', state: CardState.Review, due: past }));

    const due = getDueCards(db, new Date().toISOString(), 'alpha');
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe('a1');
  });

  it('getDueCards respects limit', () => {
    const past = new Date(Date.now() - 10000).toISOString();
    for (let i = 0; i < 5; i++) {
      insertCard(db, makeCard({ id: `card-${i}`, state: CardState.Review, due: past }));
    }
    const due = getDueCards(db, new Date().toISOString(), undefined, 3);
    expect(due).toHaveLength(3);
  });
});

// ─── Reviews ─────────────────────────────────────────────────────────────────

describe('Reviews', () => {
  let db: Database.Database;
  let cardId: string;
  beforeEach(() => {
    db = initDatabase(':memory:');
    const sourceId = crypto.randomUUID();
    insertSource(db, {
      id: sourceId,
      title: 'S',
      type: 'text',
      originalPath: '/tmp/s.txt',
      contentHash: crypto.randomUUID(),
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    cardId = crypto.randomUUID();
    insertCard(db, {
      id: cardId,
      sourceId,
      chunkId: null,
      deck: 'default',
      front: 'Q',
      back: 'A',
      cardType: 'basic',
      tags: '',
      difficulty: 0,
      stability: 0,
      retrievability: 0,
      state: CardState.New,
      due: new Date().toISOString(),
      lastReview: null,
      reps: 0,
      lapses: 0,
      createdAt: new Date().toISOString(),
    });
  });

  const makeReview = (overrides: Partial<Review> = {}): Review => ({
    id: crypto.randomUUID(),
    cardId,
    rating: Rating.Good,
    elapsedDays: 1,
    scheduledDays: 3,
    difficulty: 5.5,
    stability: 3.2,
    state: CardState.Review,
    reviewedAt: new Date().toISOString(),
    ...overrides,
  });

  it('inserts and retrieves reviews by card', () => {
    const r1 = makeReview();
    const r2 = makeReview({ id: crypto.randomUUID(), rating: Rating.Hard });
    insertReview(db, r1);
    insertReview(db, r2);
    const reviews = getReviewsByCard(db, cardId);
    expect(reviews).toHaveLength(2);
    expect(reviews.map(r => r.cardId)).toEqual([cardId, cardId]);
  });

  it('returns empty array for card with no reviews', () => {
    expect(getReviewsByCard(db, 'nonexistent')).toEqual([]);
  });
});

// ─── Sessions ─────────────────────────────────────────────────────────────────

describe('Sessions', () => {
  let db: Database.Database;
  beforeEach(() => { db = initDatabase(':memory:'); });

  const makeSession = (overrides: Partial<Session> = {}): Session => ({
    id: crypto.randomUUID(),
    type: 'quiz',
    sourceIds: '["src-1","src-2"]',
    durationMs: 0,
    cardsStudied: 0,
    cardsCorrect: 0,
    startedAt: new Date().toISOString(),
    endedAt: null,
    ...overrides,
  });

  it('inserts and retrieves a session', () => {
    const session = makeSession();
    insertSession(db, session);
    const retrieved = getSessionById(db, session.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(session.id);
    expect(retrieved!.type).toBe('quiz');
    expect(retrieved!.endedAt).toBeNull();
  });

  it('updates session end time', () => {
    const session = makeSession();
    insertSession(db, session);
    const endedAt = new Date().toISOString();
    updateSessionEnd(db, session.id, endedAt, 5000, 10, 8);
    const retrieved = getSessionById(db, session.id);
    expect(retrieved!.endedAt).toBe(endedAt);
    expect(retrieved!.durationMs).toBe(5000);
    expect(retrieved!.cardsStudied).toBe(10);
    expect(retrieved!.cardsCorrect).toBe(8);
  });
});

// ─── KnowledgeMap ─────────────────────────────────────────────────────────────

describe('KnowledgeMap', () => {
  let db: Database.Database;
  beforeEach(() => { db = initDatabase(':memory:'); });

  const makeEntry = (overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry => ({
    id: crypto.randomUUID(),
    concept: 'recursion',
    confidence: 0.5,
    lastTested: null,
    related: '["iteration","stack"]',
    ...overrides,
  });

  it('upserts and retrieves entries', () => {
    const entry = makeEntry();
    upsertKnowledgeEntry(db, entry);
    const retrieved = getKnowledgeEntry(db, entry.concept);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.concept).toBe('recursion');
    expect(retrieved!.confidence).toBe(0.5);
  });

  it('updates existing entry on upsert', () => {
    const entry = makeEntry();
    upsertKnowledgeEntry(db, entry);
    upsertKnowledgeEntry(db, { ...entry, confidence: 0.9, lastTested: new Date().toISOString() });
    const retrieved = getKnowledgeEntry(db, entry.concept);
    expect(retrieved!.confidence).toBe(0.9);
    expect(retrieved!.lastTested).not.toBeNull();
  });

  it('returns null for unknown concept', () => {
    expect(getKnowledgeEntry(db, 'unknown')).toBeNull();
  });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

describe('Settings', () => {
  let db: Database.Database;
  beforeEach(() => { db = initDatabase(':memory:'); });

  it('sets and gets a value', () => {
    setSetting(db, 'theme', 'dark');
    expect(getSetting(db, 'theme')).toBe('dark');
  });

  it('upserts existing key', () => {
    setSetting(db, 'theme', 'dark');
    setSetting(db, 'theme', 'light');
    expect(getSetting(db, 'theme')).toBe('light');
  });

  it('returns null for unknown key', () => {
    expect(getSetting(db, 'nonexistent')).toBeNull();
  });
});
