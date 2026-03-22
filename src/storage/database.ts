import Database from 'better-sqlite3';

export function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  // Performance and integrity settings
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      type         TEXT NOT NULL,
      original_path TEXT NOT NULL,
      content_hash TEXT NOT NULL UNIQUE,
      metadata     TEXT NOT NULL DEFAULT '{}',
      created_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id           TEXT PRIMARY KEY,
      source_id    TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      chunk_index  INTEGER NOT NULL,
      content      TEXT NOT NULL,
      token_count  INTEGER NOT NULL,
      summary      TEXT,
      key_concepts TEXT
    );

    CREATE TABLE IF NOT EXISTS cards (
      id             TEXT PRIMARY KEY,
      source_id      TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      chunk_id       TEXT REFERENCES chunks(id) ON DELETE SET NULL,
      deck           TEXT NOT NULL DEFAULT 'default',
      front          TEXT NOT NULL,
      back           TEXT NOT NULL,
      card_type      TEXT NOT NULL,
      tags           TEXT NOT NULL DEFAULT '',
      difficulty     REAL NOT NULL DEFAULT 0,
      stability      REAL NOT NULL DEFAULT 0,
      retrievability REAL NOT NULL DEFAULT 0,
      state          INTEGER NOT NULL DEFAULT 0,
      due            TEXT NOT NULL,
      last_review    TEXT,
      reps           INTEGER NOT NULL DEFAULT 0,
      lapses         INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id             TEXT PRIMARY KEY,
      card_id        TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      rating         INTEGER NOT NULL,
      elapsed_days   REAL NOT NULL,
      scheduled_days REAL NOT NULL,
      difficulty     REAL NOT NULL,
      stability      REAL NOT NULL,
      state          INTEGER NOT NULL,
      reviewed_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id            TEXT PRIMARY KEY,
      type          TEXT NOT NULL,
      source_ids    TEXT NOT NULL DEFAULT '[]',
      duration_ms   INTEGER NOT NULL DEFAULT 0,
      cards_studied INTEGER NOT NULL DEFAULT 0,
      cards_correct INTEGER NOT NULL DEFAULT 0,
      started_at    TEXT NOT NULL,
      ended_at      TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_map (
      id          TEXT NOT NULL,
      concept     TEXT PRIMARY KEY,
      confidence  REAL NOT NULL DEFAULT 0,
      last_tested TEXT,
      related     TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_source_id
      ON chunks(source_id);

    CREATE INDEX IF NOT EXISTS idx_cards_due_deck_state
      ON cards(due, deck, state);

    CREATE INDEX IF NOT EXISTS idx_reviews_card_reviewed
      ON reviews(card_id, reviewed_at);

    CREATE INDEX IF NOT EXISTS idx_knowledge_concept
      ON knowledge_map(concept);
  `);

  return db;
}
