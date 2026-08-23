import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Sparkles, Star, Flame, BookOpen } from 'lucide-react';
import { FlashcardReviewCard, type ReviewFlashcard, type ReviewResult } from '../components/FlashcardReviewCard';
import { api } from '../lib/api';

interface QueuedReview {
  id: number;
  topic: { title: string };
  flashcard: ReviewFlashcard | null;
}

interface GamificationState {
  totalPoints: number;
  level: number;
  currentStreakDays: number;
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

  const gamificationQuery = useQuery({
    queryKey: ['kids-gamification'],
    queryFn: async () => {
      const { data } = await api.get<{ data: { state: GamificationState } }>('/kids/gamification');
      return data.data.state;
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
      queryClient.invalidateQueries({ queryKey: ['kids-gamification'] });
      queryClient.invalidateQueries({ queryKey: ['kids-overview'] });
    },
  });

  const queue = queueQuery.data ?? [];
  const current = queue[0];
  const queueCount = queue.length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-soft-xs">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between gap-4">
          <Link
            to="/kids"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Storybook</span>
          </Link>

          <div className="text-center">
            <h1 className="text-sm font-black text-slate-900 flex items-center justify-center gap-1.5">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span>Memory Flashcards</span>
            </h1>
            <p className="text-[11px] font-semibold text-slate-500">
              {queueCount > 0 ? `${queueCount} card${queueCount !== 1 ? 's' : ''} in your queue` : 'All caught up!'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1.5 border border-purple-200/60 shadow-soft-xs">
              <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
              <span className="text-xs font-black text-purple-900">+5 XP</span>
            </div>

            {gamificationQuery.data?.currentStreakDays !== undefined && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 border border-orange-200/60">
                <Flame className="h-4 w-4 text-orange-500 fill-orange-400" />
                <span className="text-xs font-black text-orange-900">{gamificationQuery.data.currentStreakDays}d</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Review Stage */}
      <main className="flex-1 mx-auto w-full max-w-xl px-4 py-8 flex flex-col justify-center">
        {banner && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800 shadow-soft-xs animate-in fade-in">
            {banner}
          </div>
        )}

        {queueQuery.isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
            <p className="text-sm font-bold text-slate-600">Loading memory flashcards…</p>
          </div>
        )}

        {!queueQuery.isLoading && !current && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-12 text-center shadow-soft-md animate-in fade-in zoom-in-95">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-4xl shadow-soft-md ring-8 ring-emerald-50">
              🎉
            </div>
            <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-800 mb-2">
              Queue Complete
            </span>
            <h2 className="text-2xl font-black text-slate-900 mb-2">You're All Caught Up!</h2>
            <p className="text-xs font-semibold text-slate-600 max-w-sm mx-auto mb-8 leading-relaxed">
              Fantastic work! You have reviewed all flashcards due for today. Keep reading your chapters to unlock more cards!
            </p>

            <Link
              to="/kids"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 px-6 py-3.5 text-xs font-black text-white shadow-soft-md hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <BookOpen className="h-4 w-4" />
              <span>Return to Storybook</span>
            </Link>
          </div>
        )}

        {current?.flashcard && (
          <div className="animate-in fade-in">
            <FlashcardReviewCard
              key={current.id}
              kidsStyle
              topicTitle={current.topic.title}
              flashcard={current.flashcard}
              submitting={submitResult.isPending}
              onSubmit={(result, response) => submitResult.mutate({ reviewId: current.id, result, response })}
            />
          </div>
        )}
      </main>
    </div>
  );
}

