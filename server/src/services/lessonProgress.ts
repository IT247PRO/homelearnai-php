/**
 * Pure logic behind the Kids Mode Lesson Player's "evidence-based completion" rule
 * (Plan3 §65's Golden Rule: page viewed != lesson completed). Kept free of Prisma so it's
 * directly unit-testable, matching this codebase's curriculumPacing.ts/curriculumQuality.ts
 * precedent — routes/kidsLessons.ts is the thin DB-backed wrapper around these functions.
 */

export interface ResponseOutcome {
  isCorrect: boolean | null;
}

/**
 * Whether the child may move past a section. Static (non-interactive) sections are always
 * passable. An interactive section requires at least one recorded response, and either a
 * correct answer or 3 attempts (hints exhausted) — a release valve so a struggling child is
 * never permanently blocked (Plan3 §15: hints, then a worked explanation, never a dead end).
 */
export function canAdvancePastSection(interactionType: string | null | undefined, responses: ResponseOutcome[]): boolean {
  if (!interactionType) return true;
  if (responses.length === 0) return false;
  if (responses[responses.length - 1]?.isCorrect === true) return true;
  return responses.length >= 3;
}

export interface HintResponse {
  hint?: string;
  revealAnswer: boolean;
}

/**
 * Progressive hint tier (Plan3 §15): 1st wrong attempt gets a gentle nudge, 2nd gets a more
 * specific hint, 3rd+ stops gating and reveals that the correct answer should be shown
 * (never bare "wrong, try again" — Plan3 §14/§19).
 */
export function computeHintResponse(hints: string[] | null | undefined, attemptNumber: number, isCorrect: boolean): HintResponse {
  if (isCorrect) return { revealAnswer: false };
  const list = hints ?? [];
  if (attemptNumber <= 1) return { hint: list[0], revealAnswer: false };
  if (attemptNumber === 2) return { hint: list[1] ?? list[0], revealAnswer: false };
  return { revealAnswer: true };
}

/**
 * Coarse pass/fail signal fed into recordMasteryOutcome on lesson completion: true when at
 * least half of the lesson's interactive sections were ultimately answered correctly
 * (whether on the first try or after a hint) rather than only reached via reveal-exhaustion.
 * Lessons with no interactive sections count as passed — there's nothing to have gotten
 * wrong, so completing them is itself the evidence.
 */
export function computeLessonWasCorrect(finalOutcomes: Array<boolean | null>): boolean {
  const graded = finalOutcomes.filter((o): o is boolean => o !== null);
  if (graded.length === 0) return true;
  return graded.filter(Boolean).length / graded.length >= 0.5;
}
