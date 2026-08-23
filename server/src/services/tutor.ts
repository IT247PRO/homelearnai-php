import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';
import { AiNotConfiguredError, getAiProvider } from '../ai/provider.js';
import { RICH_FORMATTING_INSTRUCTION } from '../ai/promptTemplates.js';
import type { StudyGuideGeneration } from '../ai/schemas.js';
import { pickStudyGuideConcept } from './studyGuideGeneration.js';
import { ageGroupForGrade } from './qualityHeuristics.js';

export const tutorReplySchema = z.object({
  reply: z.string().min(1).max(4000),
  followUpQuestion: z.string().max(300).optional(),
  recommendsPractice: z.boolean().optional(),
});

const MAX_HISTORY_MESSAGES = 20;

/** Kids Mode 2.0 (src-v2/Plan3.md §42-44, scoped): when the child is asking from inside the
 * Lesson Player, the tutor should see the lesson/section they're actually looking at and
 * their own recent mistakes in it — not just the topic in the abstract. Bounded to the
 * current lesson's section content + up to 3 recent wrong answers (never the whole
 * curriculum or child history — plan.md's AI cost/privacy guidance). */
export interface LessonTutorContext {
  lessonTitle: string;
  currentSectionKind: string;
  currentSectionContent: string;
  recentMistakes: string[];
}

/** When the child is reading the Study Guide (plan4.md §31) rather than the Lesson Player —
 * mutually exclusive with LessonTutorContext in practice, since only one screen is ever
 * active; if both are somehow present, the lesson context wins (see call site). */
export interface StudyGuideTutorContext {
  overview: string;
  currentConceptTitle?: string;
  currentConceptContent?: string;
}

/** Fixed, not user-editable — the safety/pedagogy rules from plan.md's "AI Tutor" and
 * "AI Safety for Children" sections apply to every conversation regardless of topic. */
export function buildTutorSystemPrompt(
  ageGroup: string,
  topicTitle: string,
  topicContent: string | null,
  lessonContext?: LessonTutorContext,
  studyGuideContext?: StudyGuideTutorContext
): string {
  return `You are a patient, encouraging AI tutor helping a child in the ${ageGroup} age group understand "${topicTitle}".
${topicContent ? `Reference material for this topic:\n${topicContent}\n` : ''}${
    lessonContext
      ? `The child is currently in the lesson "${lessonContext.lessonTitle}", looking at a "${lessonContext.currentSectionKind}" section:\n${lessonContext.currentSectionContent}\n${
          lessonContext.recentMistakes.length > 0
            ? `The child recently answered incorrectly on: ${lessonContext.recentMistakes.join('; ')}. Keep this in mind if it's relevant.\n`
            : ''
        }Prioritize this exact lesson content over generic knowledge when answering.\n`
      : studyGuideContext
        ? `The child is currently reading the Study Guide for this topic.\nStudy Guide overview: ${studyGuideContext.overview}\n${
            studyGuideContext.currentConceptTitle
              ? `They are looking at the concept "${studyGuideContext.currentConceptTitle}":\n${studyGuideContext.currentConceptContent}\n`
              : ''
          }Prioritize this exact study guide content over generic knowledge when answering.\n`
        : ''
  }
Rules you must always follow:
- Use vocabulary and sentence complexity appropriate for the ${ageGroup} age group.
- Teach with Socratic questioning: for anything that looks like a homework/assignment question, guide the child toward the answer with a follow-up question rather than stating the final answer outright.
- Use concrete examples and encourage the child's own reasoning.
- If the child's message suggests confusion, acknowledge it and offer to explain differently or more simply.
- Recommend additional practice when it would help, via recommendsPractice.
- Stay strictly on this topic; redirect politely if asked something unrelated to learning.
- Never include inappropriate, sexual, violent, or unsafe content. Never request personal information. Never pretend to be the child's parent. If the child asks something that suggests they need a trusted adult (safety, emotional distress, etc.), gently suggest they talk to a parent or guardian.
${RICH_FORMATTING_INSTRUCTION}`;
}

export interface TutorMessageParams {
  userId: number;
  childId: number;
  topicId: number;
  lessonId?: number;
  sectionId?: number;
  studyGuideVersionId?: number;
  conceptIndex?: number;
  conversationId?: number;
  message: string;
}

const MAX_RECENT_MISTAKES = 3;

