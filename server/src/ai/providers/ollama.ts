import type { AiGenerateJsonParams, AiGenerateJsonResult, AiProvider } from '../provider.js';
import { toJsonSchema, parseAndValidateJson } from '../jsonResponse.js';

interface OllamaChatResponse {
  message: { role: string; content: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Ollama enforces `format` via a GBNF grammar compiled from the JSON Schema (llama.cpp
 * under the hood). Observed directly against this app's own schemas: `minLength`/
 * `maxLength` on string properties can make grammar compilation fail outright
 * ("Failed to initialize samplers: failed to parse grammar") — and inconsistently, not by
 * a simple size threshold (max(1000) and max(20000) both compiled fine; max(2000) didn't).
 * Since there's no reliable safe bound to pick, length constraints are stripped from the
 * grammar-facing schema entirely; `parseAndValidateJson` still enforces them against the
 * real Zod schema afterward, so an over-length response is still rejected — Ollama just
 * isn't asked to constrain length token-by-token during generation.
 */
export function stripLengthConstraints(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripLengthConstraints);
  if (node && typeof node === 'object') {
    const { minLength: _minLength, maxLength: _maxLength, ...rest } = node as Record<string, unknown>;
    return Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, stripLengthConstraints(value)]));
  }
  return node;
}

/**
 * Talks to a locally-running Ollama instance (https://ollama.com) over its plain HTTP API —
 * no SDK needed. Uses Ollama's structured-output support (`format` as a JSON Schema, not
 * just `"json"`) so the model is constrained toward the shape callers actually need, with
 * parseAndValidateJson as the safety net for models that don't fully honor it.
 */
export class OllamaProvider implements AiProvider {
  readonly name = 'ollama';
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    this.baseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');
    this.model = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b-instruct-q4_K_M';
  }

  async generateJson<T>(params: AiGenerateJsonParams<T>): Promise<AiGenerateJsonResult<T>> {
    const jsonSchema = stripLengthConstraints(toJsonSchema(params.schema, 'response'));

    const controller = new AbortController();
    // 180s, not 120s — a model swap (Ollama unloading the previous model and loading this
    // one into memory) has been observed to make the first call after switching models take
    // noticeably longer than a warm call; this is a one-time cost per switch, not a per-call cost.
    const timeout = setTimeout(() => controller.abort(), 180_000);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          stream: false,
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
          ],
          format: jsonSchema,
          options: { temperature: 0.4 },
        }),
      });
    } catch (err) {
      throw new Error(`Could not reach Ollama at ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new Error(`Ollama request failed (${res.status}): ${await res.text()}`);
    }

    const body = (await res.json()) as OllamaChatResponse;
    const data = parseAndValidateJson(body.message.content, params.schema);

    return {
      data,
      usage: { promptTokens: body.prompt_eval_count, completionTokens: body.eval_count },
      provider: this.name,
      model: this.model,
    };
  }
}
