import Anthropic from '@anthropic-ai/sdk';
import type { AiGenerateJsonParams, AiGenerateJsonResult, AiProvider } from '../provider.js';
import { AiNotConfiguredError } from '../provider.js';
import { toJsonSchema, parseAndValidateJson } from '../jsonResponse.js';

/** Claude has no free-standing "respond as JSON" mode — the standard structured-output
 * pattern is a single forced tool call, so the model's output is a schema-shaped `input`
 * object rather than a string it has to format correctly on its own. */
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new AiNotConfiguredError();
    this.client = new Anthropic({ apiKey });
    this.model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
  }

  async generateJson<T>(params: AiGenerateJsonParams<T>): Promise<AiGenerateJsonResult<T>> {
    const jsonSchema = toJsonSchema(params.schema, 'response') as Anthropic.Tool.InputSchema;

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.userPrompt }],
      tools: [{ name: 'emit_result', description: 'Emit the structured result matching the required schema.', input_schema: jsonSchema, strict: true }],
      tool_choice: { type: 'tool', name: 'emit_result' },
    });

    const toolUse = message.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');
    if (!toolUse) throw new Error('Anthropic response did not include the expected tool call');
    const data = parseAndValidateJson(JSON.stringify(toolUse.input), params.schema);

    return {
      data,
      usage: { promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens },
      provider: this.name,
      model: message.model,
    };
  }
}
