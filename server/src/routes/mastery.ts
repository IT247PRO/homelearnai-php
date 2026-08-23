import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';

/** Mounted at /children/:childId/mastery */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const mastery = await prisma.mastery.findMany({
      where: { childId: Number(req.params.childId) },
      include: { topic: { include: { unit: { include: { subject: true } } } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ data: mastery });
  } catch (err) {
    next(err);
  }
});
