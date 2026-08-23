import { prisma } from '../lib/prisma.js';

const MAX_LOOKAHEAD_DAYS = 14;
const MAX_SESSIONS_PER_DAY = 3;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export interface DayCapacity {
  day: number;
  dayName: string;
  availableMinutes: number;
  scheduledMinutes: number;
  remainingMinutes: number;
  utilizationPercent: number;
  status: 'green' | 'yellow' | 'red';
  timeBlocksCount: number;
  sessionsCount: number;
}

/** Ported from PlanningController::calculateWeeklyCapacity() — powers the Planning Board's
 * capacity meter. Available minutes come from TimeBlock durations; scheduled minutes come
 * from LearningSessions already in 'scheduled' status for that day of week. */
export async function calculateWeeklyCapacity(childId: number): Promise<DayCapacity[]> {
  const [timeBlocks, scheduledSessions] = await Promise.all([
    prisma.timeBlock.findMany({ where: { childId } }),
    prisma.learningSession.findMany({ where: { childId, status: 'scheduled', scheduledDayOfWeek: { not: null } } }),
  ]);

  const result: DayCapacity[] = [];
  for (let day = 1; day <= 7; day++) {
    const dayTimeBlocks = timeBlocks.filter((tb) => tb.dayOfWeek === day);
    const daySessions = scheduledSessions.filter((s) => s.scheduledDayOfWeek === day);

    const availableMinutes = dayTimeBlocks.reduce((sum, tb) => sum + (timeToMinutes(tb.endTime) - timeToMinutes(tb.startTime)), 0);
    const scheduledMinutes = daySessions.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const utilizationPercent = availableMinutes > 0 ? (scheduledMinutes / availableMinutes) * 100 : 0;

    let status: DayCapacity['status'] = 'green';
    if (utilizationPercent >= 90) status = 'red';
    else if (utilizationPercent >= 75) status = 'yellow';

    result.push({
      day,
      dayName: DAY_NAMES[day],
      availableMinutes,
      scheduledMinutes,
      remainingMinutes: Math.max(0, availableMinutes - scheduledMinutes),
      utilizationPercent: Math.round(utilizationPercent * 10) / 10,
      status,
      timeBlocksCount: dayTimeBlocks.length,
      sessionsCount: daySessions.length,
    });
  }

  return result;
}

export interface RedistributionResult {
  reassigned: number;
  stillPending: number;
}

async function computeLoadByDay(childId: number, horizonStart: Date, horizonEnd: Date, excludeSessionId?: number) {
  const existingSessions = await prisma.learningSession.findMany({
    where: {
      childId,
      status: { in: ['scheduled', 'planned'] },
      scheduledDate: { gte: horizonStart, lte: horizonEnd },
      id: excludeSessionId ? { not: excludeSessionId } : undefined,
    },
    select: { scheduledDate: true },
  });

  const loadByDay = new Map<string, number>();
  for (const session of existingSessions) {
    if (!session.scheduledDate) continue;
    const key = startOfDay(session.scheduledDate).toISOString();
    loadByDay.set(key, (loadByDay.get(key) ?? 0) + 1);
  }
  return loadByDay;
}

export interface RescheduleSuggestion {
  date: Date;
  currentLoad: number;
}

/**
 * Read-only counterpart to redistributeCatchUps: suggests the least-loaded upcoming days
 * for one specific session, without moving anything — the parent picks manually via the
 * existing schedule endpoint. Reuses the same day-capacity accounting.
 */
export async function suggestRescheduleSlots(sessionId: number, now: Date = new Date()): Promise<RescheduleSuggestion[]> {
  const session = await prisma.learningSession.findUniqueOrThrow({ where: { id: sessionId } });

  const today = startOfDay(now);
  const horizonStart = addDays(today, 1);
  const horizonEnd = addDays(today, MAX_LOOKAHEAD_DAYS);
  const loadByDay = await computeLoadByDay(session.childId, horizonStart, horizonEnd, sessionId);

  const candidates: RescheduleSuggestion[] = [];
  for (let offset = 1; offset <= MAX_LOOKAHEAD_DAYS; offset++) {
    const date = addDays(today, offset);
    candidates.push({ date, currentLoad: loadByDay.get(date.toISOString()) ?? 0 });
  }

  return candidates.sort((a, b) => a.currentLoad - b.currentLoad || a.date.getTime() - b.date.getTime()).slice(0, 5);
}

/**
 * Priority-ordered workload balancer: takes every pending CatchUpSession for a child
 * (most urgent priority first, then oldest miss first) and slots each into the earliest
 * upcoming day that isn't already at capacity, rather than dumping everything onto
 * tomorrow. Each reassignment materializes a real (flexible-commitment) LearningSession.
 */
export async function redistributeCatchUps(childId: number, now: Date = new Date()): Promise<RedistributionResult> {
  const pending = await prisma.catchUpSession.findMany({
    where: { childId, status: 'pending' },
    orderBy: [{ priority: 'asc' }, { missedDate: 'asc' }],
    include: { topic: true },
  });
  if (pending.length === 0) return { reassigned: 0, stillPending: 0 };

  const today = startOfDay(now);
  const horizonStart = addDays(today, 1);
  const horizonEnd = addDays(today, MAX_LOOKAHEAD_DAYS);

  const existingSessions = await prisma.learningSession.findMany({
    where: {
      childId,
      status: { in: ['scheduled', 'planned'] },
      scheduledDate: { gte: horizonStart, lte: horizonEnd },
    },
    select: { scheduledDate: true },
  });

  const loadByDay = new Map<string, number>();
  for (const session of existingSessions) {
    if (!session.scheduledDate) continue;
    const key = startOfDay(session.scheduledDate).toISOString();
    loadByDay.set(key, (loadByDay.get(key) ?? 0) + 1);
  }

  let reassigned = 0;
  for (const catchUp of pending) {
    let slot: Date | null = null;
    for (let offset = 1; offset <= MAX_LOOKAHEAD_DAYS; offset++) {
      const candidate = addDays(today, offset);
      const key = candidate.toISOString();
      const load = loadByDay.get(key) ?? 0;
      if (load < MAX_SESSIONS_PER_DAY) {
        slot = candidate;
        loadByDay.set(key, load + 1);
        break;
      }
    }

    if (!slot) continue; // no capacity within the lookahead window — leave pending

    const newSession = await prisma.learningSession.create({
      data: {
        childId,
        topicId: catchUp.topicId,
        estimatedMinutes: catchUp.estimatedMinutes,
        status: 'scheduled',
        commitmentType: 'flexible',
        scheduledDate: slot,
      },
    });
    await prisma.catchUpSession.update({
      where: { id: catchUp.id },
      data: { status: 'reassigned', reassignedToSessionId: newSession.id },
    });
    reassigned++;
  }

  return { reassigned, stillPending: pending.length - reassigned };
}
