import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashcardReviewCard, type ReviewFlashcard, type ReviewResult } from '../components/FlashcardReviewCard';
import { api } from '../lib/api';

interface QueuedReview {
  id: number;
  topic: { title: string };
  flashcard: ReviewFlashcard | null;
}

export default function KidsReviewPage() {
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);

  const queueQuery = useQuery({
    queryKey: ['kids-reviews-queue'],
    queryFn: async () => {
      const { data } = await api.get<{ data: QueuedReview[] }>('/kids/reviews/queue');
      return data.data;
    },
  });

  const submitResult = useMutation({
    mutationFn: async ({ reviewId, result, response }: { reviewId: number; result: ReviewResult; response?: unknown }) => {
      const { data } = await api.post(`/kids/reviews/${reviewId}/result`, { result, response });
      return data as { data: unknown; downgraded: boolean };
    },
    onSuccess: (result) => {
      setBanner(result.downgraded ? 'That answer didn’t quite match — this one was marked "Again". Try again next time!' : null);
      queryClient.invalidateQueries({ queryKey: ['kids-reviews-queue'] });
    },
  });

  const current = queueQuery.data?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white px-4 py-8">
      <div className="mx-auto max-w-xl">
        <Link to="/kids" className="mb-4 inline-block text-sm text-slate-500 hover:underline">
          ← Back home
        </Link>

        {banner && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">{banner}</p>}

        {queueQuery.isLoading && <p className="text-slate-500">Loading…</p>}

        {!queueQuery.isLoading && !current && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-2xl">🎉</p>
            <p className="mt-2 text-lg text-slate-700">All caught up! Nothing to review right now.</p>
          </div>
        )}

        {current?.flashcard && (
          <FlashcardReviewCard
            key={current.id}
            kidsStyle
            topicTitle={current.topic.title}
            flashcard={current.flashcard}
            submitting={submitResult.isPending}
            onSubmit={(result, response) => submitResult.mutate({ reviewId: current.id, result, response })}
          />
        )}
      </div>
    </div>
  );
}
