import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireKidsModeContext } from '../middleware/kidsMode.js';
import { HttpError } from '../middleware/errorHandler.js';
import { buildReviewQueue, processReviewResult } from '../services/spacedRepetition.js';
import { recordMasteryOutcome } from '../services/mastery.js';
import { recordActivity } from '../services/gamification.js';
import { resolveReviewResult } from '../services/answerChecking.js';
import { postTutorMessage } from '../services/tutor.js';
import { AiNotConfiguredError } from '../ai/provider.js';

/** Mounted at /kids — every route here is gated by an active Kids Mode session, not the
 * parent's own auth cookie. Only ever touches the child locked into that session. */
export const router = Router();
router.use(requireKidsModeContext);

router.get('/me', async (req, res, next) => {
  try {
    const child = await prisma.child.findUnique({ where: { id: req.kidsSession!.childId } });
    if (!child) throw new HttpError(404, 'not_found');
    res.json({ data: { id: child.id, name: child.name, grade: child.grade, independenceLevel: child.independenceLevel } });
  } catch (err) {
    next(err);
  }
});

router.get('/today', async (req, res, next) => {
  try {
    const childId = req.kidsSession!.childId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const sessions = await prisma.learningSession.findMany({
      where: {
        childId,
        status: { in: ['planned', 'scheduled'] },
        OR: [{ scheduledDate: { gte: startOfDay, lte: endOfDay } }, { scheduledDate: null }],
      },
      include: { topic: true },
      orderBy: [{ scheduledStartTime: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ data: sessions });
  } catch (err) {
    next(err);
  }
});

router.get('/reviews/queue', async (req, res, next) => {
  try {
    const queue = await buildReviewQueue(req.kidsSession!.childId);
    res.json({ data: queue });
  } catch (err) {
    next(err);
  }
});

const resultSchema = z.object({
  result: z.enum(['again', 'hard', 'good', 'easy']),
  response: z.unknown().optional(),
});

router.post('/reviews/:reviewId/result', async (req, res, next) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const review = await prisma.review.findUnique({ where: { id: reviewId }, include: { flashcard: true } });
    if (!review || review.childId !== req.kidsSession!.childId) throw new HttpError(404, 'not_found');

    const { result: requestedResult, response } = resultSchema.parse(req.body);
    const result = resolveReviewResult(requestedResult, response, review.flashcard);
    const processed = processReviewResult(
      { intervalDays: review.intervalDays, easeFactor: review.easeFactor, repetitions: review.repetitions, status: review.status },
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

router.get('/topics/:topicId', async (req, res, next) => {
  try {
    const topicId = Number(req.params.topicId);
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { unit: { include: { subject: true } } },
    });
    if (!topic || topic.unit.subject.childId !== req.kidsSession!.childId) throw new HttpError(404, 'not_found');
    res.json({ data: { id: topic.id, title: topic.title, learningContent: topic.learningContent, estimatedMinutes: topic.estimatedMinutes } });
  } catch (err) {
    next(err);
  }
});

const activitySchema = z.object({
  eventType: z.enum(['topic_opened', 'topic_closed', 'material_opened']),
  metadata: z.unknown().optional(),
});

router.post('/topics/:topicId/activity', async (req, res, next) => {
  try {
    const topicId = Number(req.params.topicId);
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { unit: { include: { subject: true } } },
    });
    if (!topic || topic.unit.subject.childId !== req.kidsSession!.childId) throw new HttpError(404, 'not_found');

    const { eventType, metadata } = activitySchema.parse(req.body);
    const event = await prisma.kidsActivityEvent.create({
      data: { childId: req.kidsSession!.childId, topicId, eventType, metadata: metadata as never },
    });
    res.status(201).json({ data: event });
  } catch (err) {
    next(err);
  }
});

const tutorMessageSchema = z.object({
  conversationId: z.number().int().optional(),
  message: z.string().min(1).max(2000),
  lessonId: z.number().int().optional(),
  sectionId: z.number().int().optional(),
});

// Same postTutorMessage service the parent-facing preview uses (routes/tutor.ts) — the
// child can ask the tutor directly, without needing the parent's own session.
router.post('/topics/:topicId/tutor/messages', async (req, res, next) => {
  try {
    const topicId = Number(req.params.topicId);
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { unit: { include: { subject: true } } },
    });
    if (!topic || topic.unit.subject.childId !== req.kidsSession!.childId) throw new HttpError(404, 'not_found');

    const body = tutorMessageSchema.parse(req.body);
    const result = await postTutorMessage({
      userId: req.kidsSession!.parentUserId,
      childId: req.kidsSession!.childId,
      topicId,
      lessonId: body.lessonId,
      sectionId: body.sectionId,
      conversationId: body.conversationId,
      message: body.message,
    });
    res.status(201).json({ data: result });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.status(503).json({ error: 'ai_not_configured', message: 'AI features are not set up yet.' });
    }
    next(err);
  }
});

router.post('/sessions/:sessionId/complete', async (req, res, next) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const session = await prisma.learningSession.findUnique({ where: { id: sessionId } });
    if (!session || session.childId !== req.kidsSession!.childId) throw new HttpError(404, 'not_found');

    const updated = await prisma.learningSession.update({
      where: { id: sessionId },
      data: { status: 'done', completedAt: new Date() },
    });
    await recordActivity(session.childId, 10);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});
