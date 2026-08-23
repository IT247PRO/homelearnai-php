import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface LearningProfile {
  learningGoals: string[] | null;
  interests: string[] | null;
  learningPaceLabel: string | null;
  preferredSessionLengthMinutes: number | null;
}

/** Feeds AI curriculum generation's prompt context (ai.ts reads these same fields) — filled
 * in here, not gated behind onboarding, since it's meant to evolve over time. */
export function LearningProfileSection({ childId }: { childId: number }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [learningGoals, setLearningGoals] = useState('');
  const [interests, setInterests] = useState('');
  const [pace, setPace] = useState('');
  const [sessionLength, setSessionLength] = useState('');

  const profileQuery = useQuery({
    queryKey: ['children', childId, 'learning-profile'],
    queryFn: async () => {
      const { data } = await api.get<{ data: LearningProfile | null }>(`/children/${childId}/learning-profile`);
      return data.data;
    },
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setLearningGoals((profileQuery.data.learningGoals ?? []).join(', '));
    setInterests((profileQuery.data.interests ?? []).join(', '));
    setPace(profileQuery.data.learningPaceLabel ?? '');
    setSessionLength(profileQuery.data.preferredSessionLengthMinutes?.toString() ?? '');
  }, [profileQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      await api.patch(`/children/${childId}/learning-profile`, {
        learningGoals: learningGoals
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        interests: interests
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        learningPaceLabel: pace || null,
        preferredSessionLengthMinutes: sessionLength ? Number(sessionLength) : null,
      });
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['children', childId, 'learning-profile'] });
    },
  });

  const profile = profileQuery.data;
  const hasContent = profile && ((profile.learningGoals?.length ?? 0) > 0 || (profile.interests?.length ?? 0) > 0 || profile.learningPaceLabel || profile.preferredSessionLengthMinutes);

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Learning Profile</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-sm text-brand-600 hover:underline">
            {hasContent ? 'Edit' : '+ Add'}
          </button>
        )}
      </div>

      {!editing && (
        <div className="rounded border border-slate-200 bg-white p-4 text-sm">
          {hasContent ? (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {profile?.learningGoals && profile.learningGoals.length > 0 && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Learning goals</dt>
                  <dd className="text-slate-700">{profile.learningGoals.join(', ')}</dd>
                </div>
              )}
              {profile?.interests && profile.interests.length > 0 && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Interests</dt>
                  <dd className="text-slate-700">{profile.interests.join(', ')}</dd>
                </div>
              )}
              {profile?.learningPaceLabel && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Pace</dt>
                  <dd className="text-slate-700">{profile.learningPaceLabel}</dd>
                </div>
              )}
              {profile?.preferredSessionLengthMinutes && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Preferred session length</dt>
                  <dd className="text-slate-700">{profile.preferredSessionLengthMinutes} min</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-slate-500">
              Nothing set yet — goals and interests here help the AI curriculum generator personalize what it suggests.
            </p>
          )}
        </div>
      )}

      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-3 rounded border border-slate-200 bg-white p-4 text-sm"
        >
          <div>
            <label htmlFor="lp-goals" className="block text-xs font-medium text-slate-700">
              Learning goals (comma-separated)
            </label>
            <input
              id="lp-goals"
              value={learningGoals}
              onChange={(e) => setLearningGoals(e.target.value)}
              placeholder="e.g. multiplication fluency, better handwriting"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="lp-interests" className="block text-xs font-medium text-slate-700">
              Interests (comma-separated)
            </label>
            <input
              id="lp-interests"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="e.g. dinosaurs, space, drawing"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lp-pace" className="block text-xs font-medium text-slate-700">
                Pace
              </label>
              <select id="lp-pace" value={pace} onChange={(e) => setPace(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-2">
                <option value="">Not set</option>
                <option value="slower">Slower — takes time to build confidence</option>
                <option value="typical">Typical</option>
                <option value="faster">Faster — enjoys moving ahead</option>
              </select>
            </div>
            <div>
              <label htmlFor="lp-session-length" className="block text-xs font-medium text-slate-700">
                Preferred session length (min)
              </label>
              <input
                id="lp-session-length"
                type="number"
                min={5}
                max={240}
                value={sessionLength}
                onChange={(e) => setSessionLength(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={save.isPending} className="rounded bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-50">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded bg-slate-100 px-4 py-2 text-slate-700 hover:bg-slate-200">
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
