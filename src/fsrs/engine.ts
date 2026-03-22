import { CardState, Rating } from '../types.js';
import type { Card, FSRSParameters, SchedulingResult } from '../types.js';

// ── FSRS v4.5+ constants ────────────────────────────────────────────────────

const DECAY = -0.5;
// FACTOR satisfies: (1 + FACTOR * 1)^DECAY = 0.9  →  FACTOR = 0.9^(1/DECAY) - 1
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // ≈ 19/81 ≈ 0.2346...

const DEFAULT_W: number[] = [
  0.40255, 1.18385, 3.173, 15.69105,  // w[0..3]: S0 per rating (Again/Hard/Good/Easy)
  7.1949,                              // w[4]: D0 anchor
  0.5345, 1.4604,                      // w[5]: D0 spread, w[6]: difficulty step per rating
  0.0046, 1.54575, 0.1192, 1.01925,   // w[7..10]: recall stability multipliers
  1.9395, 0.11, 0.29605, 2.2698,      // w[11..14]: forget stability
  0.2315, 2.9898,                      // w[15]: hard penalty, w[16]: easy bonus
  0.51655, 0.6621,                     // w[17..18]: short-term stability (unused here)
];

const DEFAULT_PARAMS: FSRSParameters = {
  w: DEFAULT_W,
  requestRetention: 0.9,
  maximumInterval: 36500,
  enableFuzz: true,
};

// Short intervals for Learning/Relearning states (in days)
const LEARNING_STEPS_DAYS = [1 / 1440, 10 / 1440]; // 1 min, 10 min
const RELEARNING_STEP_DAYS = 10 / 1440; // 10 min

// ── Standalone math functions ────────────────────────────────────────────────

/**
 * R(t, S) = (1 + FACTOR * t / S)^DECAY
 * At t=0 → 1.0; at t=S → 0.9
 */
export function retrievability(elapsedDays: number, stability: number): number {
  if (elapsedDays === 0) return 1;
  return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
}

/**
 * S0(G) = w[G-1]  (rating is 1-indexed: Again=1, Hard=2, Good=3, Easy=4)
 */
export function initialStability(rating: Rating, w: number[] = DEFAULT_W): number {
  return w[rating - 1];
}

/**
 * D0(G) = w[4] - exp(w[5] * (G - 1)) + 1, clamped [1, 10]
 */
export function initialDifficulty(rating: Rating, w: number[] = DEFAULT_W): number {
  const raw = w[4] - Math.exp(w[5] * (rating - 1)) + 1;
  return Math.min(10, Math.max(1, raw));
}

/**
 * Mean-reversion difficulty update:
 * D'(D, G) = w[7] * D0(3) + (1 - w[7]) * (D - w[6] * (G - 3)), clamped [1, 10]
 */
export function nextDifficulty(difficulty: number, rating: Rating, w: number[] = DEFAULT_W): number {
  const d0Good = w[4] - Math.exp(w[5] * (Rating.Good - 1)) + 1;
  const raw = w[7] * d0Good + (1 - w[7]) * (difficulty - w[6] * (rating - 3));
  return Math.min(10, Math.max(1, raw));
}

/**
 * I(r, S) = (S / FACTOR) * (r^(1/DECAY) - 1)
 * Capped at maximumInterval.
 */
export function nextInterval(
  stability: number,
  requestRetention: number,
  maximumInterval: number = DEFAULT_PARAMS.maximumInterval
): number {
  const raw = (stability / FACTOR) * (Math.pow(requestRetention, 1 / DECAY) - 1);
  return Math.min(maximumInterval, Math.max(1, Math.round(raw)));
}

/**
 * Recall stability (S'):
 * S' = S * (1 + exp(w[8]) * (11 - D) * S^(-w[9]) * (exp((1-R)*w[10]) - 1) * hardPenalty * easyBonus)
 */
export function nextRecallStability(
  difficulty: number,
  stability: number,
  r: number,
  rating: Rating,
  w: number[] = DEFAULT_W
): number {
  const hardPenalty = rating === Rating.Hard ? w[15] : 1;
  const easyBonus = rating === Rating.Easy ? w[16] : 1;
  return (
    stability *
    (1 +
      Math.exp(w[8]) *
        (11 - difficulty) *
        Math.pow(stability, -w[9]) *
        (Math.exp((1 - r) * w[10]) - 1) *
        hardPenalty *
        easyBonus)
  );
}

/**
 * Forget stability (S'):
 * S' = w[11] * D^(-w[12]) * ((S+1)^w[13] - 1) * exp((1-R)*w[14])
 */
export function nextForgetStability(
  difficulty: number,
  stability: number,
  r: number,
  w: number[] = DEFAULT_W
): number {
  return (
    w[11] *
    Math.pow(difficulty, -w[12]) *
    (Math.pow(stability + 1, w[13]) - 1) *
    Math.exp((1 - r) * w[14])
  );
}

// ── Fuzz ─────────────────────────────────────────────────────────────────────

