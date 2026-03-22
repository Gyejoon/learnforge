import Database from 'better-sqlite3';
import type { Review } from '../types.js';
import { CardState, Rating } from '../types.js';

interface ReviewRow {
  id: string;
  card_id: string;
  rating: number;
  elapsed_days: number;
  scheduled_days: number;
  difficulty: number;
  stability: number;
  state: number;
  reviewed_at: string;
}

function rowToReview(row: ReviewRow): Review {
  return {
    id: row.id,
    cardId: row.card_id,
    rating: row.rating as Rating,
    elapsedDays: row.elapsed_days,
    scheduledDays: row.scheduled_days,
    difficulty: row.difficulty,
    stability: row.stability,
    state: row.state as CardState,
    reviewedAt: row.reviewed_at,
  };
}

export function insertReview(db: Database.Database, review: Review): void {
  db.prepare(`
    INSERT INTO reviews (id, card_id, rating, elapsed_days, scheduled_days, difficulty, stability, state, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    review.id,
    review.cardId,
    review.rating,
    review.elapsedDays,
    review.scheduledDays,
    review.difficulty,
    review.stability,
    review.state,
    review.reviewedAt,
  );
}

export function getReviewsByCard(db: Database.Database, cardId: string): Review[] {
  const rows = db.prepare(
    'SELECT * FROM reviews WHERE card_id = ? ORDER BY reviewed_at ASC'
  ).all(cardId) as ReviewRow[];
  return rows.map(rowToReview);
}
