import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';

export const router = Router();
router.use(requireAuth);

const childInputSchema = z.object({
  name: z.string().min(1).max(255),
  grade: z.string().min(1).max(20).nullable().optional(),
  independenceLevel: z.number().int().min(1).max(4).optional(),
  dateOfBirth: z.string().datetime().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const children = await prisma.child.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: children });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = childInputSchema.parse(req.body);
    const child = await prisma.child.create({
      data: {
        userId: req.userId!,
        name: body.name,
        grade: body.grade ?? undefined,
        independenceLevel: body.independenceLevel ?? 1,
        dateOfBirth: body.dateOfBirth ?? undefined,
        avatarUrl: body.avatarUrl ?? undefined,
        learningProfile: { create: {} },
      },
    });
    res.status(201).json({ data: child });
  } catch (err) {
    next(err);
  }
});

router.get('/:childId', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const child = await prisma.child.findUnique({ where: { id: Number(req.params.childId) } });
    if (!child) throw new HttpError(404, 'not_found');
    res.json({ data: child });
  } catch (err) {
    next(err);
  }
});

router.patch('/:childId', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const body = childInputSchema.partial().parse(req.body);
    const child = await prisma.child.update({
      where: { id: Number(req.params.childId) },
      data: {
        name: body.name,
        grade: body.grade === null ? null : body.grade,
        independenceLevel: body.independenceLevel,
        dateOfBirth: body.dateOfBirth === null ? null : body.dateOfBirth,
        avatarUrl: body.avatarUrl === null ? null : body.avatarUrl,
      },
    });
    res.json({ data: child });
  } catch (err) {
    next(err);
  }
});

router.delete('/:childId', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    await prisma.child.delete({ where: { id: Number(req.params.childId) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/:childId/learning-profile', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const profile = await prisma.learningProfile.findUnique({ where: { childId: Number(req.params.childId) } });
    res.json({ data: profile });
  } catch (err) {
    next(err);
  }
});

const learningProfileInputSchema = z.object({
  learningGoals: z.array(z.string().min(1).max(200)).max(20).nullable().optional(),
  interests: z.array(z.string().min(1).max(100)).max(20).nullable().optional(),
  learningPaceLabel: z.string().max(50).nullable().optional(),
  preferredSessionLengthMinutes: z.number().int().min(5).max(240).nullable().optional(),
});

// Evolving, parent-editable at any time — not a one-time onboarding capture. Feeds AI
// curriculum generation's prompt context (ai.ts reads these same fields); until a parent
// fills this in, that context is legitimately empty rather than invented.
router.patch('/:childId/learning-profile', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const body = learningProfileInputSchema.parse(req.body);
    const profile = await prisma.learningProfile.upsert({
      where: { childId: Number(req.params.childId) },
      update: {
        learningGoals: body.learningGoals === null ? Prisma.JsonNull : (body.learningGoals as never),
        interests: body.interests === null ? Prisma.JsonNull : (body.interests as never),
        learningPaceLabel: body.learningPaceLabel === null ? null : body.learningPaceLabel,
        preferredSessionLengthMinutes: body.preferredSessionLengthMinutes === null ? null : body.preferredSessionLengthMinutes,
      },
      create: {
        childId: Number(req.params.childId),
        learningGoals: (body.learningGoals as never) ?? undefined,
        interests: (body.interests as never) ?? undefined,
        learningPaceLabel: body.learningPaceLabel ?? undefined,
        preferredSessionLengthMinutes: body.preferredSessionLengthMinutes ?? undefined,
      },
    });
    res.json({ data: profile });
  } catch (err) {
    next(err);
  }
});
