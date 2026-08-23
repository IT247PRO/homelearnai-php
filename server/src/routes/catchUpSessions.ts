import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { redistributeCatchUps } from '../services/scheduling.js';

/** Mounted at /children/:childId/catch-up-sessions */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const catchUps = await prisma.catchUpSession.findMany({
      where: { childId: Number(req.params.childId) },
      include: { topic: true },
      orderBy: [{ priority: 'asc' }, { missedDate: 'asc' }],
    });
    res.json({ data: catchUps });
  } catch (err) {
    next(err);
  }
});

nestedRouter.post('/redistribute', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const result = await redistributeCatchUps(Number(req.params.childId));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /catch-up-sessions */
export const itemRouter = Router();
itemRouter.use(requireAuth);

const priorityUpdateSchema = z.object({ priority: z.number().int().min(1).max(5) });

itemRouter.patch('/:catchUpId/priority', requireOwnership('catchUpSession', 'catchUpId'), async (req, res, next) => {
  try {
    const { priority } = priorityUpdateSchema.parse(req.body);
    const catchUp = await prisma.catchUpSession.update({ where: { id: Number(req.params.catchUpId) }, data: { priority } });
    res.json({ data: catchUp });
  } catch (err) {
    next(err);
  }
});

const statusUpdateSchema = z.object({ status: z.enum(['pending', 'reassigned', 'completed', 'cancelled']) });

itemRouter.patch('/:catchUpId', requireOwnership('catchUpSession', 'catchUpId'), async (req, res, next) => {
  try {
    const { status } = statusUpdateSchema.parse(req.body);
    const catchUp = await prisma.catchUpSession.update({ where: { id: Number(req.params.catchUpId) }, data: { status } });
    res.json({ data: catchUp });
  } catch (err) {
    next(err);
  }
});
