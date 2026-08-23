import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { calculateWeeklyCapacity } from '../services/scheduling.js';
import { analyzeChildSchedule } from '../services/qualityHeuristics.js';

/** Mounted at /children/:childId/planning — read-only aggregate views backing the
 * Planning Board's capacity meter and quality-analysis panel (session mutations
 * themselves stay on the existing /learning-sessions and /catch-up-sessions routes). */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/capacity', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const capacity = await calculateWeeklyCapacity(Number(req.params.childId));
    res.json({ data: capacity });
  } catch (err) {
    next(err);
  }
});

nestedRouter.get('/quality-analysis', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const analysis = await analyzeChildSchedule(Number(req.params.childId));
    res.json({ data: analysis });
  } catch (err) {
    next(err);
  }
});
