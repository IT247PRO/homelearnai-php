import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';

const topicInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).nullable().optional(),
  learningContent: z.string().max(200_000).nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(600).optional(),
  prerequisites: z.array(z.number().int()).optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/** Mounted at /units/:unitId/topics */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/', requireOwnership('unit', 'unitId'), async (req, res, next) => {
  try {
    const topics = await prisma.topic.findMany({
      where: { unitId: Number(req.params.unitId) },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ data: topics });
  } catch (err) {
    next(err);
  }
});

nestedRouter.post('/', requireOwnership('unit', 'unitId'), async (req, res, next) => {
  try {
    const body = topicInputSchema.parse(req.body);
    const topic = await prisma.topic.create({
      data: {
        unitId: Number(req.params.unitId),
        title: body.title,
        description: body.description ?? undefined,
        learningContent: body.learningContent ?? undefined,
        estimatedMinutes: body.estimatedMinutes ?? 30,
        prerequisites: body.prerequisites ?? undefined,
        required: body.required ?? true,
      },
    });
    res.status(201).json({ data: topic });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /topics */
export const itemRouter = Router();
itemRouter.use(requireAuth);

itemRouter.get('/:topicId', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const topic = await prisma.topic.findUnique({ where: { id: Number(req.params.topicId) } });
    if (!topic) throw new HttpError(404, 'not_found');
    res.json({ data: topic });
  } catch (err) {
    next(err);
  }
});

itemRouter.patch('/:topicId', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const body = topicInputSchema.partial().parse(req.body);
    const topic = await prisma.topic.update({
      where: { id: Number(req.params.topicId) },
      data: {
        title: body.title,
        description: body.description === null ? null : body.description,
        learningContent: body.learningContent === null ? null : body.learningContent,
        estimatedMinutes: body.estimatedMinutes,
        prerequisites: body.prerequisites,
        required: body.required,
        sortOrder: body.sortOrder,
      },
    });
    res.json({ data: topic });
  } catch (err) {
    next(err);
  }
});

itemRouter.delete('/:topicId', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    await prisma.topic.delete({ where: { id: Number(req.params.topicId) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
