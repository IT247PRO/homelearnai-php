import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../components/AppLayout';
import { api, apiErrorBody } from '../lib/api';

interface FamilyAiSettings {
  aiEnabled: boolean;
}

interface StudyPlan {
  id: number;
  name: string;
  status: string;
  items: Array<{ id: number; topicId: number | null }>;
}

export default function AiCurriculumPage() {
  const { childId } = useParams<{ childId: string }>();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [notConfigured, setNotConfigured] = useState<string | null>(null);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['ai-settings'],
    queryFn: async () => {
      const { data } = await api.get<{ data: FamilyAiSettings }>('/ai-settings');
      return data.data;
    },
  });

  const toggleAi = useMutation({
    mutationFn: async (aiEnabled: boolean) => {
      const { data } = await api.patch<{ data: FamilyAiSettings }>('/ai-settings', { aiEnabled });
      return data.data;
    },
    onSuccess: (settings) => queryClient.setQueryData(['ai-settings'], settings),
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/children/${childId}/ai/curriculum-generations`, { prompt });
      return data.data as { studyPlan: StudyPlan };
    },
    onSuccess: (data) => {
      setNotConfigured(null);
      setStudyPlan(data.studyPlan);
    },
    onError: (err) => {
      const body = apiErrorBody(err);
      if (body?.error === 'ai_not_configured') {
        setNotConfigured(body.message ?? 'AI is not configured yet.');
      }
    },
  });

  const approve = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/study-plans/${studyPlan?.id}/approve`);
      return data.data as StudyPlan;
    },
    onSuccess: (plan) => setStudyPlan(plan),
  });

  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">AI Curriculum Generator</h1>

      <div className="mb-4 flex items-center gap-3 rounded border border-slate-200 bg-white p-4">
        <span className="text-sm font-medium text-slate-700">AI features enabled for this family</span>
        <button
          disabled={settingsQuery.isLoading || toggleAi.isPending}
          onClick={() => toggleAi.mutate(!settingsQuery.data?.aiEnabled)}
          className={`rounded px-3 py-1 text-sm font-medium ${
            settingsQuery.data?.aiEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
          }`}
        >
          {settingsQuery.data?.aiEnabled ? 'On' : 'Off'}
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setNotConfigured(null);
          setStudyPlan(null);
          generate.mutate();
        }}
        className="mb-6 space-y-3 rounded border border-slate-200 bg-white p-4"
      >
        <label htmlFor="ai-curriculum-prompt" className="block text-sm font-medium text-slate-700">
          Describe what you want your child to learn
        </label>
        <textarea
          id="ai-curriculum-prompt"
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="e.g. Teach my 8-year-old about the solar system over the next two weeks"
          className="w-full rounded border border-slate-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={generate.isPending || !settingsQuery.data?.aiEnabled}
          className="rounded bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {generate.isPending ? 'Generating…' : 'Generate curriculum'}
        </button>
        {!settingsQuery.data?.aiEnabled && (
          <p className="text-sm text-slate-500">Turn AI on above to generate a curriculum.</p>
        )}
      </form>

      {notConfigured && (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="font-medium">AI isn't set up yet</p>
          <p className="text-sm">{notConfigured}</p>
        </div>
      )}

      {studyPlan && (
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="font-medium text-slate-900">{studyPlan.name}</p>
          <p className="text-sm text-slate-500">
            Status: {studyPlan.status} · {studyPlan.items.length} topic(s)
          </p>
          {studyPlan.status === 'pending_approval' && (
            <button
              onClick={() => approve.mutate()}
              disabled={approve.isPending}
              className="mt-3 rounded bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {approve.isPending ? 'Approving…' : 'Approve and schedule'}
            </button>
          )}
        </div>
      )}
    </AppLayout>
  );
}
