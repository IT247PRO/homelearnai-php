import { useState } from 'react';
import { Volume2, VolumeX, Sparkles, Eye, ArrowRight, CheckCircle2 } from 'lucide-react';
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

const RATING_BUTTONS: Array<{ result: ReviewResult; label: string; kidsLabel: string; kidsClass: string; desc: string }> = [
  { result: 'again', label: 'Again', kidsLabel: '😵 Again', kidsClass: 'bg-rose-100 hover:bg-rose-200 text-rose-800 border-rose-300', desc: 'Need more practice' },
  { result: 'hard', label: 'Hard', kidsLabel: '😅 Hard', kidsClass: 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300', desc: 'Got it, but tricky' },
  { result: 'good', label: 'Good', kidsLabel: '🙂 Good', kidsClass: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300', desc: 'Remembered well' },
  { result: 'easy', label: 'Easy', kidsLabel: '😎 Easy', kidsClass: 'bg-sky-100 hover:bg-sky-200 text-sky-900 border-sky-300', desc: 'Super easy!' },
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
  const [isSpeaking, setIsSpeaking] = useState(false);

  const checkable = isCheckable(flashcard.cardType);

  const handleSpeak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

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
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
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

  if (kidsStyle) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-soft-lg transition-all">
        {/* Card Header */}
        <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-purple-700">{topicTitle}</span>
          </div>

          <button
            type="button"
            onClick={() => handleSpeak(flashcard.question)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
              isSpeaking
                ? 'border-purple-300 bg-purple-100 text-purple-800 animate-pulse'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="Read question out loud"
          >
            {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            <span>{isSpeaking ? 'Stop' : 'Read'}</span>
          </button>
        </div>

        {/* Question Prompt */}
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Question</p>
          <RichContent content={flashcard.question} className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug [&>p]:m-0" />
        </div>

        {/* Image Occlusion */}
        {flashcard.cardType === 'image_occlusion' && flashcard.questionImageUrl && (
          <div className="relative mb-6 overflow-hidden rounded-2xl border border-slate-200 shadow-soft-xs inline-block max-w-full">
            <img src={flashcard.questionImageUrl} alt="Flashcard visual" className="block max-w-full rounded-2xl" />
            {!revealed &&
              flashcard.occlusionData?.map((box) => (
                <div
                  key={box.id}
                  style={{ left: `${box.xPct}%`, top: `${box.yPct}%`, width: `${box.wPct}%`, height: `${box.hPct}%` }}
                  className="absolute bg-slate-900/90 backdrop-blur rounded-md border border-slate-700"
                />
              ))}
          </div>
        )}

        {/* Typed Answer Form */}
        {checkable && !answered && flashcard.cardType === 'typed_answer' && (
          <form onSubmit={handleSubmitAnswer} className="space-y-4">
            <input
              autoFocus
              required
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              aria-label="Your answer"
              placeholder="Type your answer here…"
              className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 focus:border-purple-600 focus:outline-none shadow-soft-xs"
            />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 py-3.5 text-sm font-black text-white shadow-soft-md hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              <span>Check My Answer</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* Multiple Choice / True False Form */}
        {checkable && !answered && (flashcard.cardType === 'multiple_choice' || flashcard.cardType === 'true_false') && (
          <form onSubmit={handleSubmitAnswer} className="space-y-4">
            <div className="flex flex-col gap-2.5">
              {(flashcard.choices ?? []).map((choice, i) => {
                const isSelected = selectedChoices.includes(choice);
                const letter = String.fromCharCode(65 + i);
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
                    className={`flex items-center gap-3.5 rounded-2xl border-2 p-4 text-left font-semibold transition-all ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/80 text-purple-950 shadow-soft-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-black transition-colors ${
                        isSelected ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {letter}
                    </span>
                    <span className="text-sm">{choice}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="submit"
              disabled={selectedChoices.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 py-3.5 text-sm font-black text-white shadow-soft-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none transition-all"
            >
              <span>Check My Answer</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* Cloze / Fill in the Blanks Form */}
        {checkable && !answered && flashcard.cardType === 'cloze' && (
          <form onSubmit={handleSubmitAnswer} className="space-y-4">
            {flashcard.clozeText && (
              <RichContent content={flashcard.clozeText} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 border border-slate-200" />
            )}
            <input
              autoFocus
              required
              value={clozeAnswer}
              onChange={(e) => setClozeAnswer(e.target.value)}
              aria-label="Fill in the blanks, separated by commas"
              placeholder="Type missing words separated by commas…"
              className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 focus:border-purple-600 focus:outline-none shadow-soft-xs"
            />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 py-3.5 text-sm font-black text-white shadow-soft-md hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              <span>Check My Answer</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* Show Answer Trigger for Non-Checkable Cards */}
        {(!checkable || answered) && !revealed && (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-sm font-black text-white shadow-soft-md hover:bg-slate-800 active:scale-[0.99] transition-all"
          >
            <Eye className="h-4 w-4" />
            <span>Show Answer 💡</span>
          </button>
        )}

        {/* Revealed Answer & Self-Rating Grid */}
        {revealed && (
          <div className="mt-6 pt-6 border-t border-slate-100 space-y-6 animate-in fade-in">
            <div className="rounded-2xl border border-purple-200/80 bg-purple-50/60 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-purple-600" />
                  Correct Answer
                </span>
                <button
                  type="button"
                  onClick={() => handleSpeak(flashcard.answer)}
                  className="text-purple-700 hover:text-purple-900 text-xs font-bold flex items-center gap-1"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>Listen</span>
                </button>
              </div>
              <RichContent content={flashcard.answer} className="text-base sm:text-lg font-bold text-slate-900 leading-snug [&>p]:m-0" />
            </div>

            <div>
              <p className="text-xs font-bold text-slate-700 text-center mb-3">How well did you know this?</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {RATING_BUTTONS.map(({ result, kidsLabel, kidsClass, desc }) => (
                  <button
                    key={result}
                    disabled={submitting}
                    onClick={() => handleRate(result)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 font-bold transition-all shadow-soft-xs hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 ${kidsClass}`}
                  >
                    <span className="text-sm font-black mb-0.5">{kidsLabel}</span>
                    <span className="text-[10px] font-medium opacity-80">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Standard non-kids fallback
  const buttonBase = 'flex-1 rounded border border-slate-300 px-3 py-2 capitalize hover:bg-slate-50 disabled:opacity-50';

  return (
    <div className="rounded border border-slate-200 bg-white p-6">
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">{topicTitle}</p>
      <RichContent content={flashcard.question} className="mb-4 text-lg font-medium text-slate-900 [&>p]:m-0" />

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
          <RichContent content={flashcard.answer} className="mb-4 rounded bg-slate-50 p-3 text-slate-800 [&>p]:m-0" />
          <div className="flex gap-2">
            {RATING_BUTTONS.map(({ result, label }) => (
              <button
                key={result}
                disabled={submitting}
                onClick={() => handleRate(result)}
                className={buttonBase}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

