import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/** JSON Schema for a Zod type, shaped for providers that accept a schema directly
 * (Ollama's `format`, OpenAI's `response_format.json_schema`, Anthropic's tool `input_schema`). */
export function toJsonSchema(schema: z.ZodType, name: string): Record<string, unknown> {
  return zodToJsonSchema(schema, { name, target: 'jsonSchema7' }).definitions?.[name] ?? zodToJsonSchema(schema, { target: 'jsonSchema7' });
}

/**
 * Every provider adapter funnels its raw model output through here — plan.md's "never
 * trust AI JSON blindly" rule, enforced once instead of three times. A model that ignores
 * the requested schema (common with smaller/local models) fails loudly here rather than
 * persisting malformed data.
 */
export function parseAndValidateJson<T>(raw: string, schema: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`AI response was not valid JSON: ${raw.slice(0, 500)}`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`AI response did not match the expected schema: ${result.error.message}`);
  }
  return result.data;
}
