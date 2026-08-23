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
});
