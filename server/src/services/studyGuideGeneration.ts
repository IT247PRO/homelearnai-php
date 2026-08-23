import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';
import { AiNotConfiguredError, getAiProvider } from '../ai/provider.js';
import { RICH_FORMATTING_INSTRUCTION } from '../ai/promptTemplates.js';
import { studyGuideGenerationSchema, type StudyGuideGeneration } from '../ai/schemas.js';

const MAX_LESSONS_IN_PROMPT = 10;
const MAX_CHARS_PER_LESSON = 4000;

interface TopicForPrompt {
  title: string;
  description: string | null;
  learningContent: string | null;
}

interface LessonForPrompt {
  title: string;
  sections: Array<{ kind: string; content: string }>;
}

/** Pure and unit-testable. Aggregates the topic's own notes plus its approved lessons'
 * section content — approved only (plan4 §52): an unreviewed AI-generated lesson draft
 * shouldn't silently become a trusted curriculum source for the guide. */
export function buildStudyGuidePrompt(topic: TopicForPrompt, lessons: LessonForPrompt[], reason?: string): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are an experienced curriculum designer creating a complete Study Guide for a child. A Study Guide is not a summary of one lesson — it is a synthesized conceptual map of the whole topic: explain the complete concept as if the child may never have seen it before, with simple and detailed explanations, examples, real-world connections, and common misconceptions for each key concept. Generate JSON matching the schema. Never include unsafe or off-topic content. ${RICH_FORMATTING_INSTRUCTION}`;

  const lessonBlocks = lessons.slice(0, MAX_LESSONS_IN_PROMPT).map((lesson, i) => {
    const body = lesson.sections
      .map((s) => s.content)
      .join('\n')
      .slice(0, MAX_CHARS_PER_LESSON);
    return `Lesson ${i + 1}: ${lesson.title}\n${body}`;
  });

  const userPrompt = `Topic: ${topic.title}${topic.description ? `\nDescription: ${topic.description}` : ''}
Existing topic notes: ${topic.learningContent ?? '(none)'}

${lessonBlocks.length > 0 ? `Approved lesson content for this topic:\n${lessonBlocks.join('\n\n')}` : '(No approved lessons yet — build the guide from the topic notes and your own curriculum knowledge for this subject/grade.)'}
${reason ? `\nThe parent requested this regeneration for the following reason — address it directly: ${reason}` : ''}

Generate a complete study guide: an overview, learning objectives, fully-explained key concepts (each with a simple explanation, a detailed explanation, an example, a real-world application, and common misconceptions), vocabulary terms, and practice/review questions.`;

  return { systemPrompt, userPrompt };
}

/** Pure. Picks the concept the AI Tutor should focus on when a child asks a question while
 * reading a specific concept in the Study Guide reader (falls back to the first concept). */
export function pickStudyGuideConcept(content: StudyGuideGeneration, conceptIndex?: number): { overview: string; currentConceptTitle?: string; currentConceptContent?: string } {
  const concept = conceptIndex !== undefined ? content.concepts[conceptIndex] : content.concepts[0];
  if (!concept) return { overview: content.overview };
  return {
    overview: content.overview,
    currentConceptTitle: concept.title,
    currentConceptContent: [concept.simpleExplanation, concept.detailedExplanation, concept.example].filter(Boolean).join('\n\n'),
  };
}

export interface GenerateStudyGuideParams {
  topicId: number;
  userId: number;
  reason?: string;
}

/** Shared by the /generate and /regenerate routes — both need the identical generate/
 * validate/persist/bookkeep flow, mirroring ai.ts's lesson-generation handler exactly:
 * an AiGeneration row for traceability, a draft result requiring explicit parent
 * publish (plan4 §19), and the same AiNotConfiguredError handling as postTutorMessage. */
export async function generateStudyGuide(params: GenerateStudyGuideParams) {
  const settings = await prisma.familyAiSettings.findUnique({ where: { userId: params.userId } });
  if (!settings?.aiEnabled) throw new HttpError(403, 'ai_disabled_by_parent');

  const topic = await prisma.topic.findUniqueOrThrow({ where: { id: params.topicId } });
  const lessons = await prisma.lesson.findMany({
    where: { topicId: params.topicId, status: 'approved' },
    include: { sections: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sequenceNumber: 'asc' },
  });

  const generation = await prisma.aiGeneration.create({
    data: {
      userId: params.userId,
      kind: 'study_guide_generation',
      status: 'queued',
      requestContextRedacted: { topicTitle: topic.title, reason: params.reason },
    },
  });

  const { systemPrompt, userPrompt } = buildStudyGuidePrompt(topic, lessons, params.reason);

  const provider = getAiProvider();
  const startedAt = Date.now();
  let result;
  try {
    result = await provider.generateJson({ systemPrompt, userPrompt, schema: studyGuideGenerationSchema });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: { status: 'failed', validationStatus: 'invalid', errorMessage: 'AI provider not configured', durationMs: Date.now() - startedAt },
      });
    }
    throw err;
  }

  const { studyGuide, version } = await prisma.$transaction(async (tx) => {
    const existing = await tx.studyGuide.findUnique({ where: { topicId: params.topicId }, include: { versions: true } });
    const guide =
      existing ?? (await tx.studyGuide.create({ data: { scopeType: 'topic', topicId: params.topicId } }));
    const nextVersionNumber = (existing?.versions.reduce((max, v) => Math.max(max, v.versionNumber), 0) ?? 0) + 1;

    const newVersion = await tx.studyGuideVersion.create({
      data: {
        studyGuideId: guide.id,
        versionNumber: nextVersionNumber,
        status: 'draft',
        content: result.data as never,
        reason: params.reason,
        generationId: generation.id,
      },
    });

    const updatedGuide = await tx.studyGuide.update({
      where: { id: guide.id },
      data: { currentVersionId: newVersion.id },
    });

    return { studyGuide: updatedGuide, version: newVersion };
  });

  await prisma.aiGeneration.update({
    where: { id: generation.id },
    data: {
      status: 'succeeded',
      validationStatus: 'valid',
      provider: result.provider,
      model: result.model,
      durationMs: Date.now() - startedAt,
      resultRefTable: 'StudyGuideVersion',
      resultRefId: version.id,
    },
  });

  return { studyGuide, version, generationId: generation.id };
}
