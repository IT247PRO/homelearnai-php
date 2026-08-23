import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Bot, Check } from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { ChildNavHeader } from '../components/ChildNavHeader';
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
  const id = Number(childId);
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
      <ChildNavHeader childId={id} activeTab="ai" />

      {/* AI Master Toggle Card */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 shadow-soft-xs">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Gemini AI Curriculum Assistant</h3>
            <p className="text-xs text-slate-500">Enable automatic generation of topics, lessons, and flashcards.</p>
          </div>
        </div>
        <button
          disabled={settingsQuery.isLoading || toggleAi.isPending}
          onClick={() => toggleAi.mutate(!settingsQuery.data?.aiEnabled)}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            settingsQuery.data?.aiEnabled
              ? 'bg-gradient-to-tl from-emerald-600 to-teal-400 text-white shadow-soft-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {settingsQuery.data?.aiEnabled ? 'AI Features Enabled' : 'AI Features Disabled'}
        </button>
      </div>

      {/* Prompt Card */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setNotConfigured(null);
          setStudyPlan(null);
          generate.mutate();
        }}
        className="mb-6 space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-soft-xl"
      >
        <div>
          <label htmlFor="ai-curriculum-prompt" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Describe learning goals or topic
          </label>
          <p className="mb-2 text-xs text-slate-400">
            E.g. "Create a 4-week 4th-grade unit on the Solar System covering planetary orbits, moons, asteroid belt, and space exploration."
          </p>
          <textarea
            id="ai-curriculum-prompt"
            required
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 shadow-soft-xs focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            placeholder="What subject, age group, or specific topics should be covered?"
          />
        </div>

        <button
          type="submit"
          disabled={generate.isPending || !settingsQuery.data?.aiEnabled}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-5 py-2.5 text-xs font-bold text-white shadow-soft-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          <span>{generate.isPending ? 'Generating Curriculum with AI…' : 'Generate Curriculum'}</span>
        </button>
      </form>

      {notConfigured && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800">
          <p className="font-bold">AI isn't set up yet</p>
          <p className="mt-1">{notConfigured}</p>
        </div>
      )}

      {studyPlan && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft-xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700">
                Generated Plan
              </span>
              <h3 className="mt-1 text-base font-bold text-slate-800">{studyPlan.name}</h3>
              <p className="text-xs text-slate-400">Status: {studyPlan.status} · {studyPlan.items.length} topic(s)</p>
            </div>
            {studyPlan.status === 'pending_approval' && (
              <button
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-tl from-emerald-600 to-teal-400 px-4 py-2 text-xs font-bold text-white shadow-soft-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>{approve.isPending ? 'Approving…' : 'Approve and Schedule'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
