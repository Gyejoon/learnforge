// Enums
export enum CardState { New = 0, Learning = 1, Review = 2, Relearning = 3 }
export enum Rating { Again = 1, Hard = 2, Good = 3, Easy = 4 }
export type SourceType = 'pdf' | 'markdown' | 'youtube' | 'url' | 'code' | 'text';
export type CardType = 'basic' | 'cloze' | 'code' | 'concept';
export type LearningMode = 'socratic' | 'feynman' | 'quiz' | 'teach' | 'explore' | 'gap';

// Data interfaces
export interface Source {
  id: string;
  title: string;
  type: SourceType;
  originalPath: string;
  contentHash: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Chunk {
  id: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  summary: string | null;
  keyConcepts: string | null;
}

export interface Card {
  id: string;
  sourceId: string;
  chunkId: string | null;
  deck: string;
  front: string;
  back: string;
  cardType: CardType;
  tags: string;
  // FSRS fields
  difficulty: number;
  stability: number;
  retrievability: number;
  state: CardState;
  due: string;
  lastReview: string | null;
  reps: number;
  lapses: number;
  createdAt: string;
}

export interface Review {
  id: string;
  cardId: string;
  rating: Rating;
  elapsedDays: number;
  scheduledDays: number;
  difficulty: number;
  stability: number;
  state: CardState;
  reviewedAt: string;
}

export interface Session {
  id: string;
  type: LearningMode;
  sourceIds: string;
  durationMs: number;
  cardsStudied: number;
  cardsCorrect: number;
  startedAt: string;
  endedAt: string | null;
}

export interface KnowledgeEntry {
  id: string;
  concept: string;
  confidence: number;
  lastTested: string | null;
  related: string;
}

export interface Setting {
  key: string;
  value: string;
}

// FSRS types
export interface FSRSParameters {
  w: number[];
  requestRetention: number;
  maximumInterval: number;
  enableFuzz: boolean;
}

export interface SchedulingResult {
  card: Card;
  review: Omit<Review, 'id'>;
}

// Session state persistence types
export type QuestionType = 'multiple_choice' | 'short_answer' | 'fill_blank' | 'true_false';
export type SessionStatus = 'active' | 'completed' | 'abandoned';

export interface QuestionRecord {
  questionText: string;
  questionType: QuestionType;
  userAnswer: string;
  correct: boolean;
  difficulty: 1 | 2 | 3;
  cardId: string | null;
  timestamp: string;
}

export interface SessionDifficulty {
  current: 1 | 2 | 3;
  consecutiveCorrect: number;
  consecutiveWrong: number;
}

export interface SessionScore {
  total: number;
  correct: number;
}

export interface SessionState {
  version: 1;
  sessionId: string;
  mode: LearningMode;
  topic: string;
  deck: string | null;
  difficulty: SessionDifficulty;
  score: SessionScore;
  questionsAsked: QuestionRecord[];
  reviewedCardIds: string[];
  modeSpecificState: Record<string, unknown>;
  startedAt: string;
  lastActivityAt: string;
  status: SessionStatus;
}