async function buildLessonContext(childId: number, lessonId: number, sectionId?: number): Promise<LessonTutorContext | undefined> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { sections: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!lesson) return undefined;

  const currentSection = (sectionId ? lesson.sections.find((s) => s.id === sectionId) : undefined) ?? lesson.sections[0];
  if (!currentSection) return undefined;

  const wrongResponses = await prisma.lessonSectionResponse.findMany({
    where: { childId, isCorrect: false, section: { lessonId } },
    include: { section: true },
    orderBy: { createdAt: 'desc' },
    take: MAX_RECENT_MISTAKES,
  });

  return {
    lessonTitle: lesson.title,
    currentSectionKind: currentSection.kind,
    currentSectionContent: currentSection.content,
    recentMistakes: wrongResponses.map((r) => r.section.content.slice(0, 200)),
  };
}

/** Only a *published* version belonging to this exact topic is ever eligible — a child must
 * never get tutor context sourced from a draft they can't otherwise see (plan4 §19/§45). */
async function buildStudyGuideContext(topicId: number, studyGuideVersionId: number, conceptIndex?: number): Promise<StudyGuideTutorContext | undefined> {
  const version = await prisma.studyGuideVersion.findFirst({
    where: { id: studyGuideVersionId, status: 'published', studyGuide: { topicId } },
  });
  if (!version) return undefined;
  return pickStudyGuideConcept(version.content as unknown as StudyGuideGeneration, conceptIndex);
}

/**
 * Shared by both tutor surfaces — the parent-authenticated preview in the curriculum view
 * and the Kids Mode "ask a question" action — so the safety prompt, history handling, and
 * generation bookkeeping only exist once.
 */
export async function postTutorMessage(params: TutorMessageParams) {
  const settings = await prisma.familyAiSettings.findUnique({ where: { userId: params.userId } });
  if (!settings?.aiEnabled || !settings.tutorEnabled) throw new HttpError(403, 'tutor_disabled_by_parent');

  const [child, topic] = await Promise.all([
    prisma.child.findUniqueOrThrow({ where: { id: params.childId } }),
    prisma.topic.findUniqueOrThrow({ where: { id: params.topicId } }),
  ]);

  const conversation = params.conversationId
    ? await prisma.aiConversation.findUniqueOrThrow({ where: { id: params.conversationId } })
    : await prisma.aiConversation.create({
        data: {
          userId: params.userId,
          childId: params.childId,
          topicId: params.topicId,
          lessonId: params.lessonId,
          studyGuideVersionId: params.studyGuideVersionId,
          kind: 'tutor',
        },
      });

  const lessonContext = params.lessonId ? await buildLessonContext(params.childId, params.lessonId, params.sectionId) : undefined;
  const studyGuideContext =
    !params.lessonId && params.studyGuideVersionId
      ? await buildStudyGuideContext(params.topicId, params.studyGuideVersionId, params.conceptIndex)
      : undefined;

  const history = await prisma.aiMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'desc' },
    take: MAX_HISTORY_MESSAGES,
  });
  history.reverse();

  await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: 'user', content: params.message } });

  const generation = await prisma.aiGeneration.create({
    data: { userId: params.userId, childId: params.childId, conversationId: conversation.id, kind: 'tutor_reply', status: 'queued' },
  });

  const ageGroup = ageGroupForGrade(child.grade);
  const systemPrompt = buildTutorSystemPrompt(ageGroup, topic.title, topic.learningContent, lessonContext, studyGuideContext);
  const conversationText = [...history.map((m) => `${m.role === 'user' ? 'Child' : 'Tutor'}: ${m.content}`), `Child: ${params.message}`].join('\n');

  const provider = getAiProvider();
  const startedAt = Date.now();
  let result;
  try {
    result = await provider.generateJson({
      systemPrompt,
      userPrompt: `Conversation so far:\n${conversationText}\n\nRespond as the tutor to the child's latest message.`,
      schema: tutorReplySchema,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: { status: 'failed', validationStatus: 'invalid', errorMessage: 'AI provider not configured', durationMs: Date.now() - startedAt },
      });
    }
    throw err;
  }

  const assistantMessage = await prisma.aiMessage.create({
    data: { conversationId: conversation.id, role: 'assistant', content: result.data.reply },
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
      resultRefTable: 'AiMessage',
      resultRefId: assistantMessage.id,
    },
  });

  return {
    conversationId: conversation.id,
    reply: result.data.reply,
    followUpQuestion: result.data.followUpQuestion,
    recommendsPractice: result.data.recommendsPractice,
  };
}
