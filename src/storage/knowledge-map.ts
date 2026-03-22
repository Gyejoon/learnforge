import Database from 'better-sqlite3';
import type { KnowledgeEntry } from '../types.js';

interface KnowledgeRow {
  id: string;
  concept: string;
  confidence: number;
  last_tested: string | null;
  related: string;
}

function rowToEntry(row: KnowledgeRow): KnowledgeEntry {
  return {
    id: row.id,
    concept: row.concept,
    confidence: row.confidence,
    lastTested: row.last_tested,
    related: row.related,
  };
}

export function upsertKnowledgeEntry(db: Database.Database, entry: KnowledgeEntry): void {
  db.prepare(`
    INSERT INTO knowledge_map (id, concept, confidence, last_tested, related)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(concept) DO UPDATE SET
      id          = excluded.id,
      confidence  = excluded.confidence,
      last_tested = excluded.last_tested,
      related     = excluded.related
  `).run(
    entry.id,
    entry.concept,
    entry.confidence,
    entry.lastTested,
    entry.related,
  );
}

export function getKnowledgeEntry(db: Database.Database, concept: string): KnowledgeEntry | null {
  const row = db.prepare(
    'SELECT * FROM knowledge_map WHERE concept = ?'
  ).get(concept) as KnowledgeRow | undefined;
  return row ? rowToEntry(row) : null;
}

export function getAllKnowledgeEntries(db: Database.Database): KnowledgeEntry[] {
  const rows = db.prepare('SELECT * FROM knowledge_map ORDER BY concept ASC').all() as KnowledgeRow[];
  return rows.map(rowToEntry);
}
