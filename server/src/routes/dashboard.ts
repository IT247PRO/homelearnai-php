import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { buildReviewQueue } from '../services/spacedRepetition.js';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

/** Mounted at /children/:childId/dashboard — the per-child summary for the parent
 * dashboard and (a reduced view of) the child's own dashboard. */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const childId = Number(req.params.childId);
    const today = startOfDay(new Date());
    const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
    const weekAgo = daysAgo(7);

    const [
      child,
      todaySessions,
      completedThisWeek,
      allSessionsThisWeek,
      masteryRows,
      pendingCatchUps,
      reviewQueue,
      gamificationState,
      recentAchievements,
      pendingRecommendations,
      unacknowledgedInsights,
    ] = await Promise.all([
      prisma.child.findUniqueOrThrow({ where: { id: childId } }),
      prisma.learningSession.findMany({
        where: { childId, OR: [{ scheduledDate: { gte: today, lte: endOfToday } }, { status: 'planned', scheduledDate: null }] },
        include: { topic: true },
      }),
      prisma.learningSession.findMany({
        where: { childId, status: 'done', completedAt: { gte: weekAgo } },
        select: { estimatedMinutes: true },
      }),
      prisma.learningSession.count({ where: { childId, createdAt: { gte: weekAgo } } }),
      prisma.mastery.groupBy({ by: ['state'], where: { childId }, _count: { state: true } }),
      prisma.catchUpSession.count({ where: { childId, status: 'pending' } }),
      buildReviewQueue(childId),
      prisma.childGamificationState.findUnique({ where: { childId } }),
      prisma.childAchievement.findMany({ where: { childId }, include: { achievement: true }, orderBy: { earnedAt: 'desc' }, take: 5 }),
      prisma.aiRecommendation.findMany({ where: { childId, status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.aiInsight.count({ where: { childId, isAcknowledgedByParent: false } }),
    ]);

    const masteryBreakdown = Object.fromEntries(masteryRows.map((r) => [r.state, r._count.state]));
    const timeSpentMinutesThisWeek = completedThisWeek.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const completionRateThisWeek = allSessionsThisWeek > 0 ? completedThisWeek.length / allSessionsThisWeek : null;

    res.json({
      data: {
        child: { id: child.id, name: child.name, grade: child.grade, independenceLevel: child.independenceLevel },
        today: { sessions: todaySessions },
        analytics: {
          completedSessionsThisWeek: completedThisWeek.length,
          totalSessionsThisWeek: allSessionsThisWeek,
          completionRateThisWeek,
          timeSpentMinutesThisWeek,
        },
        mastery: masteryBreakdown,
        pendingCatchUps,
        reviewQueueSize: reviewQueue.length,
        gamification: { state: gamificationState, recentAchievements },
        aiRecommendations: pendingRecommendations,
        unacknowledgedInsightCount: unacknowledgedInsights,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /dashboard — the parent-facing overview across every child. */
export const parentRouter = Router();
parentRouter.use(requireAuth);

parentRouter.get('/', async (req, res, next) => {
  try {
    const children = await prisma.child.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: 'asc' } });
    const today = startOfDay(new Date());
    const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);

    const summaries = await Promise.all(
      children.map(async (child) => {
        const [todaySessionCount, pendingCatchUps, gamificationState, unacknowledgedInsightCount, pendingRecommendationCount] = await Promise.all([
          prisma.learningSession.count({
            where: { childId: child.id, scheduledDate: { gte: today, lte: endOfToday } },
          }),
          prisma.catchUpSession.count({ where: { childId: child.id, status: 'pending' } }),
          prisma.childGamificationState.findUnique({ where: { childId: child.id } }),
          prisma.aiInsight.count({ where: { childId: child.id, isAcknowledgedByParent: false } }),
          prisma.aiRecommendation.count({ where: { childId: child.id, status: 'pending' } }),
        ]);
        return {
          child: { id: child.id, name: child.name, grade: child.grade },
          todaySessionCount,
          pendingCatchUps,
          currentStreakDays: gamificationState?.currentStreakDays ?? 0,
          totalPoints: gamificationState?.totalPoints ?? 0,
          unacknowledgedInsightCount,
          pendingRecommendationCount,
        };
      })
    );

    res.json({ data: { children: summaries } });
  } catch (err) {
    next(err);
  }
});
