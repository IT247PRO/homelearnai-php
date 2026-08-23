import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { recordActivity } from '../services/gamification.js';
import { evaluateSessionQuality } from '../services/qualityHeuristics.js';
import { suggestRescheduleSlots } from '../services/scheduling.js';

/** Mounted at /children/:childId/learning-sessions */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

const createSessionSchema = z.object({
  topicId: z.number().int(),
  estimatedMinutes: z.number().int().min(1).max(600).optional(),
  commitmentType: z.enum(['fixed', 'preferred', 'flexible']).optional(),
});

nestedRouter.get('/', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const sessions = await prisma.learningSession.findMany({
      where: { childId: Number(req.params.childId), status: status || undefined },
      include: { topic: true },
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ data: sessions });
  } catch (err) {
    next(err);
  }
});

nestedRouter.post('/', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const body = createSessionSchema.parse(req.body);
    const childId = Number(req.params.childId);
    const topic = await prisma.topic.findUniqueOrThrow({ where: { id: body.topicId } });
    const estimatedMinutes = body.estimatedMinutes ?? topic.estimatedMinutes;
    const session = await prisma.learningSession.create({
      data: {
        childId,
        topicId: body.topicId,
        estimatedMinutes,
        commitmentType: body.commitmentType ?? 'preferred',
        status: 'backlog',
      },
    });
    const warnings = await evaluateSessionQuality({ childId, estimatedMinutes });
    res.status(201).json({ data: session, warnings });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /learning-sessions */
export const itemRouter = Router();
itemRouter.use(requireAuth);

itemRouter.get('/:sessionId', requireOwnership('learningSession', 'sessionId'), async (req, res, next) => {
  try {
    const session = await prisma.learningSession.findUnique({
      where: { id: Number(req.params.sessionId) },
      include: { topic: true },
    });
    if (!session) throw new HttpError(404, 'not_found');
    res.json({ data: session });
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({ status: z.enum(['backlog', 'planned', 'scheduled', 'done']) });

itemRouter.patch('/:sessionId/status', requireOwnership('learningSession', 'sessionId'), async (req, res, next) => {
  try {
    const { status } = statusSchema.parse(req.body);
    const sessionId = Number(req.params.sessionId);
    const session = await prisma.learningSession.update({
      where: { id: sessionId },
      data: { status, completedAt: status === 'done' ? new Date() : undefined },
    });

    // Mirrors the original: completing a session ensures a spaced-repetition entry exists.
    if (status === 'done') {
      const existingReview = await prisma.review.findFirst({ where: { sessionId } });
      if (!existingReview) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await prisma.review.create({
          data: { childId: session.childId, topicId: session.topicId, sessionId, status: 'new', dueDate: tomorrow },
        });
      }
      await recordActivity(session.childId, 10);
    }

    res.json({ data: session });
  } catch (err) {
    next(err);
  }
});

const commitmentTypeSchema = z.object({ commitmentType: z.enum(['fixed', 'preferred', 'flexible']) });

itemRouter.patch('/:sessionId/commitment-type', requireOwnership('learningSession', 'sessionId'), async (req, res, next) => {
  try {
    const body = commitmentTypeSchema.parse(req.body);
    const session = await prisma.learningSession.update({ where: { id: Number(req.params.sessionId) }, data: body });
    res.json({ data: session });
  } catch (err) {
    next(err);
  }
});

const scheduleSchema = z.object({
  scheduledDate: z.string().datetime().optional(),
  scheduledDayOfWeek: z.number().int().min(1).max(7).optional(),
  scheduledStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  scheduledEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

itemRouter.patch('/:sessionId/schedule', requireOwnership('learningSession', 'sessionId'), async (req, res, next) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const body = scheduleSchema.parse(req.body);
    const session = await prisma.learningSession.update({
      where: { id: sessionId },
      data: { ...body, status: 'scheduled' },
    });
    const warnings = await evaluateSessionQuality({
      childId: session.childId,
      estimatedMinutes: session.estimatedMinutes,
      scheduledDate: session.scheduledDate,
      excludeSessionId: sessionId,
    });
    res.json({ data: session, warnings });
  } catch (err) {
    next(err);
  }
});

itemRouter.patch('/:sessionId/unschedule', requireOwnership('learningSession', 'sessionId'), async (req, res, next) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const existing = await prisma.learningSession.findUniqueOrThrow({ where: { id: sessionId } });
    if (existing.commitmentType === 'fixed') throw new HttpError(409, 'fixed_sessions_cannot_be_unscheduled');

    const session = await prisma.learningSession.update({
      where: { id: sessionId },
      data: { scheduledDate: null, scheduledDayOfWeek: null, scheduledStartTime: null, scheduledEndTime: null, status: 'planned' },
    });
    res.json({ data: session });
  } catch (err) {
    next(err);
  }
});

const skipSchema = z.object({ reason: z.string().max(1000).optional() });

itemRouter.post('/:sessionId/skip', requireOwnership('learningSession', 'sessionId'), async (req, res, next) => {
  try {
    const { reason } = skipSchema.parse(req.body);
    const sessionId = Number(req.params.sessionId);
    const session = await prisma.learningSession.findUniqueOrThrow({ where: { id: sessionId } });
    if (session.commitmentType === 'fixed') throw new HttpError(409, 'fixed_sessions_cannot_be_skipped');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [updatedSession, catchUp] = await prisma.$transaction([
      prisma.learningSession.update({ where: { id: sessionId }, data: { skippedFromDate: today, status: 'backlog' } }),
      prisma.catchUpSession.create({
        data: {
          originalSessionId: sessionId,
          childId: session.childId,
          topicId: session.topicId,
          estimatedMinutes: session.estimatedMinutes,
          missedDate: today,
          reason,
          priority: 3,
          status: 'pending',
        },
      }),
    ]);

    res.status(201).json({ data: { session: updatedSession, catchUpSession: catchUp } });
  } catch (err) {
    next(err);
  }
});

itemRouter.get('/:sessionId/reschedule-suggestions', requireOwnership('learningSession', 'sessionId'), async (req, res, next) => {
  try {
    const suggestions = await suggestRescheduleSlots(Number(req.params.sessionId));
    res.json({ data: suggestions });
  } catch (err) {
    next(err);
  }
});

itemRouter.delete('/:sessionId', requireOwnership('learningSession', 'sessionId'), async (req, res, next) => {
  try {
    await prisma.learningSession.delete({ where: { id: Number(req.params.sessionId) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
