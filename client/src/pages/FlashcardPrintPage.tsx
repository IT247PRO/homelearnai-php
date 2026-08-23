import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Flashcard {
  id: number;
  question: string;
  answer: string;
}

/** A print-friendly view — no server PDF generation, just a page styled for @media print
 * so the browser's own "Print" / "Save as PDF" handles output. */
export default function FlashcardPrintPage() {
  const { topicId } = useParams<{ topicId: string }>();

  const cardsQuery = useQuery({
    queryKey: ['topics', topicId, 'flashcards', 'print'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Flashcard[] }>(`/topics/${topicId}/flashcards`);
      return data.data;
    },
  });

  return (
    <div className="mx-auto max-w-3xl p-8 print:p-0">
      <style>{`
        @media print {
          .no-print { display: none; }
          .print-card { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Print Flashcards</h1>
        <button onClick={() => window.print()} className="rounded bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
          Print / Save as PDF
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 print:grid-cols-2">
        {cardsQuery.data?.map((card) => (
          <div key={card.id} className="print-card rounded border border-slate-300 p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Question</p>
            <p className="mb-4 font-medium text-slate-900">{card.question}</p>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Answer</p>
            <p className="text-slate-700">{card.answer}</p>
          </div>
        ))}
      </div>
      {cardsQuery.data?.length === 0 && <p className="text-slate-500">No flashcards to print.</p>}
    </div>
  );
}
