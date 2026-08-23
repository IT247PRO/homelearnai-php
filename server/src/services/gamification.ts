import { prisma } from '../lib/prisma.js';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / (24 * 60 * 60 * 1000));
}

interface AchievementCriteria {
  type: 'streak_days' | 'topics_mastered' | 'total_points';
  value: number;
}

/**
 * Motivation, not compulsion, per plan.md's explicit instruction ("do not create addictive
 * mechanics"): a simple points/streak/badge model with no push notifications, no urgency
 * timers, and a parent-facing on/off switch (ChildGamificationState.gamificationEnabled).
 */
export async function recordActivity(childId: number, points: number, now: Date = new Date()) {
  const state =
    (await prisma.childGamificationState.findUnique({ where: { childId } })) ??
    (await prisma.childGamificationState.create({ data: { childId } }));

  if (!state.gamificationEnabled) return state;

  let currentStreakDays = state.currentStreakDays;
  if (!state.lastActivityDate) {
    currentStreakDays = 1;
  } else {
    const gap = daysBetween(now, state.lastActivityDate);
    if (gap === 0) {
      // already recorded activity today — streak unchanged
    } else if (gap === 1) {
      currentStreakDays += 1;
    } else {
      currentStreakDays = 1;
    }
  }

  const totalPoints = state.totalPoints + points;
  const longestStreakDays = Math.max(state.longestStreakDays, currentStreakDays);
  const level = Math.floor(totalPoints / 100) + 1;

  const updated = await prisma.childGamificationState.update({
    where: { childId },
    data: { totalPoints, level, currentStreakDays, longestStreakDays, lastActivityDate: now },
  });

  await evaluateAchievements(childId, updated);
  return updated;
}

async function evaluateAchievements(
  childId: number,
  state: { totalPoints: number; currentStreakDays: number }
) {
  const [achievements, earned, masteredCount] = await Promise.all([
    prisma.achievement.findMany(),
    prisma.childAchievement.findMany({ where: { childId } }),
    prisma.mastery.count({ where: { childId, state: 'mastered' } }),
  ]);
  const earnedIds = new Set(earned.map((e) => e.achievementId));

  for (const achievement of achievements) {
    if (earnedIds.has(achievement.id)) continue;
    const criteria = achievement.criteria as unknown as AchievementCriteria;

    const met =
      (criteria.type === 'streak_days' && state.currentStreakDays >= criteria.value) ||
      (criteria.type === 'total_points' && state.totalPoints >= criteria.value) ||
      (criteria.type === 'topics_mastered' && masteredCount >= criteria.value);

    if (met) {
      await prisma.childAchievement.create({ data: { childId, achievementId: achievement.id } });
    }
  }
}
