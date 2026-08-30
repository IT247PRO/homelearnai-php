import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/** JSON Schema for a Zod type, shaped for providers that accept a schema directly
 * (Ollama's `format`, OpenAI's `response_format.json_schema`, Anthropic's tool `input_schema`). */
export function toJsonSchema(schema: z.ZodType, name: string): Record<string, unknown> {
  return zodToJsonSchema(schema, { name, target: 'jsonSchema7' }).definitions?.[name] ?? zodToJsonSchema(schema, { target: 'jsonSchema7' });
}

/**
 * Small/local models frequently emit LaTeX inside JSON string values with a single backslash
 * (`\frac`, `\text`, `\sqrt`...) instead of the JSON-required `\\frac`. A valid JSON escape is
 * always exactly one character (`\" \\ \/ \b \f \n \r \t \uXXXX`), so when the letter after the
 * backslash happens to be one of b/f/n/r/t, JSON.parse doesn't reject it — it silently consumes
 * the backslash plus that one letter as a control character and leaves the rest of the command
 * name as literal text: `\frac{d}{t}` becomes a form-feed char followed by `rac{d}{t}`, `\text`
 * becomes a tab followed by `ext`. Any other leading letter (`\sqrt`, `\alpha`...) instead fails
 * JSON.parse outright. Since a real JSON escape is never followed by more letters, a lone
 * backslash immediately before 2+ letters can only be a mis-escaped literal — doubling it here
 * (skipping backslashes already doubled) recovers the intended text before parsing for real.
 */
function repairUnescapedBackslashes(raw: string): string {
  return raw.replace(/(?<!\\)\\(?=[a-zA-Z]{2,})/g, '\\\\');
}

/**
 * Small/local models frequently overshoot a schema's own bounds by a little — a hint one
 * sentence past its 300-char cap, one extra array item past a `.max()`. Rejecting the whole
 * generation over that (forcing an expensive full regeneration for content that's otherwise
 * perfectly usable) is wasteful, so this walks the parsed JSON alongside the schema that's
 * about to validate it and clamps every string/array/number down to whatever bound the schema
 * itself already declares — "too big" is fixable by chunking; only a genuine `.min()`/required-
 * field violation (missing or too-little content) is left for schema.safeParse to catch below.
 */
// Dispatches on the runtime `_def.typeName` discriminant rather than `instanceof` — narrowing
// `ZodTypeAny` through `instanceof` against zod's own generically-parameterized classes here
// sends the type checker into "Type instantiation is excessively deep" territory (TS2589).
// The `any`-typed schema/def locals below are deliberate: this walks arbitrary, unknown-shaped
// schemas at runtime, which the static type system can't usefully describe anyway.
function clampToSchemaBounds(data: unknown, schema: z.ZodTypeAny): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def;
  switch (def.typeName as z.ZodFirstPartyTypeKind) {
    case z.ZodFirstPartyTypeKind.ZodOptional:
    case z.ZodFirstPartyTypeKind.ZodNullable:
      return data === undefined || data === null ? data : clampToSchemaBounds(data, def.innerType);
    case z.ZodFirstPartyTypeKind.ZodDefault:
      return clampToSchemaBounds(data, def.innerType);
    case z.ZodFirstPartyTypeKind.ZodUnion: {
      const options = def.options as z.ZodTypeAny[];
      const match = options.find((option) => option.safeParse(data).success);
      return match ? clampToSchemaBounds(data, match) : data;
    }
    case z.ZodFirstPartyTypeKind.ZodString: {
      const max = def.checks.find((c: { kind: string }) => c.kind === 'max')?.value as number | undefined;
      return typeof data === 'string' && max !== undefined && data.length > max ? data.slice(0, max) : data;
    }
    case z.ZodFirstPartyTypeKind.ZodNumber: {
      if (typeof data !== 'number') return data;
      const checks = def.checks as { kind: string; value: number }[];
      let clamped = data;
      const min = checks.find((c) => c.kind === 'min')?.value;
      const max = checks.find((c) => c.kind === 'max')?.value;
      if (min !== undefined) clamped = Math.max(clamped, min);
      if (max !== undefined) clamped = Math.min(clamped, max);
      return checks.some((c) => c.kind === 'int') ? Math.round(clamped) : clamped;
    }
    case z.ZodFirstPartyTypeKind.ZodArray: {
      if (!Array.isArray(data)) return data;
      const clamped = data.map((item) => clampToSchemaBounds(item, def.type));
      const max = def.maxLength?.value as number | null | undefined;
      return max !== undefined && max !== null && clamped.length > max ? clamped.slice(0, max) : clamped;
    }
    case z.ZodFirstPartyTypeKind.ZodObject: {
      if (typeof data !== 'object' || data === null || Array.isArray(data)) return data;
      const shape = def.shape() as Record<string, z.ZodTypeAny>;
      const result: Record<string, unknown> = { ...(data as Record<string, unknown>) };
      for (const key of Object.keys(shape)) {
        if (key in result) result[key] = clampToSchemaBounds(result[key], shape[key]);
      }
      return result;
    }
    default:
      return data;
  }
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
    parsed = JSON.parse(repairUnescapedBackslashes(raw));
  } catch {
    throw new Error(`AI response was not valid JSON: ${raw.slice(0, 500)}`);
  }
  const clamped = clampToSchemaBounds(parsed, schema as unknown as z.ZodTypeAny);
  const result = schema.safeParse(clamped);
  if (!result.success) {
    throw new Error(`AI response did not match the expected schema: ${result.error.message}`);
  }
  return result.data;
}
