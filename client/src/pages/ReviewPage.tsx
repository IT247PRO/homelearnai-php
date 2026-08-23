import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../components/AppLayout';
import { ChildNavHeader } from '../components/ChildNavHeader';
import { FlashcardReviewCard, type ReviewFlashcard, type ReviewResult } from '../components/FlashcardReviewCard';
import { Flame, Award, Sparkles } from 'lucide-react';
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
  const id = Number(childId);
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
      <ChildNavHeader childId={id} activeTab="review" />

      {gamificationQuery.data && (
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-xl">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <Flame className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-slate-800">{gamificationQuery.data.currentStreakDays} Day Streak</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
              <Award className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-slate-800">{gamificationQuery.data.totalPoints} Total Points</span>
          </div>
          <span className="text-xs text-slate-400">
            Personal Best: {gamificationQuery.data.longestStreakDays} days
          </span>
        </div>
      )}

      {banner && <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">{banner}</p>}

      {queueQuery.isLoading && <p className="text-xs text-slate-400">Loading flashcards…</p>}

      {!queueQuery.isLoading && !current && (
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-soft-xl">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">All caught up!</h3>
          <p className="mt-1 text-xs text-slate-500">
            No flashcards due for spaced repetition right now. Check back during scheduled review slots.
          </p>
        </div>
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

