import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { processReviewResult, buildReviewQueue } from '../services/spacedRepetition.js';
import { recordMasteryOutcome } from '../services/mastery.js';
import { recordActivity } from '../services/gamification.js';
import { resolveReviewResult } from '../services/answerChecking.js';

/** Mounted at /children/:childId/reviews */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/queue', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const queue = await buildReviewQueue(Number(req.params.childId));
    res.json({ data: queue });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /reviews */
export const itemRouter = Router();
itemRouter.use(requireAuth);

const resultSchema = z.object({
  result: z.enum(['again', 'hard', 'good', 'easy']),
  response: z.unknown().optional(),
});

itemRouter.post('/:reviewId/result', requireOwnership('review', 'reviewId'), async (req, res, next) => {
  try {
    const { result: requestedResult, response } = resultSchema.parse(req.body);
    const reviewId = Number(req.params.reviewId);

    const review = await prisma.review.findUniqueOrThrow({ where: { id: reviewId }, include: { flashcard: true } });
    const result = resolveReviewResult(requestedResult, response, review.flashcard);
    const processed = processReviewResult(
      {
        intervalDays: review.intervalDays,
        easeFactor: review.easeFactor,
        repetitions: review.repetitions,
        status: review.status,
      },
      result
    );

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        intervalDays: processed.intervalDays,
        easeFactor: processed.easeFactor,
        repetitions: processed.repetitions,
        status: processed.status,
        dueDate: processed.dueDate,
        lastReviewedAt: processed.lastReviewedAt,
      },
    });

    await recordMasteryOutcome({
      childId: review.childId,
      topicId: review.topicId,
      wasCorrect: result !== 'again',
      trigger: 'review',
      sourceReviewId: reviewId,
      reviewReachedMastered: processed.status === 'mastered',
    });
    await recordActivity(review.childId, 5);

    res.json({ data: updated, downgraded: result !== requestedResult });
  } catch (err) {
    next(err);
  }
});

itemRouter.get('/:reviewId', requireOwnership('review', 'reviewId'), async (req, res, next) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: Number(req.params.reviewId) } });
    if (!review) throw new HttpError(404, 'not_found');
    res.json({ data: review });
  } catch (err) {
    next(err);
  }
});
