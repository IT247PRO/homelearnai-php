import { describe, expect, it } from 'vitest';
import { canAdvancePastSection, computeHintResponse, computeLessonWasCorrect } from './lessonProgress.js';

describe('canAdvancePastSection', () => {
  it('always allows advancing past a non-interactive section', () => {
    expect(canAdvancePastSection(null, [])).toBe(true);
    expect(canAdvancePastSection(undefined, [])).toBe(true);
  });

  it('blocks an interactive section with no responses yet', () => {
    expect(canAdvancePastSection('multiple_choice', [])).toBe(false);
  });

  it('blocks an interactive section after a single wrong attempt', () => {
    expect(canAdvancePastSection('multiple_choice', [{ isCorrect: false }])).toBe(false);
  });

  it('allows advancing as soon as the latest response is correct', () => {
    expect(canAdvancePastSection('multiple_choice', [{ isCorrect: false }, { isCorrect: true }])).toBe(true);
  });

  it('releases the child after 3 attempts even if still wrong (no dead end)', () => {
    expect(canAdvancePastSection('short_answer', [{ isCorrect: false }, { isCorrect: false }, { isCorrect: false }])).toBe(true);
  });
});

describe('computeHintResponse', () => {
  const hints = ['Think about what a numerator means.', 'The denominator is the total number of equal parts.'];

  it('returns no hint when the answer is correct', () => {
    expect(computeHintResponse(hints, 1, true)).toEqual({ revealAnswer: false });
  });

  it('returns the first hint on the first wrong attempt', () => {
    expect(computeHintResponse(hints, 1, false)).toEqual({ hint: hints[0], revealAnswer: false });
  });

  it('returns the second hint on the second wrong attempt', () => {
    expect(computeHintResponse(hints, 2, false)).toEqual({ hint: hints[1], revealAnswer: false });
  });

  it('falls back to the only hint available if a second was never authored', () => {
    expect(computeHintResponse([hints[0]], 2, false)).toEqual({ hint: hints[0], revealAnswer: false });
  });

  it('reveals the answer instead of gating further after the second wrong attempt', () => {
    expect(computeHintResponse(hints, 3, false)).toEqual({ revealAnswer: true });
  });

  it('handles a section with no hints authored at all', () => {
    expect(computeHintResponse(null, 1, false)).toEqual({ hint: undefined, revealAnswer: false });
  });
});

describe('computeLessonWasCorrect', () => {
  it('treats a lesson with no interactive sections as passed', () => {
    expect(computeLessonWasCorrect([])).toBe(true);
    expect(computeLessonWasCorrect([null, null])).toBe(true);
  });

  it('passes when at least half of the graded sections were correct', () => {
    expect(computeLessonWasCorrect([true, false])).toBe(true);
    expect(computeLessonWasCorrect([true, true, false])).toBe(true);
  });

  it('fails when fewer than half were correct', () => {
    expect(computeLessonWasCorrect([false, false, true])).toBe(false);
  });

  it('ignores ungraded (null) outcomes when computing the ratio', () => {
    expect(computeLessonWasCorrect([true, null, null])).toBe(true);
  });
});
