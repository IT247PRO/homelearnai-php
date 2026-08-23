import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { findSubjectTemplate } from '../services/subjectTemplates.js';
import { HttpError } from '../middleware/errorHandler.js';

export const router = Router();
router.use(requireAuth);

const createChildrenSchema = z.object({
  children: z
    .array(z.object({ name: z.string().min(1).max(255), grade: z.string().min(1).max(20).optional() }))
    .min(1)
    .max(10),
});

router.post('/children', async (req, res, next) => {
  try {
    const { children } = createChildrenSchema.parse(req.body);
    const created = await prisma.$transaction(
      children.map((c) =>
        prisma.child.create({
          data: { userId: req.userId!, name: c.name, grade: c.grade, learningProfile: { create: {} }, gamificationState: { create: {} } },
        })
      )
    );
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

const createSubjectsSchema = z.object({
  childId: z.number().int(),
  templateKeys: z.array(z.string()).min(1),
});

router.post('/subjects', async (req, res, next) => {
  try {
    const { childId, templateKeys } = createSubjectsSchema.parse(req.body);
    const child = await prisma.child.findUnique({ where: { id: childId } });
    if (!child || child.userId !== req.userId) throw new HttpError(404, 'child_not_found');

    const templates = templateKeys.map(findSubjectTemplate).filter((t) => t !== undefined);
    if (templates.length === 0) throw new HttpError(400, 'no_valid_templates');

    const created = await prisma.$transaction(
      templates.map((template) =>
        prisma.subject.create({
          data: {
            userId: req.userId!,
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
        })
      )
    );
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

router.patch('/complete', async (req, res, next) => {
  try {
    await prisma.user.update({ where: { id: req.userId }, data: { onboardingCompleted: true, onboardingSkipped: false } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.patch('/skip', async (req, res, next) => {
  try {
    await prisma.user.update({ where: { id: req.userId }, data: { onboardingSkipped: true } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
