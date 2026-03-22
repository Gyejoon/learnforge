import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type { LearningMode, SessionState } from '../types.js';

function resolveSessionDir(): string {
  const dir = path.join(os.homedir(), '.learnforge', 'sessions');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function resolveSessionPath(sessionId: string): string {
  return path.join(resolveSessionDir(), `${sessionId}.json`);
}

export function createSessionState(params: {
  mode: LearningMode;
  topic: string;
  deck?: string;
}): SessionState {
  const now = new Date().toISOString();
  // quiz starts at level 2, gap at level 1, others default to level 1
  const initialLevel: 1 | 2 | 3 = params.mode === 'quiz' ? 2 : 1;

  return {
    version: 1,
    sessionId: crypto.randomUUID(),
    mode: params.mode,
    topic: params.topic,
    deck: params.deck ?? null,
    difficulty: {
      current: initialLevel,
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
    },
    score: {
      total: 0,
      correct: 0,
    },
    questionsAsked: [],
    reviewedCardIds: [],
    modeSpecificState: {},
    startedAt: now,
    lastActivityAt: now,
    status: 'active',
  };
}

export function saveSessionState(state: SessionState): void {
  const filePath = resolveSessionPath(state.sessionId);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

export function loadSessionState(sessionId: string): SessionState | null {
  const filePath = resolveSessionPath(sessionId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as SessionState;
}

export function getActiveSession(mode?: LearningMode, topic?: string): SessionState | null {
  const sessions = listSessions('active');
  const filtered = sessions.filter((s) => {
    if (mode !== undefined && s.mode !== mode) return false;
    if (topic !== undefined && s.topic !== topic) return false;
    return true;
  });

  if (filtered.length === 0) return null;

  // Return most recent by lastActivityAt
  filtered.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  return filtered[0];
}

export function listSessions(status?: string): SessionState[] {
  const dir = resolveSessionDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const sessions: SessionState[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    try {
      const state = JSON.parse(raw) as SessionState;
      if (status === undefined || state.status === status) {
        sessions.push(state);
      }
    } catch {
      // Skip malformed files
    }
  }

  sessions.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  return sessions;
}

export function deleteSession(sessionId: string): boolean {
  const filePath = resolveSessionPath(sessionId);
  if (!fs.existsSync(filePath)) {
    return false;
  }
  fs.unlinkSync(filePath);
  return true;
}
