import { describe, expect, it } from 'vitest';
import { isFlashcardAnswerCorrect, resolveReviewResult } from './answerChecking.js';

describe('isFlashcardAnswerCorrect', () => {
  it('checks multiple_choice against correctChoices regardless of order', () => {
    const card = { cardType: 'multiple_choice', answer: '', correctChoices: ['B', 'C'], clozeAnswers: null };
    expect(isFlashcardAnswerCorrect(card, ['C', 'B'])).toBe(true);
    expect(isFlashcardAnswerCorrect(card, ['A'])).toBe(false);
  });

  it('checks true_false against a single correct choice', () => {
    const card = { cardType: 'true_false', answer: '', correctChoices: ['true'], clozeAnswers: null };
    expect(isFlashcardAnswerCorrect(card, 'true')).toBe(true);
    expect(isFlashcardAnswerCorrect(card, 'false')).toBe(false);
  });

  it('checks cloze answers positionally, case/whitespace-insensitive', () => {
    const card = { cardType: 'cloze', answer: '', correctChoices: null, clozeAnswers: ['Paris', 'France'] };
    expect(isFlashcardAnswerCorrect(card, [' paris ', 'FRANCE'])).toBe(true);
    expect(isFlashcardAnswerCorrect(card, ['Paris'])).toBe(false); // wrong length
    expect(isFlashcardAnswerCorrect(card, ['London', 'France'])).toBe(false);
  });

  it('checks typed_answer against the answer field, case/whitespace-insensitive', () => {
    const card = { cardType: 'typed_answer', answer: 'Photosynthesis', correctChoices: null, clozeAnswers: null };
    expect(isFlashcardAnswerCorrect(card, '  photosynthesis ')).toBe(true);
    expect(isFlashcardAnswerCorrect(card, 'respiration')).toBe(false);
  });

  it('returns null for basic cards (no auto-checkable answer)', () => {
    const card = { cardType: 'basic', answer: 'anything', correctChoices: null, clozeAnswers: null };
    expect(isFlashcardAnswerCorrect(card, 'anything')).toBeNull();
  });
});

describe('resolveReviewResult', () => {
  const typedCard = { cardType: 'typed_answer', answer: 'Paris', correctChoices: null, clozeAnswers: null };

  it('leaves the result alone when no response was submitted', () => {
    expect(resolveReviewResult('good', undefined, typedCard)).toBe('good');
  });

  it('leaves the result alone when the answer is correct', () => {
    expect(resolveReviewResult('easy', 'paris', typedCard)).toBe('easy');
  });

  it('force-downgrades good/easy/hard to again when the answer is wrong', () => {
    expect(resolveReviewResult('good', 'london', typedCard)).toBe('again');
    expect(resolveReviewResult('easy', 'london', typedCard)).toBe('again');
    expect(resolveReviewResult('hard', 'london', typedCard)).toBe('again');
  });

  it('leaves "again" as "again" regardless of the answer', () => {
    expect(resolveReviewResult('again', 'paris', typedCard)).toBe('again');
  });

  it('does not downgrade for card types with no auto-checkable answer', () => {
    const basicCard = { cardType: 'basic', answer: 'anything', correctChoices: null, clozeAnswers: null };
    expect(resolveReviewResult('good', 'whatever the child typed', basicCard)).toBe('good');
  });

  it('does not downgrade when there is no flashcard at all (topic-based review)', () => {
    expect(resolveReviewResult('good', 'some response', null)).toBe('good');
  });
});
