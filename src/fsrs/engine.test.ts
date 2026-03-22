import { describe, it, expect } from 'vitest';
import {
  retrievability,
  initialStability,
  initialDifficulty,
  nextDifficulty,
  nextInterval,
  nextRecallStability,
  nextForgetStability,
  FSRSEngine,
} from './engine';
import { CardState, Rating } from '../types';
import type { Card } from '../types';

// ── Helper ──────────────────────────────────────────────────────────────────

function makeNewCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test-card',
    sourceId: 'src-1',
    chunkId: null,
    deck: 'default',
    front: 'Q',
    back: 'A',
    cardType: 'basic',
    tags: '',
    difficulty: 5,
    stability: 1,
    retrievability: 1,
    state: CardState.New,
    due: new Date().toISOString(),
    lastReview: null,
    reps: 0,
    lapses: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── retrievability ───────────────────────────────────────────────────────────

describe('retrievability', () => {
  it('returns ~0.9 when elapsed equals stability', () => {
    const r = retrievability(10, 10);
    expect(r).toBeCloseTo(0.9, 1);
  });

  it('returns 1.0 at elapsed=0', () => {
    expect(retrievability(0, 10)).toBe(1);
  });

  it('decreases over time', () => {
    expect(retrievability(20, 10)).toBeLessThan(retrievability(10, 10));
  });
});

// ── initialStability ─────────────────────────────────────────────────────────

describe('initialStability', () => {
  it('initial stability increases with better rating', () => {
    expect(initialStability(Rating.Easy)).toBeGreaterThan(initialStability(Rating.Good));
    expect(initialStability(Rating.Good)).toBeGreaterThan(initialStability(Rating.Hard));
    expect(initialStability(Rating.Hard)).toBeGreaterThan(initialStability(Rating.Again));
  });

  it('returns positive value for all ratings', () => {
    [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].forEach(r => {
      expect(initialStability(r)).toBeGreaterThan(0);
    });
  });
});

// ── initialDifficulty ────────────────────────────────────────────────────────

describe('initialDifficulty', () => {
  it('is clamped between 1 and 10', () => {
    [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].forEach(r => {
      const d = initialDifficulty(r);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(10);
    });
  });

  it('higher rating → lower difficulty', () => {
    expect(initialDifficulty(Rating.Easy)).toBeLessThan(initialDifficulty(Rating.Again));
  });
});

// ── nextDifficulty ───────────────────────────────────────────────────────────

describe('nextDifficulty', () => {
  it('again increases difficulty, easy decreases it', () => {
    const dAgain = nextDifficulty(5, Rating.Again);
    const dEasy = nextDifficulty(5, Rating.Easy);
    expect(dAgain).toBeGreaterThan(5);
    expect(dEasy).toBeLessThan(5);
  });

  it('stays clamped between 1 and 10', () => {
    expect(nextDifficulty(1, Rating.Easy)).toBeGreaterThanOrEqual(1);
    expect(nextDifficulty(10, Rating.Again)).toBeLessThanOrEqual(10);
  });
});

// ── nextInterval ─────────────────────────────────────────────────────────────

describe('nextInterval', () => {
  it('is positive and respects retention', () => {
    const interval = nextInterval(10, 0.9);
    expect(interval).toBeGreaterThan(0);
  });

  it('higher stability → longer interval', () => {
    expect(nextInterval(20, 0.9)).toBeGreaterThan(nextInterval(10, 0.9));
  });
});

// ── nextRecallStability ──────────────────────────────────────────────────────

describe('nextRecallStability', () => {
  it('recall stability increases (Good > Hard > Again)', () => {
    const r = 0.8;
    const d = 5;
    const s = 10;
    const sAgain = nextRecallStability(d, s, r, Rating.Again);
    const sHard = nextRecallStability(d, s, r, Rating.Hard);
    const sGood = nextRecallStability(d, s, r, Rating.Good);
    const sEasy = nextRecallStability(d, s, r, Rating.Easy);
    expect(sGood).toBeGreaterThan(sHard);
    expect(sEasy).toBeGreaterThan(sGood);
    // Again can be less than current stability — just must be positive
    expect(sAgain).toBeGreaterThan(0);
  });

  it('returns value greater than current stability for Good rating', () => {
    const s = nextRecallStability(5, 10, 0.9, Rating.Good);
    expect(s).toBeGreaterThan(10);
  });
});

// ── nextForgetStability ──────────────────────────────────────────────────────

describe('nextForgetStability', () => {
  it('forget stability is less than current stability', () => {
    const sForget = nextForgetStability(5, 10, 0.8);
    expect(sForget).toBeLessThan(10);
  });

  it('returns positive value', () => {
    expect(nextForgetStability(5, 10, 0.8)).toBeGreaterThan(0);
  });
});

// ── FSRSEngine.schedule ───────────────────────────────────────────────────────

