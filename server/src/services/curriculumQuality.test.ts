import { describe, expect, it } from 'vitest';
import { analyzeCurriculumOutline, detectPrerequisiteCycles, type OutlineUnit } from './curriculumQuality.js';

describe('detectPrerequisiteCycles', () => {
  it('returns nothing for an acyclic chain', () => {
    const edges = [
      { topicId: 2, requiresTopicId: 1 },
      { topicId: 3, requiresTopicId: 2 },
    ];
    expect(detectPrerequisiteCycles(edges)).toEqual([]);
  });

  it('detects a direct two-topic cycle', () => {
    const edges = [
      { topicId: 1, requiresTopicId: 2 },
      { topicId: 2, requiresTopicId: 1 },
    ];
    expect(detectPrerequisiteCycles(edges).sort()).toEqual([1, 2]);
  });

  it('detects a longer indirect cycle without flagging unrelated topics', () => {
    const edges = [
      { topicId: 1, requiresTopicId: 2 },
      { topicId: 2, requiresTopicId: 3 },
      { topicId: 3, requiresTopicId: 1 },
      { topicId: 9, requiresTopicId: 8 }, // unrelated, acyclic
    ];
    expect(detectPrerequisiteCycles(edges).sort()).toEqual([1, 2, 3]);
  });
});

describe('analyzeCurriculumOutline', () => {
  it('flags a topic with zero objectives', () => {
    const units: OutlineUnit[] = [
      { id: 1, title: 'Unit 1', topics: [{ id: 10, title: 'Fractions', objectiveCount: 0 }] },
    ];
    const warnings = analyzeCurriculumOutline(units, []);
    expect(warnings).toContainEqual(expect.objectContaining({ topicId: 10, severity: 'warning' }));
  });

  it('does not flag a topic that has objectives', () => {
    const units: OutlineUnit[] = [
      { id: 1, title: 'Unit 1', topics: [{ id: 10, title: 'Fractions', objectiveCount: 3 }] },
    ];
    expect(analyzeCurriculumOutline(units, [])).toEqual([]);
  });

  it('flags a unit with more than 10 topics', () => {
    const topics = Array.from({ length: 11 }, (_, i) => ({ id: i, title: `Topic ${i}`, objectiveCount: 1 }));
    const units: OutlineUnit[] = [{ id: 1, title: 'Huge Unit', topics }];
    const warnings = analyzeCurriculumOutline(units, []);
    expect(warnings).toContainEqual(expect.objectContaining({ unitId: 1, severity: 'warning' }));
  });

  it('flags duplicate topic titles (case/whitespace-insensitive) across units', () => {
    const units: OutlineUnit[] = [
      { id: 1, title: 'Unit 1', topics: [{ id: 10, title: 'Equivalent Fractions', objectiveCount: 1 }] },
      { id: 2, title: 'Unit 2', topics: [{ id: 11, title: ' equivalent fractions ', objectiveCount: 1 }] },
    ];
    const warnings = analyzeCurriculumOutline(units, []);
    expect(warnings.some((w) => w.severity === 'info' && w.message.includes('equivalent fractions'))).toBe(true);
  });

  it('surfaces a prerequisite cycle as a per-topic warning', () => {
    const units: OutlineUnit[] = [
      { id: 1, title: 'Unit 1', topics: [{ id: 1, title: 'A', objectiveCount: 1 }, { id: 2, title: 'B', objectiveCount: 1 }] },
    ];
    const edges = [
      { topicId: 1, requiresTopicId: 2 },
      { topicId: 2, requiresTopicId: 1 },
    ];
    const warnings = analyzeCurriculumOutline(units, edges);
    const cycleWarnings = warnings.filter((w) => w.message.includes('prerequisite cycle'));
    expect(cycleWarnings.map((w) => w.topicId).sort()).toEqual([1, 2]);
  });
});
