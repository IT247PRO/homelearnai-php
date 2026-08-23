import { useState } from 'react';
import { RichContent } from './RichContent';

export type ReviewResult = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewFlashcard {
  cardType: string;
  question: string;
  answer: string;
  choices?: string[] | null;
  clozeText?: string | null;
  questionImageUrl?: string | null;
  occlusionData?: Array<{ id: string; xPct: number; yPct: number; wPct: number; hPct: number }> | null;
}

interface Props {
  topicTitle: string;
  flashcard: ReviewFlashcard;
  onSubmit: (result: ReviewResult, response?: unknown) => void;
  submitting: boolean;
  /** Swap in the kid-friendly rating labels/colors when true. */
  kidsStyle?: boolean;
}

const RATING_BUTTONS: Array<{ result: ReviewResult; label: string; kidsLabel: string; kidsClass: string }> = [
  { result: 'again', label: 'Again', kidsLabel: '😵 Again', kidsClass: 'bg-red-100 text-red-700' },
  { result: 'hard', label: 'Hard', kidsLabel: '😅 Hard', kidsClass: 'bg-orange-100 text-orange-700' },
  { result: 'good', label: 'Good', kidsLabel: '🙂 Good', kidsClass: 'bg-emerald-100 text-emerald-700' },
  { result: 'easy', label: 'Easy', kidsLabel: '😎 Easy', kidsClass: 'bg-blue-100 text-blue-700' },
];

/** Whether this card type has a submittable, auto-checkable answer (matches the server's
 * isFlashcardAnswerCorrect — basic/image_occlusion have none). */
function isCheckable(cardType: string): boolean {
  return cardType === 'typed_answer' || cardType === 'multiple_choice' || cardType === 'true_false' || cardType === 'cloze';
}

export function FlashcardReviewCard({ topicTitle, flashcard, onSubmit, submitting, kidsStyle }: Props) {
  const [typedAnswer, setTypedAnswer] = useState('');
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [clozeAnswer, setClozeAnswer] = useState('');
  const [answered, setAnswered] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const checkable = isCheckable(flashcard.cardType);

  function currentResponse(): unknown {
    if (flashcard.cardType === 'typed_answer') return typedAnswer;
    if (flashcard.cardType === 'multiple_choice') return selectedChoices;
    if (flashcard.cardType === 'true_false') return selectedChoices[0];
    if (flashcard.cardType === 'cloze') return clozeAnswer.split(',').map((s) => s.trim());
    return undefined;
  }

  function reset() {
    setTypedAnswer('');
    setSelectedChoices([]);
    setClozeAnswer('');
    setAnswered(false);
    setRevealed(false);
  }

  function handleSubmitAnswer(e: React.FormEvent) {
    e.preventDefault();
    setAnswered(true);
    setRevealed(true);
  }

  function handleRate(result: ReviewResult) {
    onSubmit(result, checkable ? currentResponse() : undefined);
    reset();
  }

  const buttonBase = kidsStyle
    ? 'rounded-lg py-3 text-lg font-semibold disabled:opacity-50'
    : 'flex-1 rounded border border-slate-300 px-3 py-2 capitalize hover:bg-slate-50 disabled:opacity-50';

  return (
    <div className={kidsStyle ? 'rounded-lg border border-slate-200 bg-white p-8 shadow' : 'rounded border border-slate-200 bg-white p-6'}>
      <p className={kidsStyle ? 'mb-2 text-xs uppercase tracking-wide text-slate-400' : 'mb-1 text-xs uppercase tracking-wide text-slate-400'}>
        {topicTitle}
      </p>
      <RichContent
        content={flashcard.question}
        className={kidsStyle ? 'mb-6 text-2xl font-medium text-slate-900 [&>p]:m-0' : 'mb-4 text-lg font-medium text-slate-900 [&>p]:m-0'}
      />

      {flashcard.cardType === 'image_occlusion' && flashcard.questionImageUrl && (
        <div className="relative mb-4 inline-block max-w-full">
          <img src={flashcard.questionImageUrl} alt="" className="block max-w-full rounded border border-slate-200" />
          {!revealed &&
            flashcard.occlusionData?.map((box) => (
              <div
                key={box.id}
                style={{ left: `${box.xPct}%`, top: `${box.yPct}%`, width: `${box.wPct}%`, height: `${box.hPct}%` }}
                className="absolute bg-slate-900"
              />
            ))}
        </div>
      )}

      {checkable && !answered && flashcard.cardType === 'typed_answer' && (
        <form onSubmit={handleSubmitAnswer} className="space-y-3">
          <input
            autoFocus
            required
            value={typedAnswer}
            onChange={(e) => setTypedAnswer(e.target.value)}
            aria-label="Your answer"
            placeholder="Type your answer…"
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          <button type="submit" className="rounded bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
            Submit answer
          </button>
        </form>
      )}

      {checkable && !answered && (flashcard.cardType === 'multiple_choice' || flashcard.cardType === 'true_false') && (
        <form onSubmit={handleSubmitAnswer} className="space-y-3">
          <div className="flex flex-col gap-2">
            {(flashcard.choices ?? []).map((choice) => {
              const isSelected = selectedChoices.includes(choice);
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() =>
                    setSelectedChoices(
                      flashcard.cardType === 'true_false'
                        ? [choice]
                        : isSelected
                          ? selectedChoices.filter((c) => c !== choice)
                          : [...selectedChoices, choice]
                    )
                  }
                  className={`rounded border px-3 py-2 text-left ${isSelected ? 'border-brand-600 bg-brand-50' : 'border-slate-300'}`}
                >
                  {choice}
                </button>
              );
            })}
          </div>
          <button
            type="submit"
            disabled={selectedChoices.length === 0}
            className="rounded bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Submit answer
          </button>
        </form>
      )}

      {checkable && !answered && flashcard.cardType === 'cloze' && (
        <form onSubmit={handleSubmitAnswer} className="space-y-3">
          {flashcard.clozeText && <RichContent content={flashcard.clozeText} className="rounded bg-slate-50 p-3 text-slate-700" />}
          <input
            autoFocus
            required
            value={clozeAnswer}
            onChange={(e) => setClozeAnswer(e.target.value)}
            aria-label="Fill in the blanks, separated by commas"
            placeholder="Fill in the blanks, separated by commas"
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          <button type="submit" className="rounded bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
            Submit answer
          </button>
        </form>
      )}

      {(!checkable || answered) && !revealed && (
        <button onClick={() => setRevealed(true)} className="rounded bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
          Show answer
        </button>
      )}

      {revealed && (
        <>
          <RichContent
            content={flashcard.answer}
            className={kidsStyle ? 'mb-6 rounded-lg bg-slate-50 p-4 text-xl text-slate-800 [&>p]:m-0' : 'mb-4 rounded bg-slate-50 p-3 text-slate-800 [&>p]:m-0'}
          />
          <div className={kidsStyle ? 'grid grid-cols-2 gap-2' : 'flex gap-2'}>
            {RATING_BUTTONS.map(({ result, label, kidsLabel, kidsClass }) => (
              <button
                key={result}
                disabled={submitting}
                onClick={() => handleRate(result)}
                className={kidsStyle ? `${buttonBase} ${kidsClass}` : buttonBase}
              >
                {kidsStyle ? kidsLabel : label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