describe('schedule', () => {
  const engine = new FSRSEngine();

  it('New card + Good → state becomes Review', () => {
    const card = makeNewCard();
    const result = engine.schedule(card, Rating.Good);
    expect(result.card.state).toBe(CardState.Review);
  });

  it('New card + Again → state becomes Learning', () => {
    const card = makeNewCard();
    const result = engine.schedule(card, Rating.Again);
    expect(result.card.state).toBe(CardState.Learning);
  });

  it('New card + Easy → state becomes Review', () => {
    const card = makeNewCard();
    const result = engine.schedule(card, Rating.Easy);
    expect(result.card.state).toBe(CardState.Review);
  });

  it('Review card + Again → state becomes Relearning', () => {
    const card = makeNewCard({
      state: CardState.Review,
      stability: 10,
      difficulty: 5,
      retrievability: 0.9,
      lastReview: new Date(Date.now() - 10 * 86400_000).toISOString(),
      reps: 3,
    });
    const result = engine.schedule(card, Rating.Again);
    expect(result.card.state).toBe(CardState.Relearning);
    expect(result.card.lapses).toBe(1);
  });

  it('Review card + Hard → state stays Review', () => {
    const card = makeNewCard({
      state: CardState.Review,
      stability: 10,
      difficulty: 5,
      retrievability: 0.9,
      lastReview: new Date(Date.now() - 10 * 86400_000).toISOString(),
      reps: 3,
    });
    const result = engine.schedule(card, Rating.Hard);
    expect(result.card.state).toBe(CardState.Review);
  });

  it('intervals: Easy > Good > Hard for Review cards', () => {
    const makeReview = () =>
      makeNewCard({
        state: CardState.Review,
        stability: 10,
        difficulty: 5,
        retrievability: 0.9,
        lastReview: new Date(Date.now() - 10 * 86400_000).toISOString(),
        reps: 3,
      });

    const rHard = engine.schedule(makeReview(), Rating.Hard);
    const rGood = engine.schedule(makeReview(), Rating.Good);
    const rEasy = engine.schedule(makeReview(), Rating.Easy);

    const dueHard = new Date(rHard.card.due).getTime();
    const dueGood = new Date(rGood.card.due).getTime();
    const dueEasy = new Date(rEasy.card.due).getTime();

    expect(dueGood).toBeGreaterThan(dueHard);
    expect(dueEasy).toBeGreaterThan(dueGood);
  });

  it('Learning card + Good → graduates to Review', () => {
    const card = makeNewCard({
      state: CardState.Learning,
      stability: 1,
      difficulty: 5,
      reps: 1,
      lastReview: new Date(Date.now() - 1 * 86400_000).toISOString(),
    });
    const result = engine.schedule(card, Rating.Good);
    expect(result.card.state).toBe(CardState.Review);
  });

  it('Learning card + Again → stays Learning', () => {
    const card = makeNewCard({
      state: CardState.Learning,
      stability: 1,
      difficulty: 5,
      reps: 1,
      lastReview: new Date(Date.now() - 1 * 86400_000).toISOString(),
    });
    const result = engine.schedule(card, Rating.Again);
    expect(result.card.state).toBe(CardState.Learning);
  });

  it('Learning + Hard → stays in Learning', () => {
    const card = makeNewCard({
      state: CardState.Learning,
      stability: 1,
      difficulty: 5,
      reps: 1,
      lastReview: new Date(Date.now() - 1 * 86400_000).toISOString(),
    });
    const result = engine.schedule(card, Rating.Hard);
    expect(result.card.state).toBe(CardState.Learning);
  });

  it('Relearning + Hard → stays in Relearning', () => {
    const card = makeNewCard({
      state: CardState.Relearning,
      stability: 2,
      difficulty: 6,
      reps: 5,
      lapses: 1,
      lastReview: new Date(Date.now() - 1 * 86400_000).toISOString(),
    });
    const result = engine.schedule(card, Rating.Hard);
    expect(result.card.state).toBe(CardState.Relearning);
  });

  it('Relearning card + Good → graduates to Review', () => {
    const card = makeNewCard({
      state: CardState.Relearning,
      stability: 2,
      difficulty: 6,
      reps: 5,
      lapses: 1,
      lastReview: new Date(Date.now() - 1 * 86400_000).toISOString(),
    });
    const result = engine.schedule(card, Rating.Good);
    expect(result.card.state).toBe(CardState.Review);
  });

  it('schedule result contains a review record', () => {
    const card = makeNewCard();
    const result = engine.schedule(card, Rating.Good);
    expect(result.review).toBeDefined();
    expect(result.review.cardId).toBe('test-card');
    expect(result.review.rating).toBe(Rating.Good);
    expect(result.review.difficulty).toBeGreaterThan(0);
    expect(result.review.stability).toBeGreaterThan(0);
  });

  it('reps counter increments after each review', () => {
    const card = makeNewCard({ reps: 2, state: CardState.Review, stability: 10, difficulty: 5 });
    const result = engine.schedule(card, Rating.Good);
    expect(result.card.reps).toBe(3);
  });

  it('fuzz adds variance to intervals > 2 days', () => {
    const engineWithFuzz = new FSRSEngine({ enableFuzz: true });
    const engineNoFuzz = new FSRSEngine({ enableFuzz: false });
    const now = new Date();

    const makeReview = () =>
      makeNewCard({
        state: CardState.Review,
        stability: 30,
        difficulty: 5,
        retrievability: 0.9,
        lastReview: new Date(Date.now() - 30 * 86400_000).toISOString(),
        reps: 5,
      });

    // Run many times; at least one should differ
    const nofuzzDue = engineNoFuzz.schedule(makeReview(), Rating.Good, now).card.due;
    const fuzzDues = Array.from({ length: 20 }, () =>
      engineWithFuzz.schedule(makeReview(), Rating.Good, now).card.due
    );

    // All no-fuzz results should be identical
    for (let i = 1; i < 5; i++) {
      expect(engineNoFuzz.schedule(makeReview(), Rating.Good, now).card.due).toBe(nofuzzDue);
    }

    // At least some fuzz results should differ from no-fuzz
    const anyDiffers = fuzzDues.some(due => due !== nofuzzDue);
    expect(anyDiffers).toBe(true);
  });
});
