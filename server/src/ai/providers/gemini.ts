import { GoogleGenAI } from '@google/genai';
import type { AiGenerateJsonParams, AiGenerateJsonResult, AiProvider } from '../provider.js';
import { AiNotConfiguredError } from '../provider.js';
import { parseAndValidateJson } from '../jsonResponse.js';

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new AiNotConfiguredError();
    this.client = new GoogleGenAI({ apiKey });
    this.model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  }

  async generateJson<T>(params: AiGenerateJsonParams<T>): Promise<AiGenerateJsonResult<T>> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${params.systemPrompt}\n\n${params.userPrompt}\n\nRespond strictly with a valid JSON object matching the required structure. Do not include markdown code block formatting or explanations outside the JSON.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    });

    const content = response.text;
    if (!content) throw new Error('Gemini returned an empty response');
    const data = parseAndValidateJson(content, params.schema);

    return {
      data,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount,
        completionTokens: response.usageMetadata?.candidatesTokenCount,
      },
      provider: this.name,
      model: this.model,
    };
  }
}
