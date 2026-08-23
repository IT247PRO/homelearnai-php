import { describe, expect, it } from 'vitest';
import { buildTutorSystemPrompt } from './tutor.js';

describe('buildTutorSystemPrompt', () => {
  it('names the age group and topic, and includes the core safety/pedagogy rules', () => {
    const prompt = buildTutorSystemPrompt('9-12', 'Quadratics', null);
    expect(prompt).toContain('9-12');
    expect(prompt).toContain('"Quadratics"');
    expect(prompt).toContain('Socratic questioning');
    expect(prompt).toContain('Never request personal information');
    expect(prompt).not.toContain('Reference material');
  });

  it('includes the topic content as reference material when provided', () => {
    const prompt = buildTutorSystemPrompt('13-15', 'Photosynthesis', 'Plants convert light into energy.');
    expect(prompt).toContain('Reference material for this topic:');
    expect(prompt).toContain('Plants convert light into energy.');
  });

  it('includes the study guide concept context when provided and no lesson context is given', () => {
    const prompt = buildTutorSystemPrompt('9-12', 'Ecosystems', null, undefined, {
      overview: 'Energy flows through a food web.',
      currentConceptTitle: 'Producers and Consumers',
      currentConceptContent: 'Producers make their own food; consumers eat other organisms.',
    });
    expect(prompt).toContain('currently reading the Study Guide');
    expect(prompt).toContain('Energy flows through a food web.');
    expect(prompt).toContain('Producers and Consumers');
    expect(prompt).toContain('Prioritize this exact study guide content');
  });

  it('prioritizes lesson context over study guide context when both are somehow present', () => {
    const prompt = buildTutorSystemPrompt(
      '9-12',
      'Ecosystems',
      null,
      { lessonTitle: 'Food Webs', currentSectionKind: 'instruction', currentSectionContent: 'A food web connects food chains.', recentMistakes: [] },
      { overview: 'Should not appear', currentConceptTitle: 'Should not appear either' }
    );
    expect(prompt).toContain('currently in the lesson "Food Webs"');
    expect(prompt).not.toContain('currently reading the Study Guide');
    expect(prompt).not.toContain('Should not appear');
  });
});
