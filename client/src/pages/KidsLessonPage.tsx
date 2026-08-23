import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Sparkles, Star, Flame, BookOpen } from 'lucide-react';
import { api } from '../lib/api';
import { LessonPlayer } from '../components/LessonPlayer';

interface LessonSummary {
  title: string;
  completedAt: string | null;
  isLastLessonInTopic: boolean;
  topicAssessment: { id: number; title: string } | null;
}

interface GamificationState {
  totalPoints: number;
  level: number;
  currentStreakDays: number;
}

export default function KidsLessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const id = Number(lessonId);
  const navigate = useNavigate();
  const [justCompleted, setJustCompleted] = useState(false);

  const lessonQuery = useQuery({
    queryKey: ['kids-lesson', id],
    queryFn: async () => {
      const { data } = await api.get<{ data: LessonSummary }>(`/kids/lessons/${id}`);
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

  const completed = justCompleted || Boolean(lessonQuery.data?.completedAt);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-soft-xs">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
          <Link
            to="/kids"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Storybook</span>
          </Link>

          <div className="text-center truncate">
            <h1 className="text-sm font-black text-slate-900 flex items-center justify-center gap-1.5 truncate">
              <Sparkles className="h-4 w-4 text-purple-600 shrink-0" />
              <span className="truncate">{lessonQuery.data?.title ?? 'Lesson Exploration'}</span>
            </h1>
            <p className="text-[11px] font-semibold text-slate-500">
              Interactive Lesson Chapter
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1.5 border border-purple-200/60 shadow-soft-xs">
              <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
              <span className="text-xs font-black text-purple-900">+20 XP</span>
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

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">
        {completed ? (
          <div className="mx-auto max-w-md my-8 rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 text-center shadow-soft-lg animate-in fade-in zoom-in-95">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-4xl shadow-soft-md ring-8 ring-emerald-50">
              🎉
            </div>

            <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-800 mb-2">
              Lesson Mastered!
            </span>
            <h2 className="text-2xl font-black text-slate-900 mb-1">Awesome Job!</h2>
            <p className="text-xs font-semibold text-slate-600 max-w-sm mx-auto mb-6">
              You completed <span className="text-slate-900 font-bold">{lessonQuery.data?.title}</span>. You've earned bonus XP for your learning streak!
            </p>

            <div className="space-y-3">
              {lessonQuery.data?.isLastLessonInTopic && lessonQuery.data.topicAssessment ? (
                <button
                  onClick={() => navigate(`/kids/assessments/${lessonQuery.data!.topicAssessment!.id}`)}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 px-6 py-3.5 text-xs font-black text-white shadow-soft-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Take the Topic Quiz 📝</span>
                </button>
              ) : (
                <Link
                  to="/kids"
                  className="flex items-center justify-center gap-2 w-full rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 px-6 py-3.5 text-xs font-black text-white shadow-soft-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Continue Next Chapter</span>
                </Link>
              )}

              <Link
                to="/kids"
                className="flex items-center justify-center gap-2 w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
              >
                <span>Back to Storybook Overview</span>
              </Link>
            </div>
          </div>
        ) : (
          <LessonPlayer lessonId={id} onCompleted={() => setJustCompleted(true)} />
        )}
      </main>
    </div>
  );
}

