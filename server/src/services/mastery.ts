import { prisma } from '../lib/prisma.js';

export type MasteryTrigger = 'review' | 'assessment' | 'manual_override' | 'ai_recalc' | 'lesson_completion';

const STATE_ORDER = ['not_started', 'introduced', 'practicing', 'developing', 'proficient', 'mastered'] as const;
export type MasteryState = (typeof STATE_ORDER)[number];

/**
 * First-pass, deterministic mastery model (plan.md leaves the exact formula open — it only
 * mandates the six states and the tracked metrics). Derives a coarse per-(child,topic)
 * mastery state from cumulative attempt count + rolling accuracy, with the underlying
 * spaced-repetition Review reaching `mastered` status as the authoritative override for
 * flashcard-driven topics.
 */
function deriveState(attemptsCount: number, accuracy: number, reviewReachedMastered: boolean): MasteryState {
  if (reviewReachedMastered) return 'mastered';
  if (attemptsCount === 0) return 'not_started';
  if (attemptsCount === 1) return 'introduced';
  if (attemptsCount < 5) return 'practicing';
  if (attemptsCount < 10 || accuracy < 0.6) return 'developing';
  if (accuracy < 0.85) return 'proficient';
  return 'mastered';
}

export interface MasteryUpdateInput {
  childId: number;
  topicId: number;
  wasCorrect: boolean;
  trigger: MasteryTrigger;
  sourceReviewId?: number;
  sourceAssessmentId?: number;
  reviewReachedMastered?: boolean;
}

export async function recordMasteryOutcome(input: MasteryUpdateInput) {
  const existing = await prisma.mastery.findUnique({ where: { childId_topicId: { childId: input.childId, topicId: input.topicId } } });

  const previousAttempts = existing?.attemptsCount ?? 0;
  const previousCorrect = existing ? Math.round((existing.accuracy ?? 0) * previousAttempts) : 0;
  const attemptsCount = previousAttempts + 1;
  const correctCount = previousCorrect + (input.wasCorrect ? 1 : 0);
  const accuracy = correctCount / attemptsCount;

  const previousState = (existing?.state as MasteryState) ?? 'not_started';
  const newState = deriveState(attemptsCount, accuracy, Boolean(input.reviewReachedMastered));

  const forgettingRiskScore = 0; // reset on fresh activity; recomputed by a scheduled job in a later phase

  const mastery = await prisma.mastery.upsert({
    where: { childId_topicId: { childId: input.childId, topicId: input.topicId } },
    update: {
      state: newState,
      accuracy,
      attemptsCount,
      lastActivityAt: new Date(),
      forgettingRiskScore,
    },
    create: {
      childId: input.childId,
      topicId: input.topicId,
      state: newState,
      accuracy,
      attemptsCount,
      lastActivityAt: new Date(),
      forgettingRiskScore,
    },
  });

  if (previousState !== newState) {
    await prisma.masteryEvent.create({
      data: {
        masteryId: mastery.id,
        childId: input.childId,
        topicId: input.topicId,
        previousState,
        newState,
        trigger: input.trigger,
        sourceReviewId: input.sourceReviewId,
        sourceAssessmentId: input.sourceAssessmentId,
        deltaAccuracy: accuracy - (existing?.accuracy ?? 0),
      },
    });
  }

  return mastery;
}
