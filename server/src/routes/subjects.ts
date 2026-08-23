import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { SUBJECT_TEMPLATES, findSubjectTemplate } from '../services/subjectTemplates.js';

const subjectInputSchema = z.object({
  name: z.string().min(1).max(255),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

/** Mounted at /children/:childId/subjects */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: { childId: Number(req.params.childId) },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: subjects });
  } catch (err) {
    next(err);
  }
});

nestedRouter.post('/', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const body = subjectInputSchema.parse(req.body);
    const childId = Number(req.params.childId);
    const child = await prisma.child.findUniqueOrThrow({ where: { id: childId } });
    const subject = await prisma.subject.create({
      data: {
        userId: child.userId,
        childId,
        name: body.name,
        color: body.color ?? undefined,
      },
    });
    res.status(201).json({ data: subject });
  } catch (err) {
    next(err);
  }
});

const quickStartSchema = z.object({ templateKey: z.string() });

nestedRouter.post('/quick-start', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const { templateKey } = quickStartSchema.parse(req.body);
    const template = findSubjectTemplate(templateKey);
    if (!template) throw new HttpError(400, 'unknown_template');

    const childId = Number(req.params.childId);
    const child = await prisma.child.findUniqueOrThrow({ where: { id: childId } });

    const subject = await prisma.subject.create({
      data: {
        userId: child.userId,
        childId,
        name: template.name,
        color: template.color,
        units: {
          create: template.units.map((unit, unitIndex) => ({
            name: unit.name,
            description: unit.description,
            sortOrder: unitIndex,
            topics: {
              create: unit.topics.map((topic, topicIndex) => ({
                title: topic.title,
                estimatedMinutes: topic.estimatedMinutes,
                learningContent: topic.learningContent,
                sortOrder: topicIndex,
              })),
            },
          })),
        },
      },
      include: { units: { include: { topics: true } } },
    });
    res.status(201).json({ data: subject });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /subjects */
export const itemRouter = Router();
itemRouter.use(requireAuth);

// Registered before the generic '/:subjectId' route below so it doesn't get swallowed by it.
itemRouter.get('/quick-start/templates', (_req, res) => {
  res.json({ data: SUBJECT_TEMPLATES.map(({ key, name, color }) => ({ key, name, color })) });
});

itemRouter.get('/:subjectId', requireOwnership('subject', 'subjectId'), async (req, res, next) => {
  try {
    const subject = await prisma.subject.findUnique({ where: { id: Number(req.params.subjectId) } });
    if (!subject) throw new HttpError(404, 'not_found');
    res.json({ data: subject });
  } catch (err) {
    next(err);
  }
});

itemRouter.patch('/:subjectId', requireOwnership('subject', 'subjectId'), async (req, res, next) => {
  try {
    const body = subjectInputSchema.partial().parse(req.body);
    const subject = await prisma.subject.update({
      where: { id: Number(req.params.subjectId) },
      data: body,
    });
    res.json({ data: subject });
  } catch (err) {
    next(err);
  }
});

itemRouter.delete('/:subjectId', requireOwnership('subject', 'subjectId'), async (req, res, next) => {
  try {
    await prisma.subject.delete({ where: { id: Number(req.params.subjectId) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
