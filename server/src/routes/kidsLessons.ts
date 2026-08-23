import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireKidsModeContext } from '../middleware/kidsMode.js';
import { HttpError } from '../middleware/errorHandler.js';
import { isQuestionAnswerCorrect } from '../services/answerChecking.js';
import { canAdvancePastSection, computeHintResponse, computeLessonWasCorrect } from '../services/lessonProgress.js';
import { recordMasteryOutcome } from '../services/mastery.js';
import { recordActivity } from '../services/gamification.js';
import { submitAssessmentAnswer, completeAssessmentAttempt } from '../services/assessmentAttempts.js';

/**
 * Kids-Mode-scoped Lesson Player + assessment-taking routes (src-v2/Plan3.md). Deliberately
 * re-implemented here rather than reusing the parent-facing routes/lessons.ts and
 * routes/assessments.ts — those are requireAuth+requireOwnership (the parent's own JWT
 * cookie), which a 12h Kids Mode session must not depend on staying valid, and which return
 * `correctAnswer`/`hints` unstripped (fine for a trusted parent reviewing AI output, never
 * fine for a child before they've earned it). Grading/mastery logic itself is shared via
 * services/assessmentAttempts.ts and services/lessonProgress.ts — only the transport layer
 * and field-stripping differ. Mounted at /kids, matching the existing kids.ts convention.
 */
export const router = Router();
router.use(requireKidsModeContext);

async function loadOwnedLesson(lessonId: number, childId: number) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { sections: { orderBy: { sortOrder: 'asc' } }, topic: { include: { unit: { include: { subject: true } } } } },
  });
  if (!lesson || lesson.topic.unit.subject.childId !== childId) throw new HttpError(404, 'not_found');
  return lesson;
}

router.get('/lessons/:lessonId', async (req, res, next) => {
  try {
    const lessonId = Number(req.params.lessonId);
    const childId = req.kidsSession!.childId;
    const lesson = await loadOwnedLesson(lessonId, childId);

    const progress = await prisma.lessonProgress.upsert({
      where: { lessonId_childId: { lessonId, childId } },
      update: {},
      create: { lessonId, childId },
    });

    // So the client can offer "Take the Topic Quiz" right after the last lesson in a topic,
    // without a separate round trip.
    const [nextLesson, topicAssessment] = await Promise.all([
      lesson.sequenceNumber != null
        ? prisma.lesson.findFirst({ where: { topicId: lesson.topicId, sequenceNumber: { gt: lesson.sequenceNumber } }, select: { id: true } })
        : null,
      prisma.assessment.findFirst({ where: { topicId: lesson.topicId }, select: { id: true, title: true } }),
    ]);

    const responses = await prisma.lessonSectionResponse.findMany({
      where: { childId, section: { lessonId } },
      orderBy: { createdAt: 'asc' },
    });
    const responsesBySection = new Map<number, typeof responses>();
    for (const r of responses) {
      const list = responsesBySection.get(r.lessonSectionId) ?? [];
      list.push(r);
      responsesBySection.set(r.lessonSectionId, list);
    }

    const sections = lesson.sections.map((s) => {
      const sectionResponses = responsesBySection.get(s.id) ?? [];
      const latest = sectionResponses[sectionResponses.length - 1];
      // Only compute a hint once the child has actually attempted this section — attemptCount
      // 0 must never surface hints[0] (computeHintResponse's attemptNumber semantics start at
      // the 1st submission, not "no submission yet").
      const hintResult =
        s.interactionType && sectionResponses.length > 0
          ? computeHintResponse(s.hints as string[] | null, sectionResponses.length, latest?.isCorrect === true)
          : { revealAnswer: false, hint: undefined };
      return {
        id: s.id,
        kind: s.kind,
        content: s.content,
        sortOrder: s.sortOrder,
        interactionType: s.interactionType,
        choices: s.choices,
        // Never sent until earned: the raw `hints` array and `correctAnswer` are omitted
        // entirely — only the already-unlocked hint (if any) and a reveal flag survive.
        attemptCount: sectionResponses.length,
        isCorrect: latest?.isCorrect ?? null,
        hint: hintResult.hint,
        revealAnswer: hintResult.revealAnswer,
        correctAnswer: hintResult.revealAnswer ? s.correctAnswer : undefined,
      };
    });

    res.json({
      data: {
        id: lesson.id,
        title: lesson.title,
        topicId: lesson.topicId,
        currentSectionIndex: progress.currentSectionIndex,
        completedAt: progress.completedAt,
        isLastLessonInTopic: !nextLesson,
        topicAssessment,
        sections,
      },
    });
  } catch (err) {
    next(err);
  }
});

const respondSchema = z.object({ response: z.unknown() });

