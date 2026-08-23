import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorBody } from '../lib/api';
import { TutorChat } from '../components/TutorChat';

interface KidsChild {
  id: number;
  name: string;
  grade: string | null;
}

interface KidsSession {
  id: number;
  status: string;
  lessonId: number | null;
  topic: { id: number; title: string; estimatedMinutes: number };
}

interface KidsModeSettings {
  hasPinSetup: boolean;
  isLocked: boolean;
  lockedUntil: string | null;
}

export default function KidsHomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [exiting, setExiting] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tutorSessionId, setTutorSessionId] = useState<number | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['kids-mode-settings'],
    queryFn: async () => {
      const { data } = await api.get<{ data: KidsModeSettings }>('/kids-mode/settings');
      return data.data;
    },
    enabled: exiting,
  });

  const meQuery = useQuery({
    queryKey: ['kids-me'],
    queryFn: async () => {
      const { data } = await api.get<{ data: KidsChild }>('/kids/me');
      return data.data;
    },
    retry: false,
  });

  const todayQuery = useQuery({
    queryKey: ['kids-today'],
    queryFn: async () => {
      const { data } = await api.get<{ data: KidsSession[] }>('/kids/today');
      return data.data;
    },
    enabled: Boolean(meQuery.data),
  });

  const completeSession = useMutation({
    mutationFn: async (sessionId: number) => {
      await api.post(`/kids/sessions/${sessionId}/complete`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kids-today'] }),
  });

  const exitMutation = useMutation({
    mutationFn: async () => {
      await api.post('/kids-mode/exit', { pin });
    },
    onSuccess: () => navigate('/dashboard'),
    onError: (err) => {
      setError(apiErrorBody(err)?.error ?? 'Wrong PIN');
      setPin('');
      queryClient.invalidateQueries({ queryKey: ['kids-mode-settings'] });
    },
  });

  if (meQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
        <div>
          <p className="mb-2 text-lg text-slate-700">Kids Mode isn't active right now.</p>
          <Link to="/dashboard" className="text-brand-600 hover:underline">
            Go to parent dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">
            Hi, {meQuery.data?.name ?? '...'}! 👋
          </h1>
          <button onClick={() => setExiting(true)} className="rounded bg-slate-200 px-3 py-2 text-sm text-slate-700">
            Exit
          </button>
        </div>

        {exiting && settingsQuery.data?.hasPinSetup === false && (
          <div className="mb-6 rounded border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="mb-3">A parent needs to set up a PIN first before Kids Mode can be exited this way.</p>
            <button onClick={() => setExiting(false)} className="rounded bg-slate-100 px-4 py-2">
              Back
            </button>
          </div>
        )}

        {exiting && settingsQuery.data?.isLocked && (
          <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="mb-3">
              Too many incorrect attempts.
              {settingsQuery.data.lockedUntil && ` Try again after ${new Date(settingsQuery.data.lockedUntil).toLocaleTimeString()}.`}
            </p>
            <button onClick={() => setExiting(false)} className="rounded bg-slate-100 px-4 py-2 text-slate-700">
              Back
            </button>
          </div>
        )}

        {exiting && settingsQuery.data?.hasPinSetup && !settingsQuery.data.isLocked && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              exitMutation.mutate();
            }}
            className="mb-6 space-y-3 rounded border border-slate-200 bg-white p-4"
          >
            <label className="block text-sm font-medium text-slate-700">Enter parent PIN to exit</label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-32 rounded border border-slate-300 px-3 py-2"
              autoFocus
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" className="rounded bg-brand-600 px-4 py-2 text-white">
                Confirm
              </button>
              <button type="button" onClick={() => setExiting(false)} className="rounded bg-slate-100 px-4 py-2">
                Cancel
              </button>
            </div>
          </form>
        )}

        <Link
          to="/kids/review"
          className="mb-6 block rounded-lg bg-emerald-500 p-4 text-center text-lg font-semibold text-white shadow hover:bg-emerald-600"
        >
          📚 Review Flashcards
        </Link>

        <h2 className="mb-3 text-xl font-semibold text-slate-800">Today's Work</h2>
        <div className="space-y-3">
          {todayQuery.data?.map((session) => (
            <div key={session.id} className="rounded border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{session.topic.title}</p>
                  <p className="text-sm text-slate-500">{session.topic.estimatedMinutes} minutes</p>
                </div>
                <div className="flex items-center gap-2">
                  {session.lessonId ? (
                    session.status === 'done' ? (
                      <span className="text-emerald-600">✓ Done</span>
                    ) : (
                      <Link
                        to={`/kids/lessons/${session.lessonId}`}
                        className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        {session.status === 'planned' || session.status === 'scheduled' ? 'Start Lesson' : 'Continue Lesson'} →
                      </Link>
                    )
                  ) : (
                    <>
                      <button
                        onClick={() => setTutorSessionId(tutorSessionId === session.id ? null : session.id)}
                        className="rounded bg-sky-100 px-3 py-2 text-sm text-sky-700 hover:bg-sky-200"
                      >
                        🤖 Ask
                      </button>
                      {session.status !== 'done' ? (
                        <button
                          onClick={() => completeSession.mutate(session.id)}
                          disabled={completeSession.isPending}
                          className="rounded bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700"
                        >
                          Mark Done
                        </button>
                      ) : (
                        <span className="text-emerald-600">✓ Done</span>
                      )}
                    </>
                  )}
                </div>
              </div>
              {!session.lessonId && tutorSessionId === session.id && (
                <div className="mt-3">
                  <TutorChat kidsStyle messagesUrl={`/kids/topics/${session.topic.id}/tutor/messages`} />
                </div>
              )}
            </div>
          ))}
          {todayQuery.data?.length === 0 && (
            <p className="rounded border border-slate-200 bg-white p-4 text-center text-slate-500">
              Nothing scheduled for today — great job staying caught up!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
