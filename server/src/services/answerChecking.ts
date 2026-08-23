function normalize(value: unknown): string {
  return String(value).trim().toLowerCase();
}

/** Shared by Assessment questions (see assessments.ts) — kept here alongside the flashcard
 * checker below so both auto-scoring paths live in one place. */
export function isQuestionAnswerCorrect(question: { type: string; correctAnswer: unknown }, response: unknown): boolean | null {
  if (question.correctAnswer === null || question.correctAnswer === undefined) return null; // open-ended: not auto-scored
  if (question.type === 'multiple_choice' || question.type === 'true_false') {
    return JSON.stringify(response) === JSON.stringify(question.correctAnswer);
  }
  if (question.type === 'short_answer' || question.type === 'fill_blank') {
    return normalize(response) === normalize(question.correctAnswer);
  }
  if (question.type === 'ordering' || question.type === 'matching') {
    return JSON.stringify(response) === JSON.stringify(question.correctAnswer);
  }
  return null;
}

export type ReviewResult = 'again' | 'hard' | 'good' | 'easy';

export interface FlashcardAnswerInput {
  cardType: string;
  answer: string;
  correctChoices: unknown;
  clozeAnswers: unknown;
}

/**
 * Ported from the original ReviewController::processFlashcardResult(): validates a
 * submitted answer against the card's actual answer/choices/cloze fields. Returns null when
 * the card type has no reliably auto-checkable answer (e.g. a "basic" card with a long
 * free-form answer) — callers should only force-downgrade the rating when this returns a
 * concrete boolean, not on null.
 */
export function isFlashcardAnswerCorrect(card: FlashcardAnswerInput, response: unknown): boolean | null {
  switch (card.cardType) {
    case 'multiple_choice':
    case 'true_false': {
      const correct = Array.isArray(card.correctChoices) ? card.correctChoices.map(String) : [];
      if (correct.length === 0) return null;
      const given = Array.isArray(response) ? response.map(String) : [String(response)];
      return JSON.stringify([...given].sort()) === JSON.stringify([...correct].sort());
    }
    case 'cloze': {
      const correct = Array.isArray(card.clozeAnswers) ? card.clozeAnswers.map(String) : [];
      if (correct.length === 0) return null;
      const given = Array.isArray(response) ? response.map(String) : [String(response)];
      if (given.length !== correct.length) return false;
      return given.every((g, i) => normalize(g) === normalize(correct[i]));
    }
    case 'typed_answer':
      return normalize(response) === normalize(card.answer);
    default:
      return null; // "basic"/"image_occlusion": self-graded, no auto-check
  }
}

/**
 * Ported from ReviewController::processFlashcardResult()'s behavior: a child can't turn a
 * wrong typed/multiple-choice/cloze answer into a long spaced-repetition interval by
 * clicking "good"/"easy" — if a `response` was actually submitted and it's checkably wrong,
 * the result is force-downgraded to "again" regardless of what was clicked. Cards with no
 * reliably auto-checkable answer (isFlashcardAnswerCorrect returns null) are unaffected —
 * self-rating is all that's possible for those.
 */
export function resolveReviewResult(
  requestedResult: ReviewResult,
  response: unknown | undefined,
  flashcard: FlashcardAnswerInput | null
): ReviewResult {
  if (response === undefined || !flashcard || requestedResult === 'again') return requestedResult;
  const correct = isFlashcardAnswerCorrect(flashcard, response);
  return correct === false ? 'again' : requestedResult;
}
