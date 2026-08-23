import { prisma } from '../lib/prisma.js';
import { recordMasteryOutcome } from './mastery.js';
import { recordActivity } from './gamification.js';
import { isQuestionAnswerCorrect } from './answerChecking.js';
import { gradeOpenEndedAnswer } from './openEndedGrading.js';

/**
 * Shared by the parent-facing assessment routes (routes/assessments.ts) and the Kids-Mode
 * equivalents (routes/kidsLessons.ts) so the deterministic/AI-assisted grading logic exists
 * exactly once regardless of which surface a child or parent is answering through.
 */
export async function submitAssessmentAnswer(attemptId: number, questionId: number, response: unknown) {
  const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
  let isCorrect = isQuestionAnswerCorrect(question, response);
  let misconceptionTag: string | undefined;
  let feedback: string | undefined;

  // Deterministic grading covers every other question type; this only runs for open_ended,
  // the one type isQuestionAnswerCorrect can never resolve on its own.
  if (isCorrect === null && question.type === 'open_ended' && typeof response === 'string') {
    const attempt = await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { child: true } });
    const settings = await prisma.familyAiSettings.findUnique({ where: { userId: attempt.child.userId } });
    if (settings?.aiEnabled && settings.contentGenerationEnabled) {
      const graded = await gradeOpenEndedAnswer({
        prompt: question.prompt,
        expectedAnswer: typeof question.correctAnswer === 'string' ? question.correctAnswer : null,
        response,
      });
      if (graded) {
        isCorrect = graded.isCorrect;
        misconceptionTag = graded.misconceptionTag;
        feedback = graded.feedback;
      }
    }
  }

  const answer = await prisma.answer.create({
    data: { attemptId, questionId, response: response as never, isCorrect, misconceptionTag },
  });
  return { ...answer, feedback };
}

/**
 * Scores the attempt, records mastery against the curriculum's configured threshold (falling
 * back to a fixed 70% for non-curriculum-linked topics — plan2.md §17), and — below
 * threshold on a curriculum-linked topic — creates a "remediation" AiRecommendation the
 * parent can act on (plan2.md §19, scoped down; see the curriculum-engine plan).
 */
export async function completeAssessmentAttempt(attemptId: number) {
  const attempt = await prisma.assessmentAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { assessment: { include: { topic: { include: { curriculumTopic: { include: { unit: { include: { curriculum: true } } } } } } } }, answers: true },
  });

  const scoredAnswers = attempt.answers.filter((a) => a.isCorrect !== null);
  const score = scoredAnswers.length > 0 ? scoredAnswers.filter((a) => a.isCorrect).length / scoredAnswers.length : null;

  const updated = await prisma.assessmentAttempt.update({
    where: { id: attemptId },
    data: { status: 'completed', completedAt: new Date(), score },
  });

  if (score !== null && attempt.assessment.topicId) {
    const curriculum = attempt.assessment.topic?.curriculumTopic?.unit.curriculum;
    const masteryThreshold = curriculum ? curriculum.masteryThresholdPercent / 100 : 0.7;
    const passed = score >= masteryThreshold;

    await recordMasteryOutcome({
      childId: attempt.childId,
      topicId: attempt.assessment.topicId,
      wasCorrect: passed,
      trigger: 'assessment',
      sourceAssessmentId: attemptId,
    });

    if (!passed && curriculum) {
      await prisma.aiRecommendation.create({
        data: {
          childId: attempt.childId,
          kind: 'remediation',
          title: `Review needed: ${attempt.assessment.title}`,
          body: `Scored ${Math.round(score * 100)}%, below this curriculum's ${curriculum.masteryThresholdPercent}% mastery threshold.`,
          payload: { topicId: attempt.assessment.topicId, curriculumTopicId: attempt.assessment.topic?.curriculumTopic?.id },
        },
      });
    }
  }
  await recordActivity(attempt.childId, 15);

  return updated;
}
