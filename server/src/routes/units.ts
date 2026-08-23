import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';

const unitInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).nullable().optional(),
  targetCompletionDate: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/** Mounted at /subjects/:subjectId/units */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/', requireOwnership('subject', 'subjectId'), async (req, res, next) => {
  try {
    const units = await prisma.unit.findMany({
      where: { subjectId: Number(req.params.subjectId) },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ data: units });
  } catch (err) {
    next(err);
  }
});

nestedRouter.post('/', requireOwnership('subject', 'subjectId'), async (req, res, next) => {
  try {
    const body = unitInputSchema.parse(req.body);
    const unit = await prisma.unit.create({
      data: {
        subjectId: Number(req.params.subjectId),
        name: body.name,
        description: body.description ?? undefined,
        targetCompletionDate: body.targetCompletionDate ?? undefined,
      },
    });
    res.status(201).json({ data: unit });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /units */
export const itemRouter = Router();
itemRouter.use(requireAuth);

itemRouter.get('/:unitId', requireOwnership('unit', 'unitId'), async (req, res, next) => {
  try {
    const unit = await prisma.unit.findUnique({ where: { id: Number(req.params.unitId) } });
    if (!unit) throw new HttpError(404, 'not_found');
    res.json({ data: unit });
  } catch (err) {
    next(err);
  }
});

itemRouter.patch('/:unitId', requireOwnership('unit', 'unitId'), async (req, res, next) => {
  try {
    const body = unitInputSchema.partial().parse(req.body);
    const unit = await prisma.unit.update({
      where: { id: Number(req.params.unitId) },
      data: {
        name: body.name,
        description: body.description === null ? null : body.description,
        targetCompletionDate: body.targetCompletionDate === null ? null : body.targetCompletionDate,
        sortOrder: body.sortOrder,
      },
    });
    res.json({ data: unit });
  } catch (err) {
    next(err);
  }
});

itemRouter.delete('/:unitId', requireOwnership('unit', 'unitId'), async (req, res, next) => {
  try {
    await prisma.unit.delete({ where: { id: Number(req.params.unitId) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