function applyFuzz(interval: number): number {
  if (interval <= 2) return interval;
  const fuzz = 0.05; // ±5%
  const delta = Math.max(1, Math.round(interval * fuzz));
  return interval + Math.round((Math.random() * 2 - 1) * delta);
}

// ── FSRSEngine class ─────────────────────────────────────────────────────────

export class FSRSEngine {
  private readonly params: FSRSParameters;

  constructor(params: Partial<FSRSParameters> = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params };
  }

  retrievability(elapsedDays: number, stability: number): number {
    return retrievability(elapsedDays, stability);
  }

  schedule(card: Card, rating: Rating, now: Date = new Date()): SchedulingResult {
    const { w, requestRetention, maximumInterval, enableFuzz } = this.params;

    const lastReview = card.lastReview ? new Date(card.lastReview) : now;
    const elapsedDays =
      card.lastReview
        ? Math.max(0, (now.getTime() - lastReview.getTime()) / 86400_000)
        : 0;

    const currentR = card.state === CardState.New
      ? 1
      : retrievability(elapsedDays, card.stability);

    // ── Determine new difficulty ──────────────────────────────────────────
    let newDifficulty: number;
    if (card.state === CardState.New) {
      newDifficulty = initialDifficulty(rating, w);
    } else {
      newDifficulty = nextDifficulty(card.difficulty, rating, w);
    }

    // ── Determine new stability ───────────────────────────────────────────
    let newStability: number;

    if (card.state === CardState.New) {
      newStability = initialStability(rating, w);
    } else if (card.state === CardState.Learning || card.state === CardState.Relearning) {
      // Short-interval states: use recall stability update on graduation, simple step otherwise
      if (rating === Rating.Again || rating === Rating.Hard) {
        newStability = card.stability; // stays in step, stability unchanged
      } else {
        // Good / Easy → graduate: compute recall stability
        newStability = nextRecallStability(newDifficulty, card.stability, currentR, rating, w);
      }
    } else {
      // Review
      if (rating === Rating.Again) {
        newStability = nextForgetStability(newDifficulty, card.stability, currentR, w);
      } else {
        newStability = nextRecallStability(newDifficulty, card.stability, currentR, rating, w);
      }
    }

    // ── State machine ─────────────────────────────────────────────────────
    let newState: CardState;
    let intervalDays: number;

    switch (card.state) {
      case CardState.New: {
        if (rating === Rating.Again) {
          newState = CardState.Learning;
          intervalDays = LEARNING_STEPS_DAYS[0];
        } else if (rating === Rating.Hard) {
          newState = CardState.Learning;
          intervalDays = LEARNING_STEPS_DAYS[1];
        } else {
          // Good / Easy → graduate immediately
          newState = CardState.Review;
          intervalDays = nextInterval(newStability, requestRetention, maximumInterval);
          if (enableFuzz) intervalDays = applyFuzz(intervalDays);
        }
        break;
      }

      case CardState.Learning:
      case CardState.Relearning: {
        if (rating === Rating.Again) {
          newState = card.state;
          intervalDays = card.state === CardState.Relearning
            ? RELEARNING_STEP_DAYS
            : LEARNING_STEPS_DAYS[0];
        } else if (rating === Rating.Hard) {
          // Hard → stay in same state, advance to next step interval (10 min)
          newState = card.state;
          intervalDays = card.state === CardState.Relearning
            ? RELEARNING_STEP_DAYS
            : LEARNING_STEPS_DAYS[1];
        } else {
          // Good / Easy → graduate to Review
          newState = CardState.Review;
          intervalDays = nextInterval(newStability, requestRetention, maximumInterval);
          if (enableFuzz) intervalDays = applyFuzz(intervalDays);
        }
        break;
      }

      case CardState.Review: {
        if (rating === Rating.Again) {
          newState = CardState.Relearning;
          intervalDays = RELEARNING_STEP_DAYS;
        } else {
          newState = CardState.Review;
          intervalDays = nextInterval(newStability, requestRetention, maximumInterval);
          if (enableFuzz) intervalDays = applyFuzz(intervalDays);
        }
        break;
      }

      default:
        newState = CardState.Review;
        intervalDays = 1;
    }

    const newLapses =
      card.state === CardState.Review && rating === Rating.Again
        ? card.lapses + 1
        : card.lapses;

    const dueDate = new Date(now.getTime() + intervalDays * 86400_000);
    const newRetrievability = retrievability(0, newStability); // = 1 right after review

    const updatedCard: Card = {
      ...card,
      difficulty: newDifficulty,
      stability: newStability,
      retrievability: newRetrievability,
      state: newState,
      due: dueDate.toISOString(),
      lastReview: now.toISOString(),
      reps: card.reps + 1,
      lapses: newLapses,
    };

    const scheduledDays = Math.round(intervalDays);

    const review: Omit<import('../types.js').Review, 'id'> = {
      cardId: card.id,
      rating,
      elapsedDays,
      scheduledDays,
      difficulty: newDifficulty,
      stability: newStability,
      state: newState,
      reviewedAt: now.toISOString(),
    };

    return { card: updatedCard, review };
  }
}
