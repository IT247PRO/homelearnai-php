import { z } from 'zod';
import { AiNotConfiguredError, getAiProvider } from '../ai/provider.js';

export const openEndedGradingSchema = z.object({
  isCorrect: z.boolean(),
  misconceptionTag: z.string().max(100).optional(),
  feedback: z.string().max(500),
});

const GRADING_SYSTEM_PROMPT = `You are grading one open-ended homeschool assessment answer. Judge whether the child's response demonstrates correct understanding — accept reasonable paraphrasing and partial-credit-worthy correct reasoning, not just an exact string match. If it's wrong, identify the likely underlying misconception in a few words (e.g. "sign error", "confused perimeter with area") rather than only marking it incorrect. Give brief, encouraging feedback the child could read directly. Never invent context beyond what's given.`;

/**
 * Fills the one real grading gap `isQuestionAnswerCorrect` (answerChecking.ts) leaves —
 * open_ended questions always return `isCorrect: null` there since there's no reliable
 * exact-match rule for free-form reasoning. Every other question type stays purely
 * deterministic; this only runs when the deterministic check found nothing to compare.
 */
export async function gradeOpenEndedAnswer(params: { prompt: string; expectedAnswer: string | null; response: string }) {
  const provider = getAiProvider();
  try {
    const result = await provider.generateJson({
      systemPrompt: GRADING_SYSTEM_PROMPT,
      userPrompt: `Question: ${params.prompt}\n${params.expectedAnswer ? `Model answer: ${params.expectedAnswer}\n` : ''}Child's response: ${params.response}\n\nGrade this response.`,
      schema: openEndedGradingSchema,
    });
    return result.data;
  } catch (err) {
    if (err instanceof AiNotConfiguredError) return null;
    throw err;
  }
}
