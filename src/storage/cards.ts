import Database from 'better-sqlite3';
import type { Card } from '../types.js';
import { CardState } from '../types.js';

interface CardRow {
  id: string;
  source_id: string;
  chunk_id: string | null;
  deck: string;
  front: string;
  back: string;
  card_type: string;
  tags: string;
  difficulty: number;
  stability: number;
  retrievability: number;
  state: number;
  due: string;
  last_review: string | null;
  reps: number;
  lapses: number;
  created_at: string;
}

function rowToCard(row: CardRow): Card {
  return {
    id: row.id,
    sourceId: row.source_id,
    chunkId: row.chunk_id,
    deck: row.deck,
    front: row.front,
    back: row.back,
    cardType: row.card_type as Card['cardType'],
    tags: row.tags,
    difficulty: row.difficulty,
    stability: row.stability,
    retrievability: row.retrievability,
    state: row.state as CardState,
    due: row.due,
    lastReview: row.last_review,
    reps: row.reps,
    lapses: row.lapses,
    createdAt: row.created_at,
  };
}

export function insertCard(db: Database.Database, card: Card): void {
  db.prepare(`
    INSERT INTO cards (
      id, source_id, chunk_id, deck, front, back, card_type, tags,
      difficulty, stability, retrievability, state, due, last_review,
      reps, lapses, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    card.id,
    card.sourceId,
    card.chunkId,
    card.deck,
    card.front,
    card.back,
    card.cardType,
    card.tags,
    card.difficulty,
    card.stability,
    card.retrievability,
    card.state,
    card.due,
    card.lastReview,
    card.reps,
    card.lapses,
    card.createdAt,
  );
}

export function getCardById(db: Database.Database, id: string): Card | null {
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow | undefined;
  return row ? rowToCard(row) : null;
}

export function updateCard(db: Database.Database, card: Card): void {
  db.prepare(`
    UPDATE cards SET
      deck = ?, front = ?, back = ?, card_type = ?, tags = ?,
      difficulty = ?, stability = ?, retrievability = ?, state = ?,
      due = ?, last_review = ?, reps = ?, lapses = ?
    WHERE id = ?
  `).run(
    card.deck,
    card.front,
    card.back,
    card.cardType,
    card.tags,
    card.difficulty,
    card.stability,
    card.retrievability,
    card.state,
    card.due,
    card.lastReview,
    card.reps,
    card.lapses,
    card.id,
  );
}

export function getCardsByDeck(db: Database.Database, deck: string): Card[] {
  const rows = db.prepare(
    'SELECT * FROM cards WHERE deck = ? ORDER BY created_at ASC'
  ).all(deck) as CardRow[];
  return rows.map(rowToCard);
}

export function getDueCards(
  db: Database.Database,
  now: string,
  deck?: string,
  limit?: number
): Card[] {
  const dueStates = [CardState.Learning, CardState.Review, CardState.Relearning];
  const placeholders = dueStates.map(() => '?').join(', ');

  let sql = `SELECT * FROM cards WHERE due <= ? AND state IN (${placeholders})`;
  const params: (string | number)[] = [now, ...dueStates];

  if (deck !== undefined) {
    sql += ' AND deck = ?';
    params.push(deck);
  }

  sql += ' ORDER BY due ASC';

  if (limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const rows = db.prepare(sql).all(...params) as CardRow[];
  return rows.map(rowToCard);
}

export function getNewCards(
  db: Database.Database,
  deck?: string,
  limit?: number
): Card[] {
  let sql = 'SELECT * FROM cards WHERE state = ?';
  const params: (string | number)[] = [CardState.New];

  if (deck !== undefined) {
    sql += ' AND deck = ?';
    params.push(deck);
  }

  sql += ' ORDER BY created_at ASC';

  if (limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const rows = db.prepare(sql).all(...params) as CardRow[];
  return rows.map(rowToCard);
}
