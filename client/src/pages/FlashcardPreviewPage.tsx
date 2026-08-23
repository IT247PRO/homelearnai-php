import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '../components/AppLayout';
import { api } from '../lib/api';

interface Flashcard {
  id: number;
  question: string;
  answer: string;
}

/** Parent dry-run mode: browses the deck without ever touching a Review row, so it's safe
 * to click through before assigning cards to a child. */
export default function FlashcardPreviewPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const cardsQuery = useQuery({
    queryKey: ['topics', topicId, 'flashcards', 'preview'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Flashcard[] }>(`/topics/${topicId}/flashcards`, { params: { shuffle: 'true' } });
      return data.data;
    },
  });

  const cards = cardsQuery.data ?? [];
  const current = cards[index];

  function next() {
    setRevealed(false);
    setIndex((i) => (i + 1) % cards.length);
  }

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Flashcard Preview</h1>
        <button onClick={() => navigate(-1)} className="text-sm text-slate-500 hover:underline">
          ← Back
        </button>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Dry-run mode — browsing here never creates or changes a review record.
      </p>

      {cardsQuery.isLoading && <p className="text-slate-500">Loading…</p>}
      {!cardsQuery.isLoading && cards.length === 0 && (
        <p className="rounded border border-slate-200 bg-white p-6 text-center text-slate-500">No flashcards in this topic yet.</p>
      )}

      {current && (
        <div className="rounded border border-slate-200 bg-white p-6">
          <p className="mb-4 text-xs text-slate-400">
            Card {index + 1} of {cards.length}
          </p>
          <p className="mb-4 text-lg font-medium text-slate-900">{current.question}</p>
          {revealed ? (
            <p className="mb-4 rounded bg-slate-50 p-3 text-slate-800">{current.answer}</p>
          ) : (
            <button onClick={() => setRevealed(true)} className="mb-4 rounded bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
              Show answer
            </button>
          )}
          <button onClick={next} className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-50">
            Next card
          </button>
        </div>
      )}
    </AppLayout>
  );
}
