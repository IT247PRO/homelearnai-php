import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
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

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <Link to="/children" className="text-sm text-brand-600 hover:underline">
          Manage children
        </Link>
      </div>

      {user && !user.emailVerified && (
        <div className="mb-4 flex items-center justify-between rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{verificationSent ? 'Verification email sent — check your inbox (or the server console).' : 'Please verify your email address.'}</span>
          {!verificationSent && (
            <button
              onClick={() => resendVerification.mutate()}
              disabled={resendVerification.isPending}
              className="rounded bg-amber-600 px-3 py-1.5 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Send verification email
            </button>
          )}
        </div>
      )}

      {dashboardQuery.isLoading && <p className="text-slate-500">Loading…</p>}

      {dashboardQuery.data?.children.length === 0 && (
        <div className="rounded border border-slate-200 bg-white p-6 text-center text-slate-500">
          No children yet.{' '}
          <Link to="/children" className="text-brand-600 hover:underline">
            Add your first child
          </Link>{' '}
          to get started.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {dashboardQuery.data?.children.map((summary) => (
          <Link
            key={summary.child.id}
            to={`/children/${summary.child.id}`}
            className="rounded border border-slate-200 bg-white p-4 hover:border-brand-500"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-slate-900">{summary.child.name}</span>
              {summary.child.grade && <span className="text-xs text-slate-500">Grade {summary.child.grade}</span>}
            </div>
            {(summary.unacknowledgedInsightCount > 0 || summary.pendingRecommendationCount > 0) && (
              <div className="mb-2 rounded bg-purple-50 px-2 py-1 text-xs text-purple-700">
                🧠 {summary.unacknowledgedInsightCount + summary.pendingRecommendationCount} new AI insight(s)/recommendation(s)
              </div>
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-slate-500">Today</dt>
                <dd className="font-medium text-slate-900">{summary.todaySessionCount} session(s)</dd>
              </div>
              <div>
                <dt className="text-slate-500">Catch-up</dt>
                <dd className="font-medium text-slate-900">{summary.pendingCatchUps} pending</dd>
              </div>
              <div>
                <dt className="text-slate-500">Streak</dt>
                <dd className="font-medium text-slate-900">🔥 {summary.currentStreakDays} day(s)</dd>
              </div>
              <div>
                <dt className="text-slate-500">Points</dt>
                <dd className="font-medium text-slate-900">{summary.totalPoints}</dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
