import { describe, expect, it } from 'vitest';
import { buildStudyGuidePrompt, pickStudyGuideConcept } from './studyGuideGeneration.js';
import type { StudyGuideGeneration } from '../ai/schemas.js';

describe('buildStudyGuidePrompt', () => {
  const topic = { title: 'Food Webs', description: 'How energy moves through an ecosystem', learningContent: 'Producers make food; consumers eat it.' };

  it('includes the topic title, description, and existing notes', () => {
    const { userPrompt } = buildStudyGuidePrompt(topic, []);
    expect(userPrompt).toContain('Food Webs');
    expect(userPrompt).toContain('How energy moves through an ecosystem');
    expect(userPrompt).toContain('Producers make food; consumers eat it.');
  });

  it('includes approved lesson section content when lessons are given', () => {
    const { userPrompt } = buildStudyGuidePrompt(topic, [
      { title: 'Producers', sections: [{ kind: 'instruction', content: 'Plants use sunlight to make food.' }] },
    ]);
    expect(userPrompt).toContain('Producers');
    expect(userPrompt).toContain('Plants use sunlight to make food.');
  });

  it('is graceful with zero lessons and no learning content', () => {
    const { userPrompt } = buildStudyGuidePrompt({ title: 'New Topic', description: null, learningContent: null }, []);
    expect(userPrompt).toContain('New Topic');
    expect(userPrompt).toContain('(none)');
    expect(userPrompt).toContain('No approved lessons yet');
  });

  it('appends the regeneration reason when provided', () => {
    const { userPrompt } = buildStudyGuidePrompt(topic, [], 'Make it simpler for a 3rd grader.');
    expect(userPrompt).toContain('Make it simpler for a 3rd grader.');
  });

  it('describes a study guide as a synthesized concept map, not a summary', () => {
    const { systemPrompt } = buildStudyGuidePrompt(topic, []);
    expect(systemPrompt).toContain('not a summary');
  });
});

describe('pickStudyGuideConcept', () => {
  const content: StudyGuideGeneration = {
    overview: 'Energy flows through a food web.',
    learningObjectives: ['Explain what a food web is.'],
    concepts: [
      { title: 'Producers', simpleExplanation: 'Plants make their own food.', detailedExplanation: 'Producers use photosynthesis.' },
      { title: 'Consumers', simpleExplanation: 'Animals eat other organisms.', detailedExplanation: 'Consumers get energy by eating.' },
    ],
  };

  it('defaults to the first concept when no index is given', () => {
    const result = pickStudyGuideConcept(content);
    expect(result.currentConceptTitle).toBe('Producers');
  });

  it('picks the concept at the given index', () => {
    const result = pickStudyGuideConcept(content, 1);
    expect(result.currentConceptTitle).toBe('Consumers');
    expect(result.currentConceptContent).toContain('Animals eat other organisms.');
  });

  it('falls back to just the overview when the index is out of range', () => {
    const result = pickStudyGuideConcept(content, 5);
    expect(result.overview).toBe('Energy flows through a food web.');
    expect(result.currentConceptTitle).toBeUndefined();
  });
});
