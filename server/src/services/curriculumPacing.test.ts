import { describe, expect, it } from 'vitest';
import { computePacingDates } from './curriculumPacing.js';

// Local-time (not UTC) date formatting to match computePacingDates' own local-time
// Date manipulation — using toISOString() here would shift the day near midnight
// depending on the test runner's timezone offset.
function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

describe('computePacingDates', () => {
  it('places one item per matching school day, in order, starting no earlier than startDate', () => {
    const monday = new Date(2026, 7, 24); // 2026-08-24 is a Monday
    const dates = computePacingDates(3, [1, 3, 5], monday); // Mon/Wed/Fri

    expect(dates).toHaveLength(3);
    expect(ymd(dates[0])).toBe('2026-08-24'); // Monday
    expect(ymd(dates[1])).toBe('2026-08-26'); // Wednesday
    expect(ymd(dates[2])).toBe('2026-08-28'); // Friday
  });

  it('skips non-school days entirely', () => {
    const monday = new Date(2026, 7, 24);
    const dates = computePacingDates(2, [6, 7], monday); // only Sat/Sun

    expect(ymd(dates[0])).toBe('2026-08-29'); // Saturday
    expect(ymd(dates[1])).toBe('2026-08-30'); // Sunday
  });

  it('falls back to Monday-Friday when given no school days', () => {
    const saturday = new Date(2026, 7, 22);
    const dates = computePacingDates(2, [], saturday);

    expect(ymd(dates[0])).toBe('2026-08-24'); // next Monday
    expect(ymd(dates[1])).toBe('2026-08-25'); // Tuesday
  });

  it('deduplicates repeated day-of-week entries without changing the result', () => {
    const monday = new Date(2026, 7, 24);
    const a = computePacingDates(4, [1, 1, 1, 3], monday);
    const b = computePacingDates(4, [1, 3], monday);
    expect(a.map(ymd)).toEqual(b.map(ymd));
  });

  it('returns an empty array for zero items', () => {
    expect(computePacingDates(0, [1, 2, 3, 4, 5], new Date())).toEqual([]);
  });
});
