import Database from 'better-sqlite3';
import type { Session } from '../types.js';
import type { LearningMode } from '../types.js';

interface SessionRow {
  id: string;
  type: string;
  source_ids: string;
  duration_ms: number;
  cards_studied: number;
  cards_correct: number;
  started_at: string;
  ended_at: string | null;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    type: row.type as LearningMode,
    sourceIds: row.source_ids,
    durationMs: row.duration_ms,
    cardsStudied: row.cards_studied,
    cardsCorrect: row.cards_correct,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

export function insertSession(db: Database.Database, session: Session): void {
  db.prepare(`
    INSERT INTO sessions (id, type, source_ids, duration_ms, cards_studied, cards_correct, started_at, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    session.id,
    session.type,
    session.sourceIds,
    session.durationMs,
    session.cardsStudied,
    session.cardsCorrect,
    session.startedAt,
    session.endedAt,
  );
}

export function getSessionById(db: Database.Database, id: string): Session | null {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  return row ? rowToSession(row) : null;
}

export function updateSessionEnd(
  db: Database.Database,
  id: string,
  endedAt: string,
  durationMs: number,
  cardsStudied: number,
  cardsCorrect: number,
): void {
  db.prepare(`
    UPDATE sessions
    SET ended_at = ?, duration_ms = ?, cards_studied = ?, cards_correct = ?
    WHERE id = ?
  `).run(endedAt, durationMs, cardsStudied, cardsCorrect, id);
}
