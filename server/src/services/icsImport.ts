import ical from 'node-ical';

export interface ParsedEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
}

const MAX_OCCURRENCES_PER_EVENT = 100;
const MAX_MONTHS_AHEAD = 6;

function monthsFromNow(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

// rrule's own `.between()`/`.all()` have a confirmed timezone bug: even with a correct
// UTC dtstart and `tzid: 'Etc/UTC'`, occurrences come back shifted by the *system's local*
// UTC offset (verified empirically — a 15:00Z weekly DTSTART produced 10:00Z occurrences on
// a UTC-5 host). event.start and rrule.origOptions.dtstart are unaffected and correct, so
// occurrences are expanded here by hand from those reliable values instead of trusting
// rrule's date math.
function addInterval(date: Date, freq: number, interval: number): Date {
  const RRULE_YEARLY = 0;
  const RRULE_MONTHLY = 1;
  const RRULE_WEEKLY = 2;
  const RRULE_DAILY = 3;
  const RRULE_HOURLY = 4;
  const RRULE_MINUTELY = 5;
  const RRULE_SECONDLY = 6;

  const next = new Date(date);
  switch (freq) {
    case RRULE_YEARLY:
      next.setFullYear(next.getFullYear() + interval);
      return next;
    case RRULE_MONTHLY:
      next.setMonth(next.getMonth() + interval);
      return next;
    case RRULE_WEEKLY:
      return new Date(next.getTime() + interval * 7 * 24 * 60 * 60 * 1000);
    case RRULE_DAILY:
      return new Date(next.getTime() + interval * 24 * 60 * 60 * 1000);
    case RRULE_HOURLY:
      return new Date(next.getTime() + interval * 60 * 60 * 1000);
    case RRULE_MINUTELY:
      return new Date(next.getTime() + interval * 60 * 1000);
    case RRULE_SECONDLY:
      return new Date(next.getTime() + interval * 1000);
    default:
      return next;
  }
}

/**
 * Parses raw ICS text and expands recurring events (RRULE) into individual occurrences,
 * capped at 100 occurrences per event and never beyond 6 months out — matching the
 * original hand-rolled importer's safety limits. Supports FREQ=DAILY|WEEKLY|MONTHLY (plus
 * YEARLY/HOURLY/MINUTELY/SECONDLY); an unrecognized frequency yields just the base
 * occurrence, same as the original importer's fallback.
 */
export function expandIcsEvents(icsContent: string, now: Date = new Date()): ParsedEvent[] {
  const parsed = ical.sync.parseICS(icsContent);
  const horizon = monthsFromNow(MAX_MONTHS_AHEAD);
  const events: ParsedEvent[] = [];

  for (const component of Object.values(parsed)) {
    if (component.type !== 'VEVENT') continue;
    const event = component as ical.VEvent;
    if (!event.start) continue;
    const durationMs = event.end ? event.end.getTime() - event.start.getTime() : 60 * 60 * 1000;

    if (event.rrule && event.rrule.origOptions.freq !== undefined) {
      const { freq, interval, count, until } = event.rrule.origOptions;
      const effectiveInterval = interval ?? 1;
      let occurrenceStart: Date = new Date(event.start.getTime());
      let occurrenceCount = 0;

      while (occurrenceCount < MAX_OCCURRENCES_PER_EVENT && occurrenceStart <= horizon) {
        if (until && occurrenceStart > until) break;
        if (occurrenceStart >= now) {
          events.push({
            uid: `${event.uid}:${occurrenceStart.toISOString()}`,
            summary: event.summary ?? 'Untitled event',
            description: event.description,
            location: event.location,
            start: occurrenceStart,
            end: new Date(occurrenceStart.getTime() + durationMs),
          });
        }
        occurrenceCount++;
        if (count && occurrenceCount >= count) break;
        occurrenceStart = addInterval(occurrenceStart, freq, effectiveInterval);
      }
    } else if (event.start >= now && event.start <= horizon) {
      events.push({
        uid: event.uid ?? `${event.summary}:${event.start.toISOString()}`,
        summary: event.summary ?? 'Untitled event',
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end ?? new Date(event.start.getTime() + durationMs),
      });
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function validateIcsContent(content: string): void {
  if (!content.includes('BEGIN:VCALENDAR')) {
    throw new Error('File does not look like a valid ICS calendar (missing BEGIN:VCALENDAR)');
  }
}

function toHHmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// ISO day-of-week: Monday = 1 ... Sunday = 7, matching the original TimeBlock convention.
function toIsoDayOfWeek(date: Date): number {
  const jsDay = date.getDay(); // 0 = Sunday
  return jsDay === 0 ? 7 : jsDay;
}

export function eventToTimeBlockData(event: ParsedEvent, childId: number) {
  return {
    childId,
    dayOfWeek: toIsoDayOfWeek(event.start),
    startTime: toHHmm(event.start),
    endTime: toHHmm(event.end),
    label: event.summary,
    isImported: true,
    commitmentType: 'fixed',
    sourceUid: event.uid,
  };
}
