import type { z } from 'zod';
import { OllamaProvider } from './providers/ollama.js';
import { OpenAiProvider } from './providers/openai.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { GeminiProvider } from './providers/gemini.js';

export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI provider not configured');
    this.name = 'AiNotConfiguredError';
  }
}

export interface AiGenerateJsonParams<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
}

export interface AiGenerateJsonResult<T> {
  data: T;
  usage: {
    promptTokens?: number;
    completionTokens?: number;
  };
  provider: string;
  model: string;
}

/**
 * Provider-agnostic AI abstraction (plan.md's "AiProvider" interface). Every AI feature in
 * this app (curriculum generation, lesson generation, the tutor, etc.) calls through this
 * interface rather than a specific vendor SDK, so a real adapter (OpenAI/Anthropic/local)
 * can be dropped in later without touching call sites.
 */
export interface AiProvider {
  readonly name: string;
  generateJson<T>(params: AiGenerateJsonParams<T>): Promise<AiGenerateJsonResult<T>>;
}

/**
 * The clean "not configured" state (plan.md Rule 4: no placeholder/faked AI responses).
 * Every call fails fast and predictably so callers can surface a real empty/setup state
 * to the user instead of mocked content.
 */
export class NullAiProvider implements AiProvider {
  readonly name = 'none';

  async generateJson<T>(_params: AiGenerateJsonParams<T>): Promise<AiGenerateJsonResult<T>> {
    throw new AiNotConfiguredError();
  }
}

let cachedProvider: AiProvider | undefined;

/**
 * Resolves the configured AiProvider from AI_PROVIDER. Falls back to NullAiProvider when
 * unset, unrecognized, or when the selected provider's required config (e.g. an API key)
 * is missing — a misconfigured provider fails the same clean, honest way as no provider at
 * all (plan.md Rule 4: no placeholder/faked AI), rather than crashing the request path.
 */
export function getAiProvider(): AiProvider {
  if (!cachedProvider) {
    const configured = process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : undefined);
    try {
      switch (configured) {
        case 'gemini':
          cachedProvider = new GeminiProvider();
          break;
        case 'ollama':
          cachedProvider = new OllamaProvider();
          break;
        case 'openai':
          cachedProvider = new OpenAiProvider();
          break;
        case 'anthropic':
          cachedProvider = new AnthropicProvider();
          break;
        default:
          cachedProvider = new NullAiProvider();
      }
    } catch (err) {
      if (err instanceof AiNotConfiguredError) {
        cachedProvider = new NullAiProvider();
      } else {
        throw err;
      }
    }
  }
  return cachedProvider;
}

/** Test-only hook to reset the cached provider between test cases. */
export function _resetAiProviderCache() {
  cachedProvider = undefined;
}
