import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';

const slotInputSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotType: z.enum(['micro', 'standard']).optional(),
  isActive: z.boolean().optional(),
});

/** Mounted at /children/:childId/review-slots */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const slots = await prisma.reviewSlot.findMany({
      where: { childId: Number(req.params.childId) },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json({ data: slots });
  } catch (err) {
    next(err);
  }
});

nestedRouter.post('/', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const body = slotInputSchema.parse(req.body);
    const slot = await prisma.reviewSlot.create({
      data: {
        childId: Number(req.params.childId),
        dayOfWeek: body.dayOfWeek,
        startTime: body.startTime,
        endTime: body.endTime,
        slotType: body.slotType ?? 'micro',
        isActive: body.isActive ?? true,
      },
    });
    res.status(201).json({ data: slot });
  } catch (err) {
    next(err);
  }
});

/** Default schedule the original app intended for every new child (2 micro-slots/day) but
 * never actually wired up automatically — exposed here as an explicit action instead. */
nestedRouter.post('/create-defaults', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const childId = Number(req.params.childId);
    const existing = await prisma.reviewSlot.count({ where: { childId } });
    if (existing > 0) throw new HttpError(409, 'slots_already_exist');

    const slots = await prisma.$transaction(
      Array.from({ length: 7 }, (_, i) => i + 1).flatMap((dayOfWeek) => [
        prisma.reviewSlot.create({ data: { childId, dayOfWeek, startTime: '08:00', endTime: '08:05', slotType: 'micro' } }),
        prisma.reviewSlot.create({ data: { childId, dayOfWeek, startTime: '19:30', endTime: '19:35', slotType: 'micro' } }),
      ])
    );
    res.status(201).json({ data: slots });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /review-slots */
export const itemRouter = Router();
itemRouter.use(requireAuth);

itemRouter.patch('/:slotId', requireOwnership('reviewSlot', 'slotId'), async (req, res, next) => {
  try {
    const body = slotInputSchema.partial().parse(req.body);
    const slot = await prisma.reviewSlot.update({ where: { id: Number(req.params.slotId) }, data: body });
    res.json({ data: slot });
  } catch (err) {
    next(err);
  }
});

itemRouter.patch('/:slotId/toggle', requireOwnership('reviewSlot', 'slotId'), async (req, res, next) => {
  try {
    const slotId = Number(req.params.slotId);
    const existing = await prisma.reviewSlot.findUniqueOrThrow({ where: { id: slotId } });
    const slot = await prisma.reviewSlot.update({ where: { id: slotId }, data: { isActive: !existing.isActive } });
    res.json({ data: slot });
  } catch (err) {
    next(err);
  }
});

itemRouter.delete('/:slotId', requireOwnership('reviewSlot', 'slotId'), async (req, res, next) => {
  try {
    await prisma.reviewSlot.delete({ where: { id: Number(req.params.slotId) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
