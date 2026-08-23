import OpenAI from 'openai';
import type { AiGenerateJsonParams, AiGenerateJsonResult, AiProvider } from '../provider.js';
import { AiNotConfiguredError } from '../provider.js';
import { parseAndValidateJson } from '../jsonResponse.js';

/**
 * Uses OpenAI's lenient `json_object` response mode (not the newer strict `json_schema`
 * mode) — several of this app's schemas use optional fields that strict mode's
 * "everything must be in `required`" rule doesn't accommodate cleanly. The schema is
 * still described in the prompt and enforced by parseAndValidateJson afterward, matching
 * plan.md's "never trust AI JSON blindly" rule regardless of which mode is used.
 */
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new AiNotConfiguredError();
    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  async generateJson<T>(params: AiGenerateJsonParams<T>): Promise<AiGenerateJsonResult<T>> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${params.systemPrompt}\n\nRespond with a single JSON object only — no prose, no markdown code fences.` },
        { role: 'user', content: params.userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned an empty response');
    const data = parseAndValidateJson(content, params.schema);

    return {
      data,
      usage: { promptTokens: completion.usage?.prompt_tokens, completionTokens: completion.usage?.completion_tokens },
      provider: this.name,
      model: completion.model,
    };
  }
}
