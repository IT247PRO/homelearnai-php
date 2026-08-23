import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { aiGenerationRateLimiter } from '../middleware/rateLimit.js';
import { AiNotConfiguredError, getAiProvider } from '../ai/provider.js';
import { curriculumOutlineSchema, curriculumTopicLessonPlanSchema, type CurriculumOutline, type CurriculumTopicLessonPlan } from '../ai/schemas.js';
import {
  DEFAULT_CURRICULUM_ANALYSIS_SYSTEM_PROMPT,
  DEFAULT_CURRICULUM_ANALYSIS_USER_PROMPT_TEMPLATE,
  DEFAULT_TOPIC_LESSON_PLAN_SYSTEM_PROMPT,
  DEFAULT_TOPIC_LESSON_PLAN_USER_PROMPT_TEMPLATE,
  subjectPedagogyHint,
  renderTemplate,
} from '../ai/promptTemplates.js';
import { runCurriculumQualityChecks } from '../services/curriculumQuality.js';
import { assignPacingDates } from '../services/curriculumPacing.js';

const CURRICULUM_TREE_INCLUDE = {
  units: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      topics: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          skills: { include: { objectives: true }, orderBy: { sortOrder: 'asc' as const } },
          objectives: { where: { curriculumSkillId: null }, orderBy: { sortOrder: 'asc' as const } },
          prerequisites: { include: { requiresTopic: true } },
          lessons: { include: { sections: { orderBy: { sortOrder: 'asc' as const } } }, orderBy: { sequenceNumber: 'asc' as const } },
          assessment: { include: { questions: { orderBy: { sortOrder: 'asc' as const } } } },
        },
      },
    },
  },
};

async function requireAiEnabled(userId: number) {
  const settings = await prisma.familyAiSettings.findUnique({ where: { userId } });
  if (!settings?.aiEnabled) throw new HttpError(403, 'ai_disabled_by_parent');
}

// ---------------------------------------------------------------------------
// Mounted at /curricula
// ---------------------------------------------------------------------------
export const itemRouter = Router();
itemRouter.use(requireAuth);

const createCurriculumSchema = z.object({
  title: z.string().min(1).max(255),
  subjectArea: z.string().min(1).max(255),
  gradeLevel: z.string().max(50).optional(),
  schoolYear: z.string().max(50).optional(),
  rawText: z.string().min(1).max(100_000),
  sourceType: z.enum(['school', 'parent_created', 'ai_generated', 'imported', 'custom']).optional(),
  sourceName: z.string().max(255).optional(),
  sourceUrl: z.string().url().max(2000).optional(),
});

itemRouter.post('/', async (req, res, next) => {
  try {
    const body = createCurriculumSchema.parse(req.body);
    const curriculum = await prisma.curriculum.create({
      data: {
        userId: req.userId!,
        title: body.title,
        subjectArea: body.subjectArea,
        gradeLevel: body.gradeLevel,
        schoolYear: body.schoolYear,
        rawText: body.rawText,
        sourceType: body.sourceType ?? 'parent_created',
        sourceName: body.sourceName,
        sourceUrl: body.sourceUrl,
      },
    });
    res.status(201).json({ data: curriculum });
  } catch (err) {
    next(err);
  }
});

itemRouter.get('/', async (req, res, next) => {
  try {
    const curricula = await prisma.curriculum.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: curricula });
  } catch (err) {
    next(err);
  }
});

itemRouter.get('/:id', requireOwnership('curriculum', 'id'), async (req, res, next) => {
  try {
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: Number(req.params.id) },
      include: CURRICULUM_TREE_INCLUDE,
    });
    if (!curriculum) throw new HttpError(404, 'not_found');
    res.json({ data: curriculum });
  } catch (err) {
    next(err);
  }
});

const patchCurriculumSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  gradeLevel: z.string().max(50).nullable().optional(),
  schoolYear: z.string().max(50).nullable().optional(),
  sourceName: z.string().max(255).nullable().optional(),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  masteryThresholdPercent: z.number().int().min(1).max(100).optional(),
});

