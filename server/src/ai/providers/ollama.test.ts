import { describe, expect, it } from 'vitest';
import { stripLengthConstraints } from './ollama.js';

describe('stripLengthConstraints', () => {
  it('removes minLength/maxLength from a flat object schema', () => {
    const schema = { type: 'string', minLength: 1, maxLength: 2000 };
    expect(stripLengthConstraints(schema)).toEqual({ type: 'string' });
  });

  it('removes length constraints recursively through nested objects and arrays', () => {
    const schema = {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: { type: 'object', properties: { prompt: { type: 'string', minLength: 1, maxLength: 2000 } } },
        },
      },
    };
    expect(stripLengthConstraints(schema)).toEqual({
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: { type: 'object', properties: { prompt: { type: 'string' } } },
        },
      },
    });
  });

  it('leaves other constraints (minItems, maxItems, enum) untouched', () => {
    const schema = { type: 'array', minItems: 1, maxItems: 30, items: { type: 'string', enum: ['a', 'b'] } };
    expect(stripLengthConstraints(schema)).toEqual(schema);
  });
});
