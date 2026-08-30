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

  it('recovers LaTeX with mis-escaped single backslashes (\\frac, \\text) instead of corrupting or rejecting it', () => {
    const latexSchema = z.object({ text: z.string() });
    // Raw model output with a single backslash before \frac/\text — invalid per JSON's own
    // escaping rules, but \f and \t are themselves valid one-character JSON escapes, so a plain
    // JSON.parse silently eats the backslash+letter as a control char instead of erroring.
    const raw = String.raw`{"text":"Speed = \frac{d}{t} = \frac{150 \text{ m}}{25 \text{ s}} = 6 \text{ m/s}"}`;
    const result = parseAndValidateJson(raw, latexSchema);
    expect(result.text).toBe('Speed = \\frac{d}{t} = \\frac{150 \\text{ m}}{25 \\text{ s}} = 6 \\text{ m/s}');
  });

  it('leaves already-correctly-escaped LaTeX (\\\\frac) untouched', () => {
    const latexSchema = z.object({ text: z.string() });
    const raw = String.raw`{"text":"$\\frac{1}{2}$"}`;
    const result = parseAndValidateJson(raw, latexSchema);
    expect(result.text).toBe('$\\frac{1}{2}$');
  });

  it('truncates an over-length string to its schema max instead of rejecting the whole response', () => {
    // The exact shape/failure reported against interactiveSectionFieldsSchema: a model-generated
    // hint one character over its 300-char cap used to fail the entire lesson generation.
    const hintSchema = z.object({ hints: z.array(z.string().max(10)).max(2) });
    const overLong = 'a'.repeat(15);
    const raw = JSON.stringify({ hints: [overLong] });
    const result = parseAndValidateJson(raw, hintSchema);
    expect(result.hints[0]).toHaveLength(10);
    expect(result.hints[0]).toBe('a'.repeat(10));
  });

  it('truncates an over-length array to its schema max item count', () => {
    const schema = z.object({ hints: z.array(z.string()).max(2) });
    const raw = JSON.stringify({ hints: ['one', 'two', 'three', 'four'] });
    const result = parseAndValidateJson(raw, schema);
    expect(result.hints).toEqual(['one', 'two']);
  });

  it('clamps an out-of-range number into its schema min/max instead of rejecting', () => {
    const schema = z.object({ estimatedMinutes: z.number().int().min(5).max(180) });
    const raw = JSON.stringify({ estimatedMinutes: 400 });
    const result = parseAndValidateJson(raw, schema);
    expect(result.estimatedMinutes).toBe(180);
  });

  it('still rejects a response missing required (too-small) content — clamping never fabricates content', () => {
    const schema = z.object({ title: z.string().min(1) });
    const raw = JSON.stringify({ title: '' });
    expect(() => parseAndValidateJson(raw, schema)).toThrow(/did not match the expected schema/);
  });

  it('clamps nested optional/array/object fields recursively (full interactive-section shape)', () => {
    const sectionSchema = z.object({
      content: z.string().max(20),
      choices: z.array(z.string().max(5)).max(2).optional(),
      hints: z.array(z.string().max(5)).max(2).optional(),
    });
    const raw = JSON.stringify({
      content: 'This content is way too long for the cap',
      choices: ['toolong1', 'ok', 'extra-third'],
      hints: ['also-too-long-here'],
    });
    const result = parseAndValidateJson(raw, sectionSchema);
    expect(result.content).toHaveLength(20);
    expect(result.choices).toEqual(['toolo', 'ok']);
    expect(result.hints).toEqual(['also-']);
  });
});

describe('toJsonSchema', () => {
  it('produces a JSON Schema object with the expected properties', () => {
    const jsonSchema = toJsonSchema(schema, 'response') as { type: string; properties: Record<string, unknown> };
    expect(jsonSchema.type).toBe('object');
    expect(Object.keys(jsonSchema.properties)).toEqual(expect.arrayContaining(['title', 'count']));
  });
});
