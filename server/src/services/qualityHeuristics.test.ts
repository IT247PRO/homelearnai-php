import { describe, expect, it } from 'vitest';
import { ageGroupForGrade } from './qualityHeuristics.js';

describe('ageGroupForGrade', () => {
  it('buckets young grades as 5-8', () => {
    expect(ageGroupForGrade('PreK')).toBe('5-8');
    expect(ageGroupForGrade('K')).toBe('5-8');
    expect(ageGroupForGrade('3rd')).toBe('5-8');
  });

  it('buckets elementary grades as 9-12', () => {
    expect(ageGroupForGrade('4th')).toBe('9-12');
    expect(ageGroupForGrade('7th')).toBe('9-12');
  });

  it('buckets middle grades as 13-15', () => {
    expect(ageGroupForGrade('8th')).toBe('13-15');
    expect(ageGroupForGrade('10th')).toBe('13-15');
  });

  it('buckets high grades as 16+', () => {
    expect(ageGroupForGrade('11th')).toBe('16+');
    expect(ageGroupForGrade('12th')).toBe('16+');
  });

  it('defaults to 9-12 when grade is missing', () => {
    expect(ageGroupForGrade(null)).toBe('9-12');
  });
});
