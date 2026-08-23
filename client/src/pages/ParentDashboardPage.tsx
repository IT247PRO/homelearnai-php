import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Users,
  Sparkles,
  Kanban,
  Calendar,
  Brain,
  Flame,
  Award,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  Play,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';


interface ChildSummary {
  child: { id: number; name: string; grade: string | null };
  todaySessionCount: number;
  pendingCatchUps: number;
  currentStreakDays: number;
  totalPoints: number;
  unacknowledgedInsightCount: number;
  pendingRecommendationCount: number;
}

export default function ParentDashboardPage() {
  const { user } = useAuth();
  const [verificationSent, setVerificationSent] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get<{ data: { children: ChildSummary[] } }>('/dashboard');
      return data.data;
    },
  });

  const resendVerification = useMutation({
    mutationFn: async () => {
      await api.post('/auth/verify-email/request');
    },
    onSuccess: () => setVerificationSent(true),
  });

  const children = dashboardQuery.data?.children ?? [];

  const totalSessionsToday = children.reduce((acc, c) => acc + c.todaySessionCount, 0);
  const totalPointsAll = children.reduce((acc, c) => acc + c.totalPoints, 0);
  const maxStreak = children.reduce((acc, c) => Math.max(acc, c.currentStreakDays), 0);
  const totalCatchUps = children.reduce((acc, c) => acc + c.pendingCatchUps, 0);
  const totalInsights = children.reduce(
    (acc, c) => acc + c.unacknowledgedInsightCount + c.pendingRecommendationCount,
    0
  );

  return (
    <AppLayout>
      {/* Email Verification Alert Banner */}
      {user && !user.emailVerified && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 p-4 shadow-soft-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-soft-xs">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">Email Verification Required</p>
              <p className="text-xs text-amber-700">
                {verificationSent
                  ? 'Verification email sent! Check your inbox or server logs.'
                  : 'Please verify your email address to ensure full account access.'}
              </p>
            </div>
          </div>
          {!verificationSent && (
            <button
              onClick={() => resendVerification.mutate()}
              disabled={resendVerification.isPending}
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-soft-xs hover:bg-amber-700 disabled:opacity-50"
            >
              {resendVerification.isPending ? 'Sending…' : 'Resend Verification'}
            </button>
          )}
        </div>
      )}

      {/* Top Welcome & Soft UI Metrics Grid */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Today's Sessions */}
        <div className="relative flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-xl transition-all hover:translate-y-[-2px]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Today's Sessions
              </p>
              <h3 className="mt-1 text-2xl font-bold text-slate-800">
                {dashboardQuery.isLoading ? '—' : totalSessionsToday}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-md">
              <Clock className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            <span className="font-semibold text-emerald-600">Active today</span> across all children
          </p>
        </div>

        {/* Metric 2: Total Family Points */}
        <div className="relative flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-xl transition-all hover:translate-y-[-2px]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Reward Points
              </p>
              <h3 className="mt-1 text-2xl font-bold text-slate-800">
                {dashboardQuery.isLoading ? '—' : totalPointsAll.toLocaleString()}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tl from-blue-600 to-cyan-400 text-white shadow-soft-md">
              <Award className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            <span className="font-semibold text-blue-600">Gamified progress</span> & achievements
          </p>
        </div>

        {/* Metric 3: Active Streak */}
        <div className="relative flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-xl transition-all hover:translate-y-[-2px]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Top Streak
              </p>
              <h3 className="mt-1 text-2xl font-bold text-slate-800">
                {dashboardQuery.isLoading ? '—' : `${maxStreak} Days`}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tl from-orange-500 to-amber-400 text-white shadow-soft-md">
              <Flame className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            <span className="font-semibold text-orange-600">Daily consistency</span> habit tracker
          </p>
        </div>

        {/* Metric 4: Catch-Ups & AI Insights */}
        <div className="relative flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-xl transition-all hover:translate-y-[-2px]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Action Items
              </p>
              <h3 className="mt-1 text-2xl font-bold text-slate-800">
                {dashboardQuery.isLoading ? '—' : totalCatchUps + totalInsights}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tl from-emerald-500 to-teal-400 text-white shadow-soft-md">
              <Sparkles className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {totalCatchUps} catch-up(s), {totalInsights} AI insights
          </p>
        </div>
      </div>

      {/* Main Content Layout: Learners Hub + Side Quick Deck */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Children Learning Hub */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Learners Hub</h2>
                <p className="text-xs text-slate-400">
                  Individual curriculum pacing, mastery overview, and quick tools
                </p>
              </div>
              <Link
                to="/children"
                className="flex items-center gap-1 rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Manage Learners</span>
              </Link>
            </div>

            {dashboardQuery.isLoading && (
              <div className="py-12 text-center text-sm text-slate-400">Loading learners…</div>
            )}

            {!dashboardQuery.isLoading && children.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-600">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No learners registered yet</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  Add your child to start generating AI study plans, pacing curricula, and enabling Kids Mode.
                </p>
                <Link
                  to="/children"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-4 py-2 text-xs font-bold text-white shadow-soft-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add First Child</span>
                </Link>
              </div>
            )}

            <div className="space-y-4">
              {children.map((summary) => (
                <div
                  key={summary.child.id}
                  className="group rounded-2xl border border-slate-100 bg-slate-50/40 p-5 shadow-soft-xs transition-all hover:bg-white hover:shadow-soft-md"
                >
                  {/* Child Card Header */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 text-base font-bold text-white shadow-soft-sm">
                        {summary.child.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/children/${summary.child.id}`}
                            className="font-bold text-slate-800 hover:text-purple-600 transition-colors"
                          >
                            {summary.child.name}
                          </Link>
                          {summary.child.grade && (
                            <span className="rounded-md bg-purple-100/80 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                              Grade {summary.child.grade}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          🔥 {summary.currentStreakDays} day streak · {summary.totalPoints} points
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/children/${summary.child.id}`}
                      className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-700"
                    >
                      <span>Open Curriculum Hub</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>

                  {/* AI Insight Badge if pending */}
                  {(summary.unacknowledgedInsightCount > 0 || summary.pendingRecommendationCount > 0) && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-purple-100/60 px-3 py-2 text-xs font-medium text-purple-800">
                      <Sparkles className="h-4 w-4 text-purple-600 shrink-0" />
                      <span>
                        {summary.unacknowledgedInsightCount + summary.pendingRecommendationCount} new AI recommendations / pedagogical insights ready for review.
                      </span>
                    </div>
                  )}

                  {/* Quick stats row */}
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl bg-white p-2.5 shadow-soft-xs">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase">Today's Sessions</span>
                      <span className="text-sm font-bold text-slate-800">{summary.todaySessionCount}</span>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 shadow-soft-xs">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase">Catch-Up Backlog</span>
                      <span className={`text-sm font-bold ${summary.pendingCatchUps > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {summary.pendingCatchUps}
                      </span>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 shadow-soft-xs">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase">Streak</span>
                      <span className="text-sm font-bold text-slate-800">{summary.currentStreakDays}d</span>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 shadow-soft-xs">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase">Total Score</span>
                      <span className="text-sm font-bold text-purple-600">{summary.totalPoints} pts</span>
                    </div>
                  </div>

                  {/* Direct Flow Navigation Buttons */}
                  <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    <Link
                      to={`/children/${summary.child.id}/planning`}
                      className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-soft-xs hover:bg-slate-50 transition-colors"
                    >
                      <Kanban className="h-3.5 w-3.5 text-blue-500" />
                      <span>Planning Board</span>
                    </Link>
                    <Link
                      to={`/children/${summary.child.id}/calendar`}
                      className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-soft-xs hover:bg-slate-50 transition-colors"
                    >
                      <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Schedule</span>
                    </Link>
                    <Link
                      to={`/children/${summary.child.id}/review`}
                      className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-soft-xs hover:bg-slate-50 transition-colors"
                    >
                      <Brain className="h-3.5 w-3.5 text-purple-500" />
                      <span>Review Flashcards</span>
                    </Link>
                    <Link
                      to={`/children/${summary.child.id}/ai`}
                      className="flex items-center gap-1.5 rounded-xl bg-purple-50 border border-purple-200/60 px-3 py-1.5 text-xs font-semibold text-purple-700 shadow-soft-xs hover:bg-purple-100 transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                      <span>AI Generator</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Actions Deck & Soft UI Cards */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft-xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-2.5">
              <Link
                to="/curricula/new"
                className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-700 transition-all hover:bg-purple-50 hover:text-purple-800"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold">Import New Curriculum</p>
                    <p className="text-[10px] text-slate-400 font-normal">AI course decomposition</p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>

              <Link
                to="/tasks"
                className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-700 transition-all hover:bg-blue-50 hover:text-blue-800"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold">Manage Tasks & To-Dos</p>
                    <p className="text-[10px] text-slate-400 font-normal">Track homeschool chores & items</p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>

              <Link
                to="/kids-mode/settings"
                className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-700 transition-all hover:bg-amber-50 hover:text-amber-800"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Play className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold">Kids Mode PIN & Lock</p>
                    <p className="text-[10px] text-slate-400 font-normal">Configure parental protection</p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </div>
          </div>

          {/* AI Homeschool Assistant Highlight Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 p-6 text-white shadow-soft-xl">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                  <Sparkles className="h-4 w-4 text-white" />
                </span>
                <span className="text-xs font-bold tracking-wider uppercase text-purple-100">
                  AI Curriculum Co-Pilot
                </span>
              </div>
              <h3 className="text-lg font-bold">Intelligent Study Planning</h3>
              <p className="mt-2 text-xs text-purple-100 leading-relaxed">
                Generate complete unit plans, spaced flashcards, and interactive quiz modules tailored to your child's learning pace.
              </p>
              <Link
                to="/curricula"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-900 shadow-soft-md transition-all hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Browse Curricula</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
