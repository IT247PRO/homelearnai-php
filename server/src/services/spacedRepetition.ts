import { prisma } from '../lib/prisma.js';

export type ReviewResult = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewState {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  status: string;
}

export interface ProcessedReview extends ReviewState {
  dueDate: Date;
  lastReviewedAt: Date;
}

// Ported verbatim from the original Laravel `Review::processResult()`.
const MAX_INTERVAL_DAYS = 240;
const MIN_EASE_FACTOR = 1.3;
const MAX_EASE_FACTOR = 2.5;

export function processReviewResult(state: ReviewState, result: ReviewResult, now: Date = new Date()): ProcessedReview {
  let { intervalDays, easeFactor, repetitions } = state;
  let { status } = state;
  repetitions += 1;

  switch (result) {
    case 'again':
      repetitions = 0;
      intervalDays = 1;
      status = 'learning';
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
      break;
    case 'hard':
      intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15);
      status = repetitions >= 2 ? 'reviewing' : 'learning';
      break;
    case 'good':
      if (repetitions === 1) intervalDays = 3;
      else if (repetitions === 2) intervalDays = 7;
      else intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.round(intervalDays * easeFactor));
      status = repetitions >= 2 ? 'reviewing' : 'learning';
      break;
    case 'easy':
      intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.round(intervalDays * easeFactor * 1.3));
      easeFactor = Math.min(MAX_EASE_FACTOR, easeFactor + 0.15);
      status = repetitions >= 2 ? 'reviewing' : 'learning';
      if (intervalDays >= 120 && repetitions >= 4) status = 'mastered';
      break;
  }

  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + intervalDays);

  return { intervalDays, easeFactor, repetitions, status, dueDate, lastReviewedAt: now };
}

/**
 * Ported from `Review::getReviewQueue()`: up to 15 due reviews (status != mastered, due
 * today or earlier, ordered by dueDate then createdAt) interleaved with up to 5 new
 * reviews at a 3-due:1-new ratio, capped at 20 total.
 */
export async function buildReviewQueue(childId: number, now: Date = new Date()) {
  // Exclude reviews for flashcards that were soft-deleted/deactivated after the review
  // was created; topic-based reviews (flashcardId null) are unaffected.
  const excludeDeletedFlashcard = {
    OR: [{ flashcardId: null }, { flashcard: { isActive: true, deletedAt: null } }],
  };

  const [due, fresh] = await Promise.all([
    prisma.review.findMany({
      where: { childId, status: { not: 'mastered' }, dueDate: { lte: now }, ...excludeDeletedFlashcard },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      take: 15,
      include: { flashcard: true, topic: true },
    }),
    prisma.review.findMany({
      where: { childId, status: 'new', ...excludeDeletedFlashcard },
      orderBy: { createdAt: 'asc' },
      take: 5,
      include: { flashcard: true, topic: true },
    }),
  ]);

  const queue: typeof due = [];
  let dueIdx = 0;
  let freshIdx = 0;
  while (queue.length < 20 && (dueIdx < due.length || freshIdx < fresh.length)) {
    for (let i = 0; i < 3 && dueIdx < due.length && queue.length < 20; i++) {
      queue.push(due[dueIdx++]);
    }
    if (freshIdx < fresh.length && queue.length < 20) {
      queue.push(fresh[freshIdx++]);
    }
  }
  return queue;
}
