import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { submitAssessmentAnswer, completeAssessmentAttempt } from '../services/assessmentAttempts.js';

const QUESTION_TYPES = [
  'multiple_choice',
  'true_false',
  'short_answer',
  'fill_blank',
  'matching',
  'ordering',
  'problem_solving',
  'open_ended',
] as const;

const questionInputSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().min(1),
  choices: z.array(z.string()).optional(),
  correctAnswer: z.unknown().optional(),
  difficultyLevel: z.enum(['easy', 'medium', 'hard']).optional(),
  sortOrder: z.number().int().optional(),
});

const assessmentInputSchema = z.object({
  title: z.string().min(1).max(255),
  questions: z.array(questionInputSchema).min(1),
});

/** Mounted at /topics/:topicId/assessments */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const assessments = await prisma.assessment.findMany({
      where: { topicId: Number(req.params.topicId) },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: assessments });
  } catch (err) {
    next(err);
  }
});

nestedRouter.post('/', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const body = assessmentInputSchema.parse(req.body);
    const assessment = await prisma.assessment.create({
      data: {
        topicId: Number(req.params.topicId),
        title: body.title,
        source: 'parent_authored',
        questions: {
          create: body.questions.map((q, i) => ({
            type: q.type,
            prompt: q.prompt,
            choices: q.choices,
            correctAnswer: q.correctAnswer as never,
            difficultyLevel: q.difficultyLevel ?? 'medium',
            sortOrder: q.sortOrder ?? i,
          })),
        },
      },
      include: { questions: true },
    });
    res.status(201).json({ data: assessment });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /assessments */
export const itemRouter = Router();
itemRouter.use(requireAuth);

itemRouter.get('/:assessmentId', requireOwnership('assessment', 'assessmentId'), async (req, res, next) => {
  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: Number(req.params.assessmentId) },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!assessment) throw new HttpError(404, 'not_found');
    res.json({ data: assessment });
  } catch (err) {
    next(err);
  }
});

itemRouter.delete('/:assessmentId', requireOwnership('assessment', 'assessmentId'), async (req, res, next) => {
  try {
    await prisma.assessment.delete({ where: { id: Number(req.params.assessmentId) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const startAttemptSchema = z.object({ childId: z.number().int() });

itemRouter.post('/:assessmentId/attempts', requireOwnership('assessment', 'assessmentId'), async (req, res, next) => {
  try {
    const { childId } = startAttemptSchema.parse(req.body);
    const child = await prisma.child.findUnique({ where: { id: childId } });
    if (!child || child.userId !== req.userId) throw new HttpError(404, 'child_not_found');

    const attempt = await prisma.assessmentAttempt.create({
      data: { assessmentId: Number(req.params.assessmentId), childId, status: 'in_progress' },
    });
    res.status(201).json({ data: attempt });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /assessment-attempts */
export const attemptRouter = Router();
attemptRouter.use(requireAuth);

const answerSchema = z.object({ questionId: z.number().int(), response: z.unknown() });

attemptRouter.post('/:attemptId/answers', requireOwnership('assessmentAttempt', 'attemptId'), async (req, res, next) => {
  try {
    const { questionId, response } = answerSchema.parse(req.body);
    const result = await submitAssessmentAnswer(Number(req.params.attemptId), questionId, response);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

attemptRouter.post('/:attemptId/complete', requireOwnership('assessmentAttempt', 'attemptId'), async (req, res, next) => {
  try {
    const updated = await completeAssessmentAttempt(Number(req.params.attemptId));
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

attemptRouter.get('/:attemptId', requireOwnership('assessmentAttempt', 'attemptId'), async (req, res, next) => {
  try {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: Number(req.params.attemptId) },
      include: { answers: true, assessment: { include: { questions: true } } },
    });
    if (!attempt) throw new HttpError(404, 'not_found');
    res.json({ data: attempt });
  } catch (err) {
    next(err);
  }
});
