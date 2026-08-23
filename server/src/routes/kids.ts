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
    res.json({ data: { id: child.id, name: child.name, grade: child.grade, independenceLevel: child.independenceLevel, avatarUrl: child.avatarUrl } });
  } catch (err) {
    next(err);
  }
});

router.get('/overview', async (req, res, next) => {
  try {
    const childId = req.kidsSession!.childId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [child, gamification, achievements, sessions, reviewQueue, subjects] = await Promise.all([
      prisma.child.findUnique({ where: { id: childId } }),
      prisma.childGamificationState.findUnique({ where: { childId } }),
      prisma.childAchievement.findMany({
        where: { childId },
        include: { achievement: true },
        orderBy: { earnedAt: 'desc' },
      }),
      prisma.learningSession.findMany({
        where: {
          childId,
          status: { in: ['planned', 'scheduled', 'done'] },
          OR: [{ scheduledDate: { gte: startOfDay, lte: endOfDay } }, { scheduledDate: null }],
        },
        include: {
          topic: {
            include: {
              unit: { include: { subject: true } },
              lessons: { select: { id: true, title: true, status: true, estimatedMinutes: true } },
              assessments: { select: { id: true, title: true } },
            },
          },
          lesson: { select: { id: true, title: true, status: true } },
        },
        orderBy: [{ scheduledStartTime: 'asc' }, { createdAt: 'asc' }],
      }),
      buildReviewQueue(childId),
      prisma.subject.findMany({
        where: { childId },
        include: {
          units: {
            orderBy: { sortOrder: 'asc' },
            include: {
              topics: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  lessons: {
                    select: {
                      id: true,
                      title: true,
                      status: true,
                      estimatedMinutes: true,
                      progress: { where: { childId }, select: { completedAt: true, currentSectionIndex: true } },
                    },
                  },
                  assessments: {
                    select: {
                      id: true,
                      title: true,
                      questions: { select: { id: true } },
                      attempts: {
                        where: { childId },
                        orderBy: { completedAt: 'desc' },
                        take: 1,
                        select: { id: true, score: true, status: true, completedAt: true },
                      },
                    },
                  },
                  flashcards: { select: { id: true } },
                  fileAssets: { select: { id: true, kind: true, label: true, originalName: true, url: true } },
                  masteries: { where: { childId }, select: { state: true, accuracy: true } },
                  studyGuide: { select: { versions: { where: { status: 'published' }, select: { id: true }, take: 1 } } },
                },
              },
            },
          },
        },
      }),
    ]);

    if (!child) throw new HttpError(404, 'not_found');

    res.json({
      data: {
        child: {
          id: child.id,
          name: child.name,
          grade: child.grade,
          independenceLevel: child.independenceLevel,
          avatarUrl: child.avatarUrl,
        },
        gamification: gamification ?? {
          totalPoints: 0,
          level: 1,
          currentStreakDays: 0,
          longestStreakDays: 0,
          gamificationEnabled: true,
        },
        achievements,
        todaySessions: sessions,
        reviewQueueCount: reviewQueue.length,
        subjects,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/gamification', async (req, res, next) => {
  try {
    const childId = req.kidsSession!.childId;
    const [state, achievements] = await Promise.all([
      prisma.childGamificationState.findUnique({ where: { childId } }),
      prisma.childAchievement.findMany({
        where: { childId },
        include: { achievement: true },
        orderBy: { earnedAt: 'desc' },
      }),
    ]);
    res.json({ data: { state, achievements } });
  } catch (err) {
    next(err);
  }
});

router.get('/subjects', async (req, res, next) => {
  try {
    const childId = req.kidsSession!.childId;
    const subjects = await prisma.subject.findMany({
      where: { childId },
      include: {
        units: {
          orderBy: { sortOrder: 'asc' },
          include: {
            topics: {
              orderBy: { sortOrder: 'asc' },
              include: {
                lessons: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    estimatedMinutes: true,
                    progress: { where: { childId }, select: { completedAt: true, currentSectionIndex: true } },
                  },
                },
                assessments: {
                  select: {
                    id: true,
                    title: true,
                    questions: { select: { id: true } },
                    attempts: {
                      where: { childId },
                      orderBy: { completedAt: 'desc' },
                      take: 1,
                      select: { id: true, score: true, status: true },
                    },
                  },
                },
                flashcards: { select: { id: true } },
                fileAssets: { select: { id: true, kind: true, label: true, originalName: true, url: true } },
                masteries: { where: { childId }, select: { state: true, accuracy: true } },
              },
            },
          },
        },
      },
    });
    res.json({ data: subjects });
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
    const childId = req.kidsSession!.childId;
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        unit: { include: { subject: true } },
        fileAssets: true,
        lessons: {
          select: {
            id: true,
            title: true,
            status: true,
            estimatedMinutes: true,
            progress: { where: { childId }, select: { completedAt: true, currentSectionIndex: true } },
          },
        },
        assessments: {
          select: {
            id: true,
            title: true,
            questions: { select: { id: true } },
            attempts: {
              where: { childId },
              orderBy: { completedAt: 'desc' },
              take: 1,
              select: { id: true, score: true, status: true, completedAt: true },
            },
          },
        },
        flashcards: { select: { id: true } },
      },
    });
    if (!topic || topic.unit.subject.childId !== req.kidsSession!.childId) throw new HttpError(404, 'not_found');
    res.json({
      data: {
        id: topic.id,
        title: topic.title,
        learningContent: topic.learningContent,
        estimatedMinutes: topic.estimatedMinutes,
        unit: { id: topic.unit.id, name: topic.unit.name, subject: topic.unit.subject },
        fileAssets: topic.fileAssets,
        lessons: topic.lessons,
        assessments: topic.assessments,
        flashcardsCount: topic.flashcards.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/topics/:topicId/materials', async (req, res, next) => {
  try {
    const topicId = Number(req.params.topicId);
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { unit: { include: { subject: true } } },
    });
    if (!topic || topic.unit.subject.childId !== req.kidsSession!.childId) throw new HttpError(404, 'not_found');
    const materials = await prisma.fileAsset.findMany({
      where: { topicId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: materials });
  } catch (err) {
    next(err);
  }
});

// Only ever returns the published version — a child never sees a draft awaiting parent
// review (plan4.md §19/§45). Never 404s for "none generated yet", mirrors /materials above.
router.get('/topics/:topicId/study-guide', async (req, res, next) => {
  try {
    const topicId = Number(req.params.topicId);
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { unit: { include: { subject: true } } },
    });
    if (!topic || topic.unit.subject.childId !== req.kidsSession!.childId) throw new HttpError(404, 'not_found');

    const version = await prisma.studyGuideVersion.findFirst({
      where: { status: 'published', studyGuide: { topicId } },
      orderBy: { versionNumber: 'desc' },
    });
    res.json({ data: version ?? null });
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
  studyGuideVersionId: z.number().int().optional(),
  conceptIndex: z.number().int().min(0).optional(),
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
      studyGuideVersionId: body.studyGuideVersionId,
      conceptIndex: body.conceptIndex,
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
