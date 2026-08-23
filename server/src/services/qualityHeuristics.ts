import { prisma } from '../lib/prisma.js';

export interface QualityWarning {
  code: string;
  message: string;
}

type AgeGroup = '5-8' | '9-12' | '13-15' | '16+';

// Matches the age-group buckets documented for the original app's Quality Heuristics
// system (CLAUDE.md "Milestone 6"): younger children get shorter sessions and lower daily
// caps; the limits themselves are a reasonable first-pass homeschool planning heuristic,
// not pulled from a specific external source.
export const AGE_GROUP_LIMITS: Record<AgeGroup, { maxSessionMinutes: number; maxDailyMinutes: number; maxSessionsPerDay: number }> = {
  '5-8': { maxSessionMinutes: 30, maxDailyMinutes: 120, maxSessionsPerDay: 4 },
  '9-12': { maxSessionMinutes: 45, maxDailyMinutes: 180, maxSessionsPerDay: 6 },
  '13-15': { maxSessionMinutes: 60, maxDailyMinutes: 240, maxSessionsPerDay: 7 },
  '16+': { maxSessionMinutes: 90, maxDailyMinutes: 300, maxSessionsPerDay: 8 },
};

const YOUNG_GRADES = ['PreK', 'K', '1st', '2nd', '3rd'];
const ELEMENTARY_GRADES = ['4th', '5th', '6th', '7th'];
const MIDDLE_GRADES = ['8th', '9th', '10th'];

export function ageGroupForGrade(grade: string | null): AgeGroup {
  if (!grade) return '9-12';
  if (YOUNG_GRADES.includes(grade)) return '5-8';
  if (ELEMENTARY_GRADES.includes(grade)) return '9-12';
  if (MIDDLE_GRADES.includes(grade)) return '13-15';
  return '16+'; // 11th, 12th, or anything unrecognized defaults to the most permissive band
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Warnings, not blocks (per the plan): a session that trips these is still created/
 * scheduled — the caller surfaces `warnings` to the parent, who decides whether to adjust.
 */
export async function evaluateSessionQuality(params: {
  childId: number;
  estimatedMinutes: number;
  scheduledDate?: Date | null;
  excludeSessionId?: number;
}): Promise<QualityWarning[]> {
  const { childId, estimatedMinutes, scheduledDate, excludeSessionId } = params;
  const warnings: QualityWarning[] = [];

  const child = await prisma.child.findUniqueOrThrow({ where: { id: childId } });
  const ageGroup = ageGroupForGrade(child.grade);
  const limits = AGE_GROUP_LIMITS[ageGroup];

  if (estimatedMinutes > limits.maxSessionMinutes) {
    warnings.push({
      code: 'session_too_long',
      message: `This session is ${estimatedMinutes} min — longer than the ${limits.maxSessionMinutes} min recommended for ${child.name}'s age group.`,
    });
  }

  if (scheduledDate) {
    const dayStart = startOfDay(scheduledDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const sameDaySessions = await prisma.learningSession.findMany({
      where: {
        childId,
        scheduledDate: { gte: dayStart, lte: dayEnd },
        status: { not: 'done' },
        id: excludeSessionId ? { not: excludeSessionId } : undefined,
      },
      select: { estimatedMinutes: true },
    });

    const sessionCount = sameDaySessions.length + 1;
    const totalMinutes = sameDaySessions.reduce((sum, s) => sum + s.estimatedMinutes, 0) + estimatedMinutes;

    if (sessionCount > limits.maxSessionsPerDay) {
      warnings.push({
        code: 'too_many_sessions',
        message: `${sessionCount} sessions are now scheduled this day — above the recommended max of ${limits.maxSessionsPerDay} for ${child.name}'s age group.`,
      });
    }
    if (totalMinutes > limits.maxDailyMinutes) {
      warnings.push({
        code: 'daily_capacity_exceeded',
        message: `${totalMinutes} total minutes are scheduled this day — above the recommended daily max of ${limits.maxDailyMinutes} min.`,
      });
    }
  }

  return warnings;
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface ScheduleAnalysis {
  ageGroup: AgeGroup;
  maxDailyMinutes: number;
  daysExceedingAgeLimit: number;
  recommendations: string[];
}

/**
 * Aggregate, whole-week counterpart to evaluateSessionQuality's per-session check —
 * powers the Planning Board's quality-analysis panel. Flags days where a child's *already
 * scheduled* total exceeds their age group's recommended daily minutes (independent of
 * whether time blocks even exist that day — that's what the capacity meter covers instead).
 */
export async function analyzeChildSchedule(childId: number): Promise<ScheduleAnalysis> {
  const child = await prisma.child.findUniqueOrThrow({ where: { id: childId } });
  const ageGroup = ageGroupForGrade(child.grade);
  const { maxDailyMinutes } = AGE_GROUP_LIMITS[ageGroup];

  const scheduled = await prisma.learningSession.findMany({
    where: { childId, status: 'scheduled', scheduledDayOfWeek: { not: null } },
    select: { scheduledDayOfWeek: true, estimatedMinutes: true },
  });

  const minutesByDay = new Map<number, number>();
  for (const session of scheduled) {
    const day = session.scheduledDayOfWeek!;
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + session.estimatedMinutes);
  }

  const recommendations: string[] = [];
  let daysExceedingAgeLimit = 0;
  for (const [day, minutes] of minutesByDay) {
    if (minutes > maxDailyMinutes) {
      daysExceedingAgeLimit++;
      recommendations.push(
        `${DAY_NAMES[day]} has ${minutes} min scheduled — above the ${maxDailyMinutes} min recommended for ${child.name}'s age group.`
      );
    }
  }

  return { ageGroup, maxDailyMinutes, daysExceedingAgeLimit, recommendations };
}
