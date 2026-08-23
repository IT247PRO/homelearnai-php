import { describe, expect, it } from 'vitest';
import { processReviewResult, type ReviewState } from './spacedRepetition.js';

const fresh: ReviewState = { intervalDays: 1, easeFactor: 2.5, repetitions: 0, status: 'new' };

describe('processReviewResult', () => {
  it('again resets repetitions, interval, and drops the ease factor', () => {
    const result = processReviewResult(fresh, 'again');
    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(1);
    expect(result.status).toBe('learning');
    expect(result.easeFactor).toBeCloseTo(2.3);
  });

  it('never drops the ease factor below 1.3', () => {
    let state: ReviewState = { intervalDays: 5, easeFactor: 1.35, repetitions: 3, status: 'reviewing' };
    state = processReviewResult(state, 'again');
    expect(state.easeFactor).toBeCloseTo(1.3);
  });

  it('hard shrinks toward a 1.2x interval and stays in learning until the 2nd repetition', () => {
    const first = processReviewResult(fresh, 'hard');
    expect(first.repetitions).toBe(1);
    expect(first.intervalDays).toBe(1); // max(1, round(1*1.2)) = 1
    expect(first.status).toBe('learning');
    expect(first.easeFactor).toBeCloseTo(2.35);

    const second = processReviewResult({ ...first }, 'hard');
    expect(second.repetitions).toBe(2);
    expect(second.status).toBe('reviewing');
  });

  it('good hard-codes the 1st/2nd successful review to 3 and 7 days', () => {
    const first = processReviewResult(fresh, 'good');
    expect(first.repetitions).toBe(1);
    expect(first.intervalDays).toBe(3);
    expect(first.status).toBe('learning');

    const second = processReviewResult({ ...first }, 'good');
    expect(second.repetitions).toBe(2);
    expect(second.intervalDays).toBe(7);
    expect(second.status).toBe('reviewing');

    const third = processReviewResult({ ...second }, 'good');
    expect(third.repetitions).toBe(3);
    expect(third.intervalDays).toBe(18); // round(7 * 2.5) = 17.5 -> 18
    expect(third.status).toBe('reviewing');
  });

  it('good caps the interval at 240 days', () => {
    const state: ReviewState = { intervalDays: 200, easeFactor: 2.5, repetitions: 5, status: 'reviewing' };
    const result = processReviewResult(state, 'good');
    expect(result.intervalDays).toBe(240);
  });

  it('easy grows the interval by ease*1.3 and raises the ease factor', () => {
    const first = processReviewResult(fresh, 'easy');
    expect(first.repetitions).toBe(1);
    expect(first.intervalDays).toBe(3); // round(1 * 2.5 * 1.3) = 3.25 -> 3
    expect(first.easeFactor).toBeCloseTo(2.5); // already at MAX_EASE_FACTOR
    expect(first.status).toBe('learning');
  });

  it('easy transitions to mastered after enough consecutive easy reviews', () => {
    let state: ReviewState = fresh;
    const intervals: number[] = [];
    const statuses: string[] = [];
    for (let i = 0; i < 5; i++) {
      state = processReviewResult(state, 'easy');
      intervals.push(state.intervalDays);
      statuses.push(state.status);
    }

    expect(intervals).toEqual([3, 10, 33, 107, 240]);
    expect(statuses).toEqual(['learning', 'reviewing', 'reviewing', 'reviewing', 'mastered']);
    expect(state.repetitions).toBe(5);
  });

  it('sets dueDate to now + intervalDays', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const result = processReviewResult(fresh, 'good', now);
    expect(result.dueDate.toISOString()).toBe('2026-01-04T00:00:00.000Z');
  });
});
