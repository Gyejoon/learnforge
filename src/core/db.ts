import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type Database from 'better-sqlite3';
import { initDatabase } from '../storage/index.js';

export function resolveDbPath(): string {
  return (
    process.env.LEARNFORGE_DB ??
    path.join(os.homedir(), '.learnforge', 'learnforge.db')
  );
}

export function createDatabase(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? resolveDbPath();
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return initDatabase(resolvedPath);
}
