import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';

/** Mounted at /children/:childId/gamification */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const childId = Number(req.params.childId);
    const [state, achievements] = await Promise.all([
      prisma.childGamificationState.findUnique({ where: { childId } }),
      prisma.childAchievement.findMany({ where: { childId }, include: { achievement: true }, orderBy: { earnedAt: 'desc' } }),
    ]);
    res.json({ data: { state, achievements } });
  } catch (err) {
    next(err);
  }
});

const settingsSchema = z.object({ gamificationEnabled: z.boolean() });

nestedRouter.patch('/', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const body = settingsSchema.parse(req.body);
    const childId = Number(req.params.childId);
    const state = await prisma.childGamificationState.upsert({
      where: { childId },
      update: body,
      create: { childId, ...body },
    });
    res.json({ data: state });
  } catch (err) {
    next(err);
  }
});
