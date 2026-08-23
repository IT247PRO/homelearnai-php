import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { aiGenerationRateLimiter } from '../middleware/rateLimit.js';
import { AiNotConfiguredError, getAiProvider } from '../ai/provider.js';
import { generateChildInsights } from '../services/insights.js';
import {
  curriculumGenerationRequestSchema,
  curriculumGenerationSchema,
  lessonGenerationSchema,
  assessmentGenerationSchema,
  type CurriculumGeneration,
} from '../ai/schemas.js';
import {
  DEFAULT_CURRICULUM_SYSTEM_PROMPT,
  DEFAULT_CURRICULUM_USER_PROMPT_TEMPLATE,
  RICH_FORMATTING_INSTRUCTION,
  renderTemplate,
} from '../ai/promptTemplates.js';

/** Mounted at /ai-settings — the parent-facing on/off switch from plan.md's "Parent Control". */
export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get('/', async (req, res, next) => {
  try {
    const settings = await prisma.familyAiSettings.findUniqueOrThrow({ where: { userId: req.userId! } });
    res.json({ data: settings });
  } catch (err) {
    next(err);
  }
});

const settingsInputSchema = z.object({
  aiEnabled: z.boolean().optional(),
  tutorEnabled: z.boolean().optional(),
  contentGenerationEnabled: z.boolean().optional(),
});

settingsRouter.patch('/', async (req, res, next) => {
  try {
    const body = settingsInputSchema.parse(req.body);
    const settings = await prisma.familyAiSettings.update({ where: { userId: req.userId! }, data: body });
    res.json({ data: settings });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /children/:childId/ai */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.post('/curriculum-generations', requireOwnership('child', 'childId'), aiGenerationRateLimiter, async (req, res, next) => {
  try {
    const childId = Number(req.params.childId);

    const settings = await prisma.familyAiSettings.findUnique({ where: { userId: req.userId! } });
    if (!settings?.aiEnabled) throw new HttpError(403, 'ai_disabled_by_parent');

    const body = curriculumGenerationRequestSchema.parse(req.body);
    const [child, profile] = await Promise.all([
      prisma.child.findUniqueOrThrow({ where: { id: childId } }),
      prisma.learningProfile.findUnique({ where: { childId } }),
    ]);

    const generation = await prisma.aiGeneration.create({
      data: {
        userId: req.userId!,
        childId,
        kind: 'curriculum_generation',
        status: 'queued',
        // Data-minimized context: no child name, no parent email, no sibling data.
        requestContextRedacted: {
          grade: child.grade,
          independenceLevel: child.independenceLevel,
          learningGoals: profile?.learningGoals ?? null,
          interests: profile?.interests ?? null,
          prompt: body.prompt,
          durationDays: body.durationDays ?? null,
        },
      },
    });

    const template = await prisma.aiPromptTemplate.findFirst({
      where: { key: 'curriculum-generation', isActive: true },
      orderBy: { version: 'desc' },
    });

    const provider = getAiProvider();
    const startedAt = Date.now();

    let result;
    try {
      result = await provider.generateJson({
        systemPrompt: template?.systemPrompt ?? DEFAULT_CURRICULUM_SYSTEM_PROMPT,
        userPrompt: renderTemplate(template?.userPromptTemplate ?? DEFAULT_CURRICULUM_USER_PROMPT_TEMPLATE, {
          grade: child.grade ?? 'unspecified',
          independenceLevel: child.independenceLevel,
          durationDays: body.durationDays ?? 14,
          prompt: body.prompt,
        }),
        schema: curriculumGenerationSchema,
      });
    } catch (err) {
      if (err instanceof AiNotConfiguredError) {
        await prisma.aiGeneration.update({
          where: { id: generation.id },
          data: {
            status: 'failed',
            validationStatus: 'invalid',
            errorMessage: 'AI provider not configured',
            durationMs: Date.now() - startedAt,
            promptTemplateId: template?.id,
            promptTemplateVersion: template?.version,
          },
        });
        return res.status(503).json({
          error: 'ai_not_configured',
          message: 'AI features are not set up yet. Ask an administrator to configure an AI provider.',
          generationId: generation.id,
        });
      }
      throw err;
    }

    const studyPlan = await persistCurriculumGeneration({
      childId,
      subjectId: body.subjectId,
      generationId: generation.id,
      curriculum: result.data,
    });

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
        resultRefTable: 'StudyPlan',
        resultRefId: studyPlan.id,
        promptTemplateId: template?.id,
        promptTemplateVersion: template?.version,
      },
    });

    res.status(201).json({ data: { generationId: generation.id, studyPlan } });
  } catch (err) {
    next(err);
  }
});

