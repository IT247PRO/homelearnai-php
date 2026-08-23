import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface InteractiveSectionData {
  id: number;
  interactionType: string;
  choices: string[] | null;
  attemptCount: number;
  isCorrect: boolean | null;
  hint?: string;
  revealAnswer?: boolean;
  correctAnswer?: string | string[];
}

interface RespondResult {
  isCorrect: boolean;
  hint?: string;
  revealAnswer?: boolean;
  correctAnswer?: string | string[];
  canAdvance: boolean;
}

/**
 * The Interaction Engine (Plan3 §58) — renders the answer UI for one interactive lesson
 * section and reports back whether the Lesson Player may advance past it. Scoped to the
 * four deterministically-checkable types the server can grade (services/answerChecking.ts):
 * multiple choice, true/false, short answer, fill in the blank.
 */
export function InteractionRenderer({
  lessonId,
  section,
  onOutcome,
}: {
  lessonId: number;
  section: InteractiveSectionData;
  onOutcome: (canAdvance: boolean) => void;
}) {
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<RespondResult | null>(
    section.isCorrect !== null
      ? { isCorrect: section.isCorrect, hint: section.hint, revealAnswer: section.revealAnswer, correctAnswer: section.correctAnswer, canAdvance: section.isCorrect || section.attemptCount >= 3 }
      : null
  );

  const respond = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: RespondResult }>(`/kids/lessons/${lessonId}/sections/${section.id}/respond`, { response: value });
      return data.data;
    },
    onSuccess: (result) => {
      setFeedback(result);
      onOutcome(result.canAdvance);
      if (!result.isCorrect) setValue('');
    },
  });

  const canRetry = feedback && !feedback.isCorrect && !feedback.revealAnswer;

  return (
    <div className="rounded-xl border-2 border-sky-200 bg-sky-50 p-4">
      {(section.interactionType === 'multiple_choice' || section.interactionType === 'true_false') && section.choices ? (
        <div className="flex flex-col gap-2">
          {section.choices.map((choice) => (
            <label
              key={choice}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-base ${
                value === choice ? 'border-sky-500 bg-white' : 'border-slate-200 bg-white'
              }`}
            >
              <input type="radio" name={`section-${section.id}`} checked={value === choice} onChange={() => setValue(choice)} disabled={feedback?.isCorrect} />
              {choice}
            </label>
          ))}
        </div>
      ) : (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={feedback?.isCorrect}
          aria-label="Your answer"
          placeholder="Type your answer…"
          className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-base"
        />
      )}

      {!feedback?.isCorrect && (
        <button
          onClick={() => respond.mutate()}
          disabled={!value.trim() || respond.isPending}
          className="mt-3 rounded-full bg-sky-500 px-5 py-2 font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
        >
          {respond.isPending ? 'Checking…' : canRetry ? 'Try again' : 'Check my answer'}
        </button>
      )}

      {feedback && (
        <div className={`mt-3 rounded-lg p-3 text-sm ${feedback.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
          {feedback.isCorrect ? (
            <p>✓ Correct! Nice work.</p>
          ) : feedback.revealAnswer ? (
            <p>
              Not quite — the answer was <strong>{Array.isArray(feedback.correctAnswer) ? feedback.correctAnswer.join(', ') : feedback.correctAnswer}</strong>. Let's
              keep going, you'll get the next one!
            </p>
          ) : (
            <p>Not quite. {feedback.hint ?? 'Give it another try.'}</p>
          )}
        </div>
      )}
    </div>
  );
}
