import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseAndValidateJson, toJsonSchema } from './jsonResponse.js';

const schema = z.object({ title: z.string().min(1), count: z.number().int() });

describe('parseAndValidateJson', () => {
  it('parses and validates well-formed matching JSON', () => {
    const result = parseAndValidateJson('{"title":"Fractions","count":3}', schema);
    expect(result).toEqual({ title: 'Fractions', count: 3 });
  });

  it('throws a clear error on invalid JSON', () => {
    expect(() => parseAndValidateJson('not json at all', schema)).toThrow(/not valid JSON/);
  });

  it('throws a clear error when JSON does not match the schema', () => {
    expect(() => parseAndValidateJson('{"title":"","count":"three"}', schema)).toThrow(/did not match the expected schema/);
  });
});

describe('toJsonSchema', () => {
  it('produces a JSON Schema object with the expected properties', () => {
    const jsonSchema = toJsonSchema(schema, 'response') as { type: string; properties: Record<string, unknown> };
    expect(jsonSchema.type).toBe('object');
    expect(Object.keys(jsonSchema.properties)).toEqual(expect.arrayContaining(['title', 'count']));
  });
});