nestedRouter.get('/generations/:generationId', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const generation = await prisma.aiGeneration.findFirst({
      where: { id: Number(req.params.generationId), childId: Number(req.params.childId) },
    });
    if (!generation) throw new HttpError(404, 'not_found');
    res.json({ data: generation });
  } catch (err) {
    next(err);
  }
});

nestedRouter.post('/insights/generate', requireOwnership('child', 'childId'), aiGenerationRateLimiter, async (req, res, next) => {
  try {
    const result = await generateChildInsights(Number(req.params.childId), req.userId!);
    res.status(201).json({ data: result });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.status(503).json({ error: 'ai_not_configured', message: 'AI features are not set up yet.' });
    }
    next(err);
  }
});

nestedRouter.get('/insights', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const insights = await prisma.aiInsight.findMany({
      where: { childId: Number(req.params.childId) },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: insights });
  } catch (err) {
    next(err);
  }
});

nestedRouter.patch('/insights/:insightId/acknowledge', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const insight = await prisma.aiInsight.update({
      where: { id: Number(req.params.insightId) },
      data: { isAcknowledgedByParent: true },
    });
    res.json({ data: insight });
  } catch (err) {
    next(err);
  }
});

nestedRouter.get('/recommendations', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const recommendations = await prisma.aiRecommendation.findMany({
      where: { childId: Number(req.params.childId) },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: recommendations });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /ai-recommendations */
export const recommendationsRouter = Router();
recommendationsRouter.use(requireAuth);

const recommendationStatusSchema = z.object({ status: z.enum(['pending', 'accepted', 'dismissed']) });

recommendationsRouter.patch('/:recommendationId', requireOwnership('aiRecommendation', 'recommendationId'), async (req, res, next) => {
  try {
    const { status } = recommendationStatusSchema.parse(req.body);
    const recommendation = await prisma.aiRecommendation.update({
      where: { id: Number(req.params.recommendationId) },
      data: { status },
    });
    res.json({ data: recommendation });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /topics/:topicId/ai */
export const topicAiRouter = Router({ mergeParams: true });
topicAiRouter.use(requireAuth);

async function requireTopicAiEnabled(topicId: number, userId: number) {
  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    include: { unit: { include: { subject: true } } },
  });
  const settings = await prisma.familyAiSettings.findUnique({ where: { userId } });
  if (!settings?.aiEnabled) throw new HttpError(403, 'ai_disabled_by_parent');
  return topic;
}

const lessonGenerationRequestSchema = z.object({ prompt: z.string().min(1).max(2000) });

topicAiRouter.post('/lesson-generations', requireOwnership('topic', 'topicId'), aiGenerationRateLimiter, async (req, res, next) => {
  try {
    const topicId = Number(req.params.topicId);
    const topic = await requireTopicAiEnabled(topicId, req.userId!);
    const body = lessonGenerationRequestSchema.parse(req.body);

    const generation = await prisma.aiGeneration.create({
      data: {
        userId: req.userId!,
        kind: 'lesson_generation',
        status: 'queued',
        requestContextRedacted: { topicTitle: topic.title, prompt: body.prompt },
      },
    });

    const provider = getAiProvider();
    const startedAt = Date.now();
    let result;
    try {
      result = await provider.generateJson({
        systemPrompt: `You are an experienced teacher creating a structured, interactive lesson. Generate JSON matching the schema. For a section that should be an interactive check (kind 'activity' or 'practice'), set interactionType, choices (for multiple_choice/true_false), correctAnswer, and up to 2 progressive hints — otherwise leave those fields unset. Never include unsafe or off-topic content. ${RICH_FORMATTING_INSTRUCTION}`,
        userPrompt: `Topic: ${topic.title}\nExisting notes: ${topic.learningContent ?? '(none)'}\nParent's request: ${body.prompt}\n\nGenerate a title, estimated duration, and ordered lesson sections. Include at least one interactive check.`,
        schema: lessonGenerationSchema,
      });
    } catch (err) {
      if (err instanceof AiNotConfiguredError) {
        await prisma.aiGeneration.update({
          where: { id: generation.id },
          data: { status: 'failed', validationStatus: 'invalid', errorMessage: 'AI provider not configured', durationMs: Date.now() - startedAt },
        });
        return res.status(503).json({ error: 'ai_not_configured', message: 'AI features are not set up yet.', generationId: generation.id });
      }
      throw err;
    }

    const lesson = await prisma.lesson.create({
      data: {
        topicId,
        title: result.data.title,
        estimatedMinutes: result.data.estimatedMinutes,
        status: 'draft', // AI-generated content requires explicit parent approval before use
        source: 'ai_generated',
        generationId: generation.id,
        sections: {
          create: result.data.sections.map((s, i) => ({
            kind: s.kind,
            content: s.content,
            sortOrder: i,
            interactionType: s.interactionType,
            choices: s.choices,
            correctAnswer: s.correctAnswer as never,
            hints: s.hints,
          })),
        },
      },
      include: { sections: true },
    });

    await prisma.aiGeneration.update({
      where: { id: generation.id },
      data: {
        status: 'succeeded',
        validationStatus: 'valid',
        provider: result.provider,
        model: result.model,
        durationMs: Date.now() - startedAt,
        resultRefTable: 'Lesson',
        resultRefId: lesson.id,
      },
    });

    res.status(201).json({ data: { generationId: generation.id, lesson } });
  } catch (err) {
    next(err);
  }
});

const assessmentGenerationRequestSchema = z.object({ prompt: z.string().min(1).max(2000) });

topicAiRouter.post('/assessment-generations', requireOwnership('topic', 'topicId'), aiGenerationRateLimiter, async (req, res, next) => {
  try {
    const topicId = Number(req.params.topicId);
    const topic = await requireTopicAiEnabled(topicId, req.userId!);
    const body = assessmentGenerationRequestSchema.parse(req.body);

    const generation = await prisma.aiGeneration.create({
      data: {
        userId: req.userId!,
        kind: 'assessment_generation',
        status: 'queued',
        requestContextRedacted: { topicTitle: topic.title, prompt: body.prompt },
      },
    });

    const provider = getAiProvider();
    const startedAt = Date.now();
    let result;
    try {
      result = await provider.generateJson({
        systemPrompt: `You are an experienced teacher writing an assessment. Generate JSON matching the schema, with clear correct answers. Never include unsafe or off-topic content. ${RICH_FORMATTING_INSTRUCTION}`,
        userPrompt: `Topic: ${topic.title}\nExisting notes: ${topic.learningContent ?? '(none)'}\nParent's request: ${body.prompt}\n\nGenerate a title and a set of questions with correct answers.`,
        schema: assessmentGenerationSchema,
      });
    } catch (err) {
      if (err instanceof AiNotConfiguredError) {
        await prisma.aiGeneration.update({
          where: { id: generation.id },
          data: { status: 'failed', validationStatus: 'invalid', errorMessage: 'AI provider not configured', durationMs: Date.now() - startedAt },
        });
        return res.status(503).json({ error: 'ai_not_configured', message: 'AI features are not set up yet.', generationId: generation.id });
      }
      throw err;
    }

    const assessment = await prisma.assessment.create({
      data: {
        topicId,
        title: result.data.title,
        source: 'ai_generated',
        generationId: generation.id,
        questions: {
          create: result.data.questions.map((q, i) => ({
            type: q.type,
            prompt: q.prompt,
            choices: q.choices,
            correctAnswer: q.correctAnswer as never,
            difficultyLevel: q.difficultyLevel,
            sortOrder: i,
          })),
        },
      },
      include: { questions: true },
    });

    await prisma.aiGeneration.update({
      where: { id: generation.id },
      data: {
        status: 'succeeded',
        validationStatus: 'valid',
        provider: result.provider,
        model: result.model,
        durationMs: Date.now() - startedAt,
        resultRefTable: 'Assessment',
        resultRefId: assessment.id,
      },
    });

    res.status(201).json({ data: { generationId: generation.id, assessment } });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /study-plans */
export const studyPlanRouter = Router();
studyPlanRouter.use(requireAuth);

studyPlanRouter.get('/:studyPlanId', requireOwnership('studyPlan', 'studyPlanId'), async (req, res, next) => {
  try {
    const studyPlan = await prisma.studyPlan.findUnique({
      where: { id: Number(req.params.studyPlanId) },
      include: { items: true },
    });
    if (!studyPlan) throw new HttpError(404, 'not_found');
    res.json({ data: studyPlan });
  } catch (err) {
    next(err);
  }
});

// The explicit parent-approval gate plan.md requires: an AI-generated study plan never
// auto-activates. Approving materializes its items into real LearningSession rows.
studyPlanRouter.post('/:studyPlanId/approve', requireOwnership('studyPlan', 'studyPlanId'), async (req, res, next) => {
  try {
    const studyPlanId = Number(req.params.studyPlanId);
    const studyPlan = await prisma.studyPlan.findUniqueOrThrow({
      where: { id: studyPlanId },
      include: { items: { include: { topic: true } } },
    });
    if (studyPlan.status !== 'draft' && studyPlan.status !== 'pending_approval') {
      throw new HttpError(409, 'study_plan_not_pending');
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of studyPlan.items) {
        if (!item.topicId || !item.topic) continue;
        const session = await tx.learningSession.create({
          data: {
            childId: studyPlan.childId,
            topicId: item.topicId,
            lessonId: item.lessonId ?? undefined,
            estimatedMinutes: item.topic.estimatedMinutes,
            status: 'planned',
            scheduledDate: item.scheduledDate ?? undefined,
            scheduledDayOfWeek: item.dayOfWeek ?? undefined,
          },
        });
        await tx.studyPlanItem.update({
          where: { id: item.id },
          data: { status: 'scheduled', materializedSessionId: session.id },
        });
      }

      return tx.studyPlan.update({
        where: { id: studyPlanId },
        data: { status: 'active', approvedAt: new Date(), approvedByUserId: req.userId },
        include: { items: true },
      });
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

async function persistCurriculumGeneration(params: {
  childId: number;
  subjectId?: number;
  generationId: number;
  curriculum: CurriculumGeneration;
}) {
  const { childId, subjectId, generationId, curriculum } = params;
  const child = await prisma.child.findUniqueOrThrow({ where: { id: childId } });

  return prisma.$transaction(async (tx) => {
    const subject = subjectId
      ? await tx.subject.findFirstOrThrow({ where: { id: subjectId, childId } })
      : await tx.subject.create({ data: { userId: child.userId, childId, name: 'AI-Generated Curriculum' } });

    const studyPlan = await tx.studyPlan.create({
      data: {
        childId,
        name: curriculum.objectives[0] ?? 'AI-Generated Study Plan',
        source: 'ai_generated',
        status: 'pending_approval',
        generationId,
      },
    });

    let sortOrder = 0;
    for (const unitInput of curriculum.units) {
      const unit = await tx.unit.create({
        data: { subjectId: subject.id, name: unitInput.name, sortOrder: sortOrder++ },
      });

      let topicSortOrder = 0;
      for (const topicInput of unitInput.topics) {
        const topic = await tx.topic.create({
          data: {
            unitId: unit.id,
            title: topicInput.title,
            learningContent: topicInput.learningContent,
            estimatedMinutes: topicInput.estimatedMinutes,
            sortOrder: topicSortOrder++,
          },
        });

        for (const card of topicInput.suggestedFlashcards ?? []) {
          await tx.flashcard.create({
            data: { topicId: topic.id, question: card.front, answer: card.back, importSource: 'ai_generated' },
          });
        }

        await tx.studyPlanItem.create({
          data: { studyPlanId: studyPlan.id, topicId: topic.id, sortOrder: topicSortOrder },
        });
      }
    }

    return tx.studyPlan.findUniqueOrThrow({ where: { id: studyPlan.id }, include: { items: true } });
  });
}
