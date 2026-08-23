import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../components/AppLayout';
import { FlashcardReviewCard, type ReviewFlashcard, type ReviewResult } from '../components/FlashcardReviewCard';
import { api } from '../lib/api';

interface QueuedReview {
  id: number;
  topic: { title: string };
  flashcard: ReviewFlashcard | null;
}

interface GamificationState {
  totalPoints: number;
  currentStreakDays: number;
  longestStreakDays: number;
}

export default function ReviewPage() {
  const { childId } = useParams<{ childId: string }>();
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);

  const queueQuery = useQuery({
    queryKey: ['children', childId, 'reviews', 'queue'],
    queryFn: async () => {
      const { data } = await api.get<{ data: QueuedReview[] }>(`/children/${childId}/reviews/queue`);
      return data.data;
    },
  });

  const gamificationQuery = useQuery({
    queryKey: ['children', childId, 'gamification'],
    queryFn: async () => {
      const { data } = await api.get<{ data: { state: GamificationState | null } }>(`/children/${childId}/gamification`);
      return data.data.state;
    },
  });

  const submitResult = useMutation({
    mutationFn: async ({ reviewId, result, response }: { reviewId: number; result: ReviewResult; response?: unknown }) => {
      const { data } = await api.post(`/reviews/${reviewId}/result`, { result, response });
      return data as { data: unknown; downgraded: boolean };
    },
    onSuccess: (result) => {
      setBanner(result.downgraded ? 'That answer didn’t quite match — scored as "Again" instead.' : null);
      queryClient.invalidateQueries({ queryKey: ['children', childId, 'reviews', 'queue'] });
    },
  });

  const current = queueQuery.data?.[0];

  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Flashcard Review</h1>

      {gamificationQuery.data && (
        <div className="mb-4 flex gap-4 rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
          <span>🔥 {gamificationQuery.data.currentStreakDays} day streak</span>
          <span>⭐ {gamificationQuery.data.totalPoints} points</span>
          <span className="text-slate-400">Best streak: {gamificationQuery.data.longestStreakDays} days</span>
        </div>
      )}

      {banner && <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{banner}</p>}

      {queueQuery.isLoading && <p className="text-slate-500">Loading…</p>}

      {!queueQuery.isLoading && !current && (
        <p className="rounded border border-slate-200 bg-white p-6 text-center text-slate-500">
          Nothing due for review right now — check back later.
        </p>
      )}

      {current?.flashcard && (
        <FlashcardReviewCard
          key={current.id}
          topicTitle={current.topic.title}
          flashcard={current.flashcard}
          submitting={submitResult.isPending}
          onSubmit={(result, response) => submitResult.mutate({ reviewId: current.id, result, response })}
        />
      )}
    </AppLayout>
  );
}
