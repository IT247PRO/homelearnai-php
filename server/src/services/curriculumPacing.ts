import { prisma } from '../lib/prisma.js';

/** Matches the app-wide TimeBlock/LearningSession convention used by scheduling.ts:
 * dayOfWeek is 1-7, Monday-Sunday (not JS Date.getDay()'s 0-6 Sunday-first). */
function appDayOfWeek(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const DEFAULT_SCHOOL_DAYS = [1, 2, 3, 4, 5]; // Monday-Friday

/**
 * A deliberately scoped-down pacing engine (plan2.md §26): spreads `itemCount` sequential
 * items one-per-school-day across `schoolDaysOfWeek` (1-7, Mon-Sun), starting no earlier
 * than `startDate`. No holiday calendar or per-lesson-duration capacity awareness — just
 * "which days of the week does this child actually do schoolwork on".
 */
export function computePacingDates(itemCount: number, schoolDaysOfWeek: number[], startDate: Date): Date[] {
  const days = schoolDaysOfWeek.length > 0 ? [...new Set(schoolDaysOfWeek)] : DEFAULT_SCHOOL_DAYS;
  const dates: Date[] = [];

  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  // Cap the search window generously (a year) so a pathological input can't loop forever.
  const maxProbe = 366;
  let probed = 0;

  while (dates.length < itemCount && probed < maxProbe) {
    if (days.includes(appDayOfWeek(cursor))) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
    probed++;
  }

  // If the child's school days are so sparse the year-long probe ran out, pad the remainder
  // one calendar day apart rather than leaving items unscheduled.
  while (dates.length < itemCount) {
    const last = dates[dates.length - 1] ?? addDays(startDate, -1);
    dates.push(addDays(last, 1));
  }

  return dates;
}

/** DB-backed wrapper: looks up the child's actual TimeBlock day-of-week pattern (falling
 * back to Mon-Fri when the child has none configured) and paces `itemCount` sequential
 * items starting at `startDate` (default: tomorrow). */
export async function assignPacingDates(childId: number, itemCount: number, startDate?: Date): Promise<Date[]> {
  const timeBlocks = await prisma.timeBlock.findMany({ where: { childId }, select: { dayOfWeek: true } });
  const schoolDays = [...new Set(timeBlocks.map((tb) => tb.dayOfWeek))];

  const start = startDate ?? addDays(new Date(), 1);
  return computePacingDates(itemCount, schoolDays, start);
}
