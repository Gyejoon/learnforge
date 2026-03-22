import Database from 'better-sqlite3';
import type { Source } from '../types.js';

interface SourceRow {
  id: string;
  title: string;
  type: string;
  original_path: string;
  content_hash: string;
  metadata: string;
  created_at: string;
}

function rowToSource(row: SourceRow): Source {
  return {
    id: row.id,
    title: row.title,
    type: row.type as Source['type'],
    originalPath: row.original_path,
    contentHash: row.content_hash,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

export function insertSource(db: Database.Database, source: Source): void {
  db.prepare(`
    INSERT INTO sources (id, title, type, original_path, content_hash, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    source.id,
    source.title,
    source.type,
    source.originalPath,
    source.contentHash,
    JSON.stringify(source.metadata),
    source.createdAt,
  );
}

export function getSourceById(db: Database.Database, id: string): Source | null {
  const row = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as SourceRow | undefined;
  return row ? rowToSource(row) : null;
}

export function getSourceByHash(db: Database.Database, hash: string): Source | null {
  const row = db.prepare('SELECT * FROM sources WHERE content_hash = ?').get(hash) as SourceRow | undefined;
  return row ? rowToSource(row) : null;
}

export function getAllSources(db: Database.Database): Source[] {
  const rows = db.prepare('SELECT * FROM sources ORDER BY created_at DESC').all() as SourceRow[];
  return rows.map(rowToSource);
}

export function deleteSource(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM sources WHERE id = ?').run(id);
}
