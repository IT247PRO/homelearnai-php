import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';
import { AiNotConfiguredError, getAiProvider } from '../ai/provider.js';
import { RICH_FORMATTING_INSTRUCTION } from '../ai/promptTemplates.js';

export const insightGenerationSchema = z.object({
  insights: z
    .array(
      z.object({
        kind: z.enum(['strength', 'weakness', 'knowledge_gap', 'at_risk', 'ready_to_advance']),
        topicId: z.number().int().optional(),
        summary: z.string().min(1).max(500),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .max(5),
  recommendations: z
    .array(
      z.object({
        kind: z.enum(['review_session', 'new_topic', 'practice', 'schedule_change']),
        title: z.string().min(1).max(150),
        body: z.string().min(1).max(1000),
        topicId: z.number().int().optional(),
      })
    )
    .max(5),
});

const INSIGHTS_SYSTEM_PROMPT = `You are an experienced homeschool learning analyst. You are given a summary of a child's actual tracked progress (topic mastery states, recent state changes, and this week's activity) and must identify real patterns in it — strengths, weaknesses, knowledge gaps, skills at risk of being forgotten, and skills ready for advancement — plus concrete recommendations for what the parent should do next. Base every insight and recommendation strictly on the data provided; never invent progress, activity, or mastery that isn't in the summary. ${RICH_FORMATTING_INSTRUCTION}`;

/**
 * Turns already-tracked, deterministic Mastery/MasteryEvent data into the parent-facing
 * narrative the AiInsight/AiRecommendation tables were built for (previously a read-only
 * dead end — dashboard.ts already queried these tables, but nothing ever wrote to them).
 * On-demand only: no background job scheduler exists in this app to run this periodically.
 */
export async function generateChildInsights(childId: number, userId: number) {
  const settings = await prisma.familyAiSettings.findUnique({ where: { userId } });
  if (!settings?.aiEnabled) throw new HttpError(403, 'ai_disabled_by_parent');

  const child = await prisma.child.findUniqueOrThrow({ where: { id: childId } });
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [masteryRows, recentEvents, completedThisWeek, reviewsThisWeek] = await Promise.all([
    prisma.mastery.findMany({ where: { childId }, include: { topic: true }, orderBy: { updatedAt: 'desc' }, take: 40 }),
    prisma.masteryEvent.findMany({ where: { childId, createdAt: { gte: weekAgo } }, include: { topic: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.learningSession.count({ where: { childId, status: 'done', completedAt: { gte: weekAgo } } }),
    prisma.review.count({ where: { childId, updatedAt: { gte: weekAgo }, status: { not: 'new' } } }),
  ]);

  const summary = {
    grade: child.grade,
    mastery: masteryRows.map((m) => ({ topic: m.topic.title, state: m.state, accuracy: m.accuracy, attempts: m.attemptsCount })),
    recentStateChanges: recentEvents.map((e) => ({ topic: e.topic.title, from: e.previousState, to: e.newState, trigger: e.trigger })),
    sessionsCompletedThisWeek: completedThisWeek,
    reviewsCompletedThisWeek: reviewsThisWeek,
  };

  const generation = await prisma.aiGeneration.create({
    data: { userId, childId, kind: 'insight_generation', status: 'queued', requestContextRedacted: summary },
  });

  const hasActivity = masteryRows.length > 0 || completedThisWeek > 0 || reviewsThisWeek > 0;
  const emptyArrayGuidance = hasActivity
    ? "There is real tracked activity below — you must return at least one insight describing it (even a modest one, e.g. noting a topic is still early-stage) rather than returning empty arrays."
    : "There is no tracked activity yet, so empty arrays are the correct answer — do not invent any.";

  const provider = getAiProvider();
  const startedAt = Date.now();
  let result;
  try {
    result = await provider.generateJson({
      systemPrompt: INSIGHTS_SYSTEM_PROMPT,
      userPrompt: `Progress summary (JSON):\n${JSON.stringify(summary, null, 2)}\n\nIdentify up to 5 insights and up to 5 recommendations grounded in this data. ${emptyArrayGuidance}`,
      schema: insightGenerationSchema,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: { status: 'failed', validationStatus: 'invalid', errorMessage: 'AI provider not configured', durationMs: Date.now() - startedAt },
      });
      throw err;
    }
    throw err;
  }

  const [insights, recommendations] = await Promise.all([
    Promise.all(
      result.data.insights.map((i) =>
        prisma.aiInsight.create({
          data: { childId, kind: i.kind, topicId: i.topicId, summary: i.summary, confidence: i.confidence, generationId: generation.id },
        })
      )
    ),
    Promise.all(
      result.data.recommendations.map((r) =>
        prisma.aiRecommendation.create({
          data: { childId, kind: r.kind, title: r.title, body: r.body, payload: r.topicId ? { topicId: r.topicId } : undefined, generationId: generation.id },
        })
      )
    ),
  ]);

  await prisma.aiGeneration.update({
    where: { id: generation.id },
    data: {
      status: 'succeeded',
      validationStatus: 'valid',
      provider: result.provider,
      model: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      durationMs: Date.now() - startedAt,
    },
  });

  return { insights, recommendations };
}