router.post('/lessons/:lessonId/sections/:sectionId/respond', async (req, res, next) => {
  try {
    const lessonId = Number(req.params.lessonId);
    const sectionId = Number(req.params.sectionId);
    const childId = req.kidsSession!.childId;
    const lesson = await loadOwnedLesson(lessonId, childId);

    const section = lesson.sections.find((s) => s.id === sectionId);
    if (!section) throw new HttpError(404, 'not_found');
    if (!section.interactionType) throw new HttpError(400, 'section_not_interactive');

    const { response } = respondSchema.parse(req.body);
    const priorCount = await prisma.lessonSectionResponse.count({ where: { lessonSectionId: sectionId, childId } });
    const attemptNumber = priorCount + 1;

    const isCorrect = isQuestionAnswerCorrect({ type: section.interactionType, correctAnswer: section.correctAnswer }, response);
    await prisma.lessonSectionResponse.create({
      data: { lessonSectionId: sectionId, childId, response: response as never, isCorrect, attemptNumber },
    });

    const hintResult = computeHintResponse(section.hints as string[] | null, attemptNumber, isCorrect === true);
    res.status(201).json({
      data: {
        isCorrect,
        hint: hintResult.hint,
        revealAnswer: hintResult.revealAnswer,
        correctAnswer: hintResult.revealAnswer ? section.correctAnswer : undefined,
        canAdvance: canAdvancePastSection(section.interactionType, [{ isCorrect }]) || attemptNumber >= 3,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/lessons/:lessonId/advance', async (req, res, next) => {
  try {
    const lessonId = Number(req.params.lessonId);
    const childId = req.kidsSession!.childId;
    const lesson = await loadOwnedLesson(lessonId, childId);

    const progress = await prisma.lessonProgress.upsert({
      where: { lessonId_childId: { lessonId, childId } },
      update: {},
      create: { lessonId, childId },
    });

    if (progress.completedAt) {
      return res.json({ data: { completed: true, currentSectionIndex: progress.currentSectionIndex } });
    }

    const currentSection = lesson.sections[progress.currentSectionIndex];
    if (!currentSection) throw new HttpError(409, 'lesson_already_complete');

    const currentResponses = await prisma.lessonSectionResponse.findMany({
      where: { lessonSectionId: currentSection.id, childId },
      orderBy: { createdAt: 'asc' },
    });
    if (!canAdvancePastSection(currentSection.interactionType, currentResponses)) {
      throw new HttpError(409, 'section_not_completed');
    }

    const newIndex = progress.currentSectionIndex + 1;
    const isLastSection = newIndex >= lesson.sections.length;

    if (!isLastSection) {
      const updated = await prisma.lessonProgress.update({ where: { id: progress.id }, data: { currentSectionIndex: newIndex } });
      return res.json({ data: { completed: false, currentSectionIndex: updated.currentSectionIndex } });
    }

    // Last section: gather each interactive section's final (most recent) outcome for the
    // coarse mastery signal, then mark this lesson complete — the concrete evidence behind
    // Plan3 §65's "page viewed != lesson completed".
    const allResponses = await prisma.lessonSectionResponse.findMany({
      where: { childId, section: { lessonId } },
      orderBy: { createdAt: 'asc' },
    });
    const latestBySection = new Map<number, boolean | null>();
    for (const r of allResponses) latestBySection.set(r.lessonSectionId, r.isCorrect);
    const finalOutcomes = lesson.sections.filter((s) => s.interactionType).map((s) => latestBySection.get(s.id) ?? null);
    const wasCorrect = computeLessonWasCorrect(finalOutcomes);

    await prisma.lessonProgress.update({ where: { id: progress.id }, data: { currentSectionIndex: newIndex, completedAt: new Date() } });
    await recordMasteryOutcome({ childId, topicId: lesson.topicId, wasCorrect, trigger: 'lesson_completion' });

    const linkedSession = await prisma.learningSession.findFirst({ where: { childId, lessonId, status: { not: 'done' } } });
    if (linkedSession) {
      await prisma.learningSession.update({ where: { id: linkedSession.id }, data: { status: 'done', completedAt: new Date() } });
    }
    await recordActivity(childId, 10);

    res.json({ data: { completed: true, currentSectionIndex: newIndex, wasCorrect } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Topic assessments, taken from Kids Mode (mirrors routes/assessments.ts's attemptRouter,
// grading/mastery logic shared via services/assessmentAttempts.ts).
// ---------------------------------------------------------------------------

router.get('/assessments/:assessmentId', async (req, res, next) => {
  try {
    const assessmentId = Number(req.params.assessmentId);
    const childId = req.kidsSession!.childId;
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        topic: { include: { unit: { include: { subject: true } }, curriculumTopic: { include: { unit: { include: { curriculum: true } } } } } },
      },
    });
    if (!assessment || assessment.topic?.unit.subject.childId !== childId) throw new HttpError(404, 'not_found');

    res.json({
      data: {
        id: assessment.id,
        title: assessment.title,
        masteryThresholdPercent: assessment.topic?.curriculumTopic?.unit.curriculum.masteryThresholdPercent ?? 70,
        questions: assessment.questions.map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          choices: q.choices,
          difficultyLevel: q.difficultyLevel,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/assessments/:assessmentId/attempts', async (req, res, next) => {
  try {
    const assessmentId = Number(req.params.assessmentId);
    const childId = req.kidsSession!.childId;
    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId }, include: { topic: { include: { unit: { include: { subject: true } } } } } });
    if (!assessment || assessment.topic?.unit.subject.childId !== childId) throw new HttpError(404, 'not_found');

    const attempt = await prisma.assessmentAttempt.create({ data: { assessmentId, childId, status: 'in_progress' } });
    res.status(201).json({ data: attempt });
  } catch (err) {
    next(err);
  }
});

const kidsAnswerSchema = z.object({ questionId: z.number().int(), response: z.unknown() });

async function loadOwnedAttempt(attemptId: number, childId: number) {
  const attempt = await prisma.assessmentAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.childId !== childId) throw new HttpError(404, 'not_found');
  return attempt;
}

router.post('/assessment-attempts/:attemptId/answers', async (req, res, next) => {
  try {
    const attemptId = Number(req.params.attemptId);
    await loadOwnedAttempt(attemptId, req.kidsSession!.childId);
    const { questionId, response } = kidsAnswerSchema.parse(req.body);
    const result = await submitAssessmentAnswer(attemptId, questionId, response);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/assessment-attempts/:attemptId/complete', async (req, res, next) => {
  try {
    const attemptId = Number(req.params.attemptId);
    await loadOwnedAttempt(attemptId, req.kidsSession!.childId);
    const updated = await completeAssessmentAttempt(attemptId);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});
