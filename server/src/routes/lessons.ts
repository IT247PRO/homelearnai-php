import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { interactiveSectionFieldsSchema } from '../ai/schemas.js';

const LESSON_SECTION_KINDS = [
  'introduction',
  'instruction',
  'example',
  'guided_practice',
  'independent_practice',
  'interactive_activity',
  'activity',
  'practice',
  'questions',
  'challenge',
  'summary',
  'exit_ticket',
  'homework',
  'vocabulary',
] as const;

const lessonInputSchema = z.object({
  title: z.string().min(1).max(255),
  estimatedMinutes: z.number().int().min(1).max(600).optional(),
  sections: z
    .array(
      z
        .object({ kind: z.enum(LESSON_SECTION_KINDS), content: z.string().min(1), sortOrder: z.number().int().optional() })
        .merge(interactiveSectionFieldsSchema)
    )
    .default([]),
  resources: z
    .array(z.object({ type: z.enum(['pdf', 'link', 'image', 'video', 'worksheet', 'document']), url: z.string().url(), title: z.string().optional() }))
    .optional(),
});

/** Mounted at /topics/:topicId/lessons */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const lessons = await prisma.lesson.findMany({
      where: { topicId: Number(req.params.topicId) },
      include: { sections: { orderBy: { sortOrder: 'asc' } }, resources: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: lessons });
  } catch (err) {
    next(err);
  }
});

nestedRouter.post('/', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const body = lessonInputSchema.parse(req.body);
    const lesson = await prisma.lesson.create({
      data: {
        topicId: Number(req.params.topicId),
        title: body.title,
        estimatedMinutes: body.estimatedMinutes,
        status: 'approved', // parent-authored content is trusted immediately, unlike AI-generated drafts
        source: 'parent_authored',
        sections: {
          create: body.sections.map((s, i) => ({
            kind: s.kind,
            content: s.content,
            sortOrder: s.sortOrder ?? i,
            interactionType: s.interactionType,
            choices: s.choices,
            correctAnswer: s.correctAnswer as never,
            hints: s.hints,
          })),
        },
        resources: body.resources ? { create: body.resources } : undefined,
      },
      include: { sections: true, resources: true },
    });
    res.status(201).json({ data: lesson });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /lessons */
export const itemRouter = Router();
itemRouter.use(requireAuth);

itemRouter.get('/:lessonId', requireOwnership('lesson', 'lessonId'), async (req, res, next) => {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: Number(req.params.lessonId) },
      include: { sections: { orderBy: { sortOrder: 'asc' } }, resources: true },
    });
    if (!lesson) throw new HttpError(404, 'not_found');
    res.json({ data: lesson });
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({ status: z.enum(['draft', 'approved', 'archived']) });

itemRouter.patch('/:lessonId/status', requireOwnership('lesson', 'lessonId'), async (req, res, next) => {
  try {
    const { status } = statusSchema.parse(req.body);
    const lesson = await prisma.lesson.update({ where: { id: Number(req.params.lessonId) }, data: { status } });
    res.json({ data: lesson });
  } catch (err) {
    next(err);
  }
});

itemRouter.delete('/:lessonId', requireOwnership('lesson', 'lessonId'), async (req, res, next) => {
  try {
    await prisma.lesson.delete({ where: { id: Number(req.params.lessonId) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
