import Database from 'better-sqlite3';
import type { Chunk } from '../types.js';

interface ChunkRow {
  id: string;
  source_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  summary: string | null;
  key_concepts: string | null;
}

function rowToChunk(row: ChunkRow): Chunk {
  return {
    id: row.id,
    sourceId: row.source_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    tokenCount: row.token_count,
    summary: row.summary,
    keyConcepts: row.key_concepts,
  };
}

export function insertChunk(db: Database.Database, chunk: Chunk): void {
  db.prepare(`
    INSERT INTO chunks (id, source_id, chunk_index, content, token_count, summary, key_concepts)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    chunk.id,
    chunk.sourceId,
    chunk.chunkIndex,
    chunk.content,
    chunk.tokenCount,
    chunk.summary,
    chunk.keyConcepts,
  );
}

export function getChunkById(db: Database.Database, id: string): Chunk | null {
  const row = db.prepare('SELECT * FROM chunks WHERE id = ?').get(id) as ChunkRow | undefined;
  return row ? rowToChunk(row) : null;
}

export function getChunksBySource(db: Database.Database, sourceId: string): Chunk[] {
  const rows = db.prepare(
    'SELECT * FROM chunks WHERE source_id = ? ORDER BY chunk_index ASC'
  ).all(sourceId) as ChunkRow[];
  return rows.map(rowToChunk);
}