// rawText is deliberately not editable here — plan2.md §3: "do not overwrite the original source".
itemRouter.patch('/:id', requireOwnership('curriculum', 'id'), async (req, res, next) => {
  try {
    const body = patchCurriculumSchema.parse(req.body);
    const curriculum = await prisma.curriculum.update({
      where: { id: Number(req.params.id) },
      data: {
        title: body.title,
        gradeLevel: body.gradeLevel === null ? null : body.gradeLevel,
        schoolYear: body.schoolYear === null ? null : body.schoolYear,
        sourceName: body.sourceName === null ? null : body.sourceName,
        sourceUrl: body.sourceUrl === null ? null : body.sourceUrl,
        masteryThresholdPercent: body.masteryThresholdPercent,
      },
    });
    res.json({ data: curriculum });
  } catch (err) {
    next(err);
  }
});

itemRouter.delete('/:id', requireOwnership('curriculum', 'id'), async (req, res, next) => {
  try {
    await prisma.curriculum.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

itemRouter.get('/:id/quality-check', requireOwnership('curriculum', 'id'), async (req, res, next) => {
  try {
    const warnings = await runCurriculumQualityChecks(Number(req.params.id));
    res.json({ data: { warnings } });
  } catch (err) {
    next(err);
  }
});

itemRouter.get('/:id/generation-progress', requireOwnership('curriculum', 'id'), async (req, res, next) => {
  try {
    const curriculumId = Number(req.params.id);
    const curriculum = await prisma.curriculum.findUniqueOrThrow({ where: { id: curriculumId } });
    const topics = await prisma.curriculumTopic.findMany({
      where: { unit: { curriculumId } },
      select: { lessonPlanStatus: true },
    });

    const byStatus = { pending: 0, generating: 0, generated: 0, failed: 0 };
    for (const topic of topics) {
      byStatus[topic.lessonPlanStatus as keyof typeof byStatus] = (byStatus[topic.lessonPlanStatus as keyof typeof byStatus] ?? 0) + 1;
    }

    res.json({ data: { status: curriculum.status, totalTopics: topics.length, ...byStatus } });
  } catch (err) {
    next(err);
  }
});

// --- Stage 1: Analyze --------------------------------------------------------------------

itemRouter.post('/:id/analyze', requireOwnership('curriculum', 'id'), aiGenerationRateLimiter, async (req, res, next) => {
  try {
    const curriculumId = Number(req.params.id);
    await requireAiEnabled(req.userId!);

    const curriculum = await prisma.curriculum.findUniqueOrThrow({ where: { id: curriculumId } });
    if (curriculum.status !== 'draft' && curriculum.status !== 'failed') {
      throw new HttpError(409, 'curriculum_not_analyzable');
    }

    const generation = await prisma.aiGeneration.create({
      data: {
        userId: req.userId!,
        curriculumId,
        kind: 'curriculum_analysis',
        status: 'queued',
        requestContextRedacted: {
          title: curriculum.title,
          subjectArea: curriculum.subjectArea,
          gradeLevel: curriculum.gradeLevel,
          rawTextPreview: curriculum.rawText.slice(0, 500),
          rawTextLength: curriculum.rawText.length,
        },
      },
    });

    await prisma.curriculum.update({ where: { id: curriculumId }, data: { status: 'analyzing' } });

    const provider = getAiProvider();
    const startedAt = Date.now();
    let result;
    try {
      result = await provider.generateJson({
        systemPrompt: DEFAULT_CURRICULUM_ANALYSIS_SYSTEM_PROMPT,
        userPrompt: renderTemplate(DEFAULT_CURRICULUM_ANALYSIS_USER_PROMPT_TEMPLATE, {
          subjectArea: curriculum.subjectArea,
          gradeLevel: curriculum.gradeLevel ?? 'unspecified',
          pedagogyHint: subjectPedagogyHint(curriculum.subjectArea),
          rawText: curriculum.rawText,
        }),
        schema: curriculumOutlineSchema,
      });
    } catch (err) {
      await prisma.curriculum.update({ where: { id: curriculumId }, data: { status: 'failed' } });
      if (err instanceof AiNotConfiguredError) {
        await prisma.aiGeneration.update({
          where: { id: generation.id },
          data: { status: 'failed', validationStatus: 'invalid', errorMessage: 'AI provider not configured', durationMs: Date.now() - startedAt },
        });
        return res.status(503).json({ error: 'ai_not_configured', message: 'AI features are not set up yet.', generationId: generation.id });
      }
      throw err;
    }

    await persistCurriculumOutline(curriculumId, result.data);
    await prisma.curriculum.update({ where: { id: curriculumId }, data: { status: 'outline_generated' } });

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
        resultRefTable: 'Curriculum',
        resultRefId: curriculumId,
      },
    });

    const updated = await prisma.curriculum.findUniqueOrThrow({ where: { id: curriculumId }, include: CURRICULUM_TREE_INCLUDE });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

async function persistCurriculumOutline(curriculumId: number, outline: CurriculumOutline) {
  // Re-analysis (from a 'failed' status) starts clean rather than appending duplicates.
  await prisma.curriculumUnit.deleteMany({ where: { curriculumId } });

  await prisma.$transaction(async (tx) => {
    const topicIdByTitle = new Map<string, number>();
    const pendingPrerequisites: Array<{ topicId: number; requiredTitles: string[] }> = [];

    let unitSortOrder = 0;
    for (const unitInput of outline.units) {
      const unit = await tx.curriculumUnit.create({
        data: {
          curriculumId,
          title: unitInput.title,
          description: unitInput.description,
          confidence: unitInput.confidence,
          sortOrder: unitSortOrder++,
        },
      });

      let topicSortOrder = 0;
      for (const topicInput of unitInput.topics) {
        const topic = await tx.curriculumTopic.create({
          data: {
            curriculumUnitId: unit.id,
            title: topicInput.title,
            description: topicInput.description,
            confidence: topicInput.confidence,
            sourceExcerpt: topicInput.sourceExcerpt,
            estimatedLessonCount: topicInput.estimatedLessonCount,
            sortOrder: topicSortOrder++,
          },
        });
        topicIdByTitle.set(topicInput.title.trim().toLowerCase(), topic.id);

        let skillSortOrder = 0;
        for (const skillInput of topicInput.skills ?? []) {
          const skill = await tx.curriculumSkill.create({
            data: { curriculumTopicId: topic.id, title: skillInput.title, sortOrder: skillSortOrder++ },
          });
          let objectiveSortOrder = 0;
          for (const objectiveText of skillInput.objectives) {
            await tx.curriculumObjective.create({
              data: {
                curriculumTopicId: topic.id,
                curriculumSkillId: skill.id,
                description: objectiveText,
                sortOrder: objectiveSortOrder++,
              },
            });
          }
        }

        let unskilledSortOrder = 1000; // sort after skill-attached objectives
        for (const objectiveText of topicInput.unskilledObjectives ?? []) {
          await tx.curriculumObjective.create({
            data: { curriculumTopicId: topic.id, description: objectiveText, sortOrder: unskilledSortOrder++ },
          });
        }

        if ((topicInput.prerequisiteTopicTitles ?? []).length > 0) {
          pendingPrerequisites.push({ topicId: topic.id, requiredTitles: topicInput.prerequisiteTopicTitles ?? [] });
        }
      }
    }

    // Second pass: resolve prerequisite titles to ids now that every topic in this
    // curriculum exists. Unresolvable titles (the model referenced something outside its
    // own outline) are silently skipped rather than failing the whole persistence.
    for (const pending of pendingPrerequisites) {
      for (const title of pending.requiredTitles) {
        const requiresTopicId = topicIdByTitle.get(title.trim().toLowerCase());
        if (!requiresTopicId || requiresTopicId === pending.topicId) continue;
        await tx.curriculumPrerequisite.upsert({
          where: { topicId_requiresTopicId: { topicId: pending.topicId, requiresTopicId } },
          update: {},
          create: { topicId: pending.topicId, requiresTopicId },
        });
      }
    }
  });
}

// --- Approve outline -----------------------------------------------------------------------

itemRouter.post('/:id/approve-outline', requireOwnership('curriculum', 'id'), async (req, res, next) => {
  try {
    const curriculumId = Number(req.params.id);
    const curriculum = await prisma.curriculum.findUniqueOrThrow({ where: { id: curriculumId } });
    if (curriculum.status !== 'outline_generated') throw new HttpError(409, 'curriculum_outline_not_ready');

    const updated = await prisma.curriculum.update({
      where: { id: curriculumId },
      data: { status: 'awaiting_approval', outlineApprovedAt: new Date(), outlineApprovedByUserId: req.userId },
    });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Mounted at /curriculum-topics — Stage 2 (per-topic lesson generation)
// ---------------------------------------------------------------------------
export const topicLessonRouter = Router();
topicLessonRouter.use(requireAuth);

topicLessonRouter.post('/:topicId/generate-lessons', requireOwnership('curriculumTopic', 'topicId'), aiGenerationRateLimiter, async (req, res, next) => {
  try {
    const topicId = Number(req.params.topicId);
    const topic = await prisma.curriculumTopic.findUniqueOrThrow({
      where: { id: topicId },
      include: {
        unit: { include: { curriculum: true } },
        skills: { include: { objectives: true }, orderBy: { sortOrder: 'asc' } },
        objectives: { where: { curriculumSkillId: null }, orderBy: { sortOrder: 'asc' } },
        prerequisites: { include: { requiresTopic: true } },
      },
    });
    const curriculum = topic.unit.curriculum;
    await requireAiEnabled(curriculum.userId);

    if (!['awaiting_approval', 'generating_lessons', 'ready'].includes(curriculum.status)) {
      throw new HttpError(409, 'curriculum_outline_not_approved');
    }

    await prisma.curriculumTopic.update({ where: { id: topicId }, data: { lessonPlanStatus: 'generating' } });
    if (curriculum.status === 'awaiting_approval') {
      await prisma.curriculum.update({ where: { id: curriculum.id }, data: { status: 'generating_lessons' } });
    }

    const generation = await prisma.aiGeneration.create({
      data: {
        userId: curriculum.userId,
        curriculumId: curriculum.id,
        kind: 'curriculum_lesson_generation',
        status: 'queued',
        requestContextRedacted: {
          subjectArea: curriculum.subjectArea,
          gradeLevel: curriculum.gradeLevel,
          topicTitle: topic.title,
          estimatedLessonCount: topic.estimatedLessonCount,
        },
      },
    });

    const skillsBlock =
      topic.skills
        .map((skill, i) => `Skill ${i}: ${skill.title}\n${skill.objectives.map((o) => `  - ${o.description}`).join('\n')}`)
        .join('\n') +
      (topic.objectives.length > 0 ? `\nOther objectives (not tied to a single skill):\n${topic.objectives.map((o) => `  - ${o.description}`).join('\n')}` : '');

    const provider = getAiProvider();
    const startedAt = Date.now();
    let result;
    try {
      result = await provider.generateJson({
        systemPrompt: DEFAULT_TOPIC_LESSON_PLAN_SYSTEM_PROMPT,
        userPrompt: renderTemplate(DEFAULT_TOPIC_LESSON_PLAN_USER_PROMPT_TEMPLATE, {
          subjectArea: curriculum.subjectArea,
          gradeLevel: curriculum.gradeLevel ?? 'unspecified',
          pedagogyHint: subjectPedagogyHint(curriculum.subjectArea),
          topicTitle: topic.title,
          topicDescription: topic.description ?? '(none)',
          estimatedLessonCount: topic.estimatedLessonCount ?? 3,
          skillsBlock: skillsBlock || '(none specified)',
          prerequisiteTitles: topic.prerequisites.map((p) => p.requiresTopic.title).join(', ') || 'none',
        }),
        schema: curriculumTopicLessonPlanSchema,
      });
    } catch (err) {
      await prisma.curriculumTopic.update({ where: { id: topicId }, data: { lessonPlanStatus: 'failed' } });
      if (err instanceof AiNotConfiguredError) {
        await prisma.aiGeneration.update({
          where: { id: generation.id },
          data: { status: 'failed', validationStatus: 'invalid', errorMessage: 'AI provider not configured', durationMs: Date.now() - startedAt },
        });
        return res.status(503).json({ error: 'ai_not_configured', message: 'AI features are not set up yet.', generationId: generation.id });
      }
      throw err;
    }

    await persistTopicLessonPlan(topicId, generation.id, result.data, topic.skills.map((s) => s.id));
    await prisma.curriculumTopic.update({ where: { id: topicId }, data: { lessonPlanStatus: 'generated' } });

    const remainingPending = await prisma.curriculumTopic.count({
      where: { unit: { curriculumId: curriculum.id }, lessonPlanStatus: { not: 'generated' } },
    });
    if (remainingPending === 0) {
      await prisma.curriculum.update({ where: { id: curriculum.id }, data: { status: 'ready' } });
    }

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
        resultRefTable: 'CurriculumTopic',
        resultRefId: topicId,
      },
    });

    const updatedTopic = await prisma.curriculumTopic.findUniqueOrThrow({
      where: { id: topicId },
      include: { lessons: { include: { sections: true }, orderBy: { sequenceNumber: 'asc' } }, assessment: { include: { questions: true } } },
    });
    res.status(201).json({ data: updatedTopic });
  } catch (err) {
    next(err);
  }
});

async function persistTopicLessonPlan(topicId: number, generationId: number, plan: CurriculumTopicLessonPlan, skillIdsInPromptOrder: number[]) {
  await prisma.curriculumLesson.deleteMany({ where: { curriculumTopicId: topicId } });
  await prisma.curriculumAssessment.deleteMany({ where: { curriculumTopicId: topicId } });

  await prisma.$transaction(async (tx) => {
    let sequenceNumber = 1;
    for (const lessonInput of plan.lessons) {
      await tx.curriculumLesson.create({
        data: {
          curriculumTopicId: topicId,
          title: lessonInput.title,
          lessonType: lessonInput.lessonType,
          estimatedMinutes: lessonInput.estimatedMinutes,
          sequenceNumber: sequenceNumber++,
          generationId,
          sections: {
            create: lessonInput.sections.map((s, i) => ({
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
      });
    }

    await tx.curriculumAssessment.create({
      data: {
        curriculumTopicId: topicId,
        title: plan.assessment.title,
        generationId,
        questions: {
          create: plan.assessment.questions.map((q, i) => ({
            type: q.type,
            prompt: q.prompt,
            choices: q.choices,
            correctAnswer: q.correctAnswer as never,
            difficultyLevel: q.difficultyLevel ?? 'medium',
            curriculumSkillId: q.skillIndex !== undefined ? (skillIdsInPromptOrder[q.skillIndex] ?? null) : null,
            sortOrder: i,
          })),
        },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Mounted at /children/:childId/curricula
// ---------------------------------------------------------------------------
export const childNestedRouter = Router({ mergeParams: true });
childNestedRouter.use(requireAuth);

childNestedRouter.get('/', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const childCurricula = await prisma.childCurriculum.findMany({
      where: { childId: Number(req.params.childId) },
      include: { curriculum: true, subject: true },
      orderBy: { adoptedAt: 'desc' },
    });
    res.json({ data: childCurricula });
  } catch (err) {
    next(err);
  }
});

const adoptSchema = z.object({ startDate: z.string().datetime().optional() });

childNestedRouter.post(
  '/:curriculumId/adopt',
  requireOwnership('child', 'childId'),
  requireOwnership('curriculum', 'curriculumId'),
  async (req, res, next) => {
    try {
      const childId = Number(req.params.childId);
      const curriculumId = Number(req.params.curriculumId);
      const body = adoptSchema.parse(req.body);

      const existing = await prisma.childCurriculum.findUnique({ where: { childId_curriculumId: { childId, curriculumId } } });
      if (existing) throw new HttpError(409, 'already_adopted');

      const curriculum = await prisma.curriculum.findUniqueOrThrow({ where: { id: curriculumId }, include: CURRICULUM_TREE_INCLUDE });
      if (curriculum.status !== 'ready') throw new HttpError(409, 'curriculum_not_ready');

      const studyPlan = await adoptCurriculumForChild(childId, curriculum, body.startDate ? new Date(body.startDate) : undefined);
      res.status(201).json({ data: studyPlan });
    } catch (err) {
      next(err);
    }
  }
);

type CurriculumTree = Prisma.CurriculumGetPayload<{ include: typeof CURRICULUM_TREE_INCLUDE }>;

async function adoptCurriculumForChild(childId: number, curriculum: CurriculumTree, startDate?: Date) {
  const child = await prisma.child.findUniqueOrThrow({ where: { id: childId } });

  // Flat, curriculum-wide ordered list of every lesson to be materialized, built up while
  // copying so pacing/StudyPlanItem creation can run in one pass afterward.
  const orderedLessons: Array<{
    curriculumTopicId: number;
    realTopicId: number;
    curriculumLessonId: number;
    title: string;
    estimatedMinutes: number;
    lessonType: string;
    sequenceNumber: number;
    sections: Array<{
      kind: string;
      content: string;
      sortOrder: number;
      interactionType: string | null;
      choices: unknown;
      correctAnswer: unknown;
      hints: unknown;
    }>;
  }> = [];

  return prisma.$transaction(async (tx) => {
    const subject =
      (await tx.subject.findFirst({ where: { userId: child.userId, childId, name: curriculum.subjectArea } })) ??
      (await tx.subject.create({ data: { userId: child.userId, childId, name: curriculum.subjectArea } }));

    const realTopicIdByCurriculumTopicId = new Map<number, number>();

    let unitSortOrder = 0;
    for (const cUnit of curriculum.units) {
      const unit = await tx.unit.create({
        data: { subjectId: subject.id, name: cUnit.title, description: cUnit.description, sortOrder: unitSortOrder++ },
      });

      let topicSortOrder = 0;
      for (const cTopic of cUnit.topics) {
        const estimatedMinutes = cTopic.lessons.reduce((sum, l) => sum + l.estimatedMinutes, 0) || 30;
        const topic = await tx.topic.create({
          data: {
            unitId: unit.id,
            title: cTopic.title,
            description: cTopic.description,
            estimatedMinutes,
            curriculumTopicId: cTopic.id,
            required: true,
            sortOrder: topicSortOrder++,
          },
        });
        realTopicIdByCurriculumTopicId.set(cTopic.id, topic.id);

        for (const cLesson of cTopic.lessons) {
          orderedLessons.push({
            curriculumTopicId: cTopic.id,
            realTopicId: topic.id,
            curriculumLessonId: cLesson.id,
            title: cLesson.title,
            estimatedMinutes: cLesson.estimatedMinutes,
            lessonType: cLesson.lessonType,
            sequenceNumber: cLesson.sequenceNumber,
            sections: cLesson.sections.map((s) => ({
              kind: s.kind,
              content: s.content,
              sortOrder: s.sortOrder,
              interactionType: s.interactionType,
              choices: s.choices as never,
              correctAnswer: s.correctAnswer as never,
              hints: s.hints as never,
            })),
          });
        }

        if (cTopic.assessment) {
          await tx.assessment.create({
            data: {
              topicId: topic.id,
              title: cTopic.assessment.title,
              source: 'curriculum_generated',
              questions: {
                create: cTopic.assessment.questions.map((q) => ({
                  type: q.type,
                  prompt: q.prompt,
                  choices: q.choices as never,
                  correctAnswer: q.correctAnswer as never,
                  difficultyLevel: q.difficultyLevel,
                  sourceCurriculumSkillId: q.curriculumSkillId,
                  sortOrder: q.sortOrder,
                })),
              },
            },
          });
        }
      }
    }

    // Second pass: resolve CurriculumPrerequisite edges into the real Topic.prerequisites
    // Json field, the same convention topics.ts already uses for manually-set prerequisites.
    for (const cUnit of curriculum.units) {
      for (const cTopic of cUnit.topics) {
        if (cTopic.prerequisites.length === 0) continue;
        const realIds = cTopic.prerequisites
          .map((p) => realTopicIdByCurriculumTopicId.get(p.requiresTopicId))
          .filter((id): id is number => id !== undefined);
        if (realIds.length > 0) {
          await tx.topic.update({ where: { id: realTopicIdByCurriculumTopicId.get(cTopic.id)! }, data: { prerequisites: realIds } });
        }
      }
    }

    const pacingDates = await assignPacingDates(childId, orderedLessons.length, startDate);

    const createdLessons: Array<{ id: number; topicId: number }> = [];
    for (const l of orderedLessons) {
      const lesson = await tx.lesson.create({
        data: {
          topicId: l.realTopicId,
          title: l.title,
          estimatedMinutes: l.estimatedMinutes,
          status: 'approved',
          source: 'curriculum_generated',
          curriculumLessonId: l.curriculumLessonId,
          lessonType: l.lessonType,
          sequenceNumber: l.sequenceNumber,
          sections: { create: l.sections as never },
        },
      });
      createdLessons.push({ id: lesson.id, topicId: l.realTopicId });
    }

    const childCurriculum = await tx.childCurriculum.create({
      data: { childId, curriculumId: curriculum.id, subjectId: subject.id, status: 'active' },
    });

    const studyPlan = await tx.studyPlan.create({
      data: { childId, name: curriculum.title, source: 'curriculum_generated', status: 'pending_approval' },
    });

    for (let i = 0; i < createdLessons.length; i++) {
      await tx.studyPlanItem.create({
        data: {
          studyPlanId: studyPlan.id,
          topicId: createdLessons[i].topicId,
          lessonId: createdLessons[i].id,
          scheduledDate: pacingDates[i],
          sortOrder: i,
        },
      });
    }

    void childCurriculum; // adoption record created; not needed further in this response
    return tx.studyPlan.findUniqueOrThrow({ where: { id: studyPlan.id }, include: { items: true } });
  });
}

// --- Coverage --------------------------------------------------------------------------

childNestedRouter.get('/:curriculumId/coverage', requireOwnership('child', 'childId'), requireOwnership('curriculum', 'curriculumId'), async (req, res, next) => {
  try {
    const childId = Number(req.params.childId);
    const curriculumId = Number(req.params.curriculumId);

    const childCurriculum = await prisma.childCurriculum.findUnique({ where: { childId_curriculumId: { childId, curriculumId } } });
    if (!childCurriculum) throw new HttpError(404, 'not_adopted');

    const topics = await prisma.topic.findMany({
      where: { curriculumTopicId: { not: null }, curriculumTopic: { unit: { curriculumId } } },
      include: { masteries: { where: { childId } }, curriculumTopic: { include: { objectives: true } }, lessons: true },
    });

    const totalTopics = topics.length;
    const masteredTopics = topics.filter((t) => t.masteries[0]?.state === 'mastered').length;
    const inProgressTopics = topics.filter((t) => t.masteries[0] && !['not_started', 'mastered'].includes(t.masteries[0].state)).length;

    const totalObjectives = topics.reduce((sum, t) => sum + t.curriculumTopic!.objectives.length, 0);
    const masteredObjectivesApprox = topics
      .filter((t) => t.masteries[0]?.state === 'mastered')
      .reduce((sum, t) => sum + t.curriculumTopic!.objectives.length, 0);

    const lessonIds = topics.flatMap((t) => t.lessons.map((l) => l.id));
    const totalLessons = lessonIds.length;
    const completedLessons =
      lessonIds.length > 0
        ? await prisma.learningSession.count({ where: { childId, lessonId: { in: lessonIds }, status: 'done' } })
        : 0;

    res.json({
      data: {
        totalTopics,
        masteredTopics,
        inProgressTopics,
        totalLessons,
        completedLessons,
        totalObjectives,
        masteredObjectivesApprox,
        objectivesApproximate: true, // per-child mastery is topic-grained, not objective-grained — see plan
        percentComplete: totalTopics > 0 ? Math.round((masteredTopics / totalTopics) * 100) : 0,
      },
    });
  } catch (err) {
    next(err);
  }
});
