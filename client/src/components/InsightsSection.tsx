import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorBody } from '../lib/api';
import { RichContent } from './RichContent';

interface Insight {
  id: number;
  kind: string;
  summary: string;
  confidence: number | null;
  isAcknowledgedByParent: boolean;
}
interface Recommendation {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  status: string;
}

const INSIGHT_KIND_LABEL: Record<string, string> = {
  strength: '💪 Strength',
  weakness: '⚠️ Weakness',
  knowledge_gap: '🕳️ Knowledge gap',
  at_risk: '📉 At risk',
  ready_to_advance: '🚀 Ready to advance',
};

/** Turns already-tracked Mastery/MasteryEvent data into a narrative — generated on demand
 * (no background job scheduler exists yet), never invented (the prompt is built entirely
 * from stored progress data). */
export function InsightsSection({ childId }: { childId: number }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const insightsQuery = useQuery({
    queryKey: ['children', childId, 'ai-insights'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Insight[] }>(`/children/${childId}/ai/insights`);
      return data.data;
    },
  });

  const recommendationsQuery = useQuery({
    queryKey: ['children', childId, 'ai-recommendations'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Recommendation[] }>(`/children/${childId}/ai/recommendations`);
      return data.data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['children', childId, 'ai-insights'] });
    queryClient.invalidateQueries({ queryKey: ['children', childId, 'ai-recommendations'] });
  };

  const analyze = useMutation({
    mutationFn: async () => {
      await api.post(`/children/${childId}/ai/insights/generate`);
    },
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(apiErrorBody(err)?.message ?? apiErrorBody(err)?.error ?? 'Could not analyze progress'),
  });

  const acknowledge = useMutation({
    mutationFn: async (insightId: number) => {
      await api.patch(`/children/${childId}/ai/insights/${insightId}/acknowledge`);
    },
    onSuccess: invalidate,
  });

  const setRecommendationStatus = useMutation({
    mutationFn: async ({ recommendationId, status }: { recommendationId: number; status: string }) => {
      await api.patch(`/ai-recommendations/${recommendationId}`, { status });
    },
    onSuccess: invalidate,
  });

  const unacknowledged = insightsQuery.data?.filter((i) => !i.isAcknowledgedByParent) ?? [];
  const pendingRecommendations = recommendationsQuery.data?.filter((r) => r.status === 'pending') ?? [];

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">AI Insights &amp; Recommendations</h2>
        <button
          onClick={() => analyze.mutate()}
          disabled={analyze.isPending}
          className="rounded bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {analyze.isPending ? 'Analyzing…' : 'Analyze progress'}
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {unacknowledged.map((insight) => (
          <div key={insight.id} className="flex items-start justify-between gap-3 rounded border border-slate-200 bg-white p-3 text-sm">
            <div className="flex-1">
              <span className="mb-1 inline-block text-xs font-medium text-slate-500">{INSIGHT_KIND_LABEL[insight.kind] ?? insight.kind}</span>
              <RichContent content={insight.summary} className="[&>p]:m-0" />
            </div>
            <button onClick={() => acknowledge.mutate(insight.id)} className="shrink-0 text-xs text-slate-500 hover:underline">
              Dismiss
            </button>
          </div>
        ))}

        {pendingRecommendations.map((rec) => (
          <div key={rec.id} className="rounded border border-purple-200 bg-purple-50 p-3 text-sm">
            <p className="mb-1 font-medium text-purple-900">💡 {rec.title}</p>
            {rec.body && <RichContent content={rec.body} className="text-purple-800 [&>p]:m-0" />}
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setRecommendationStatus.mutate({ recommendationId: rec.id, status: 'accepted' })}
                className="rounded bg-purple-600 px-2 py-1 text-xs text-white hover:bg-purple-700"
              >
                Accept
              </button>
              <button
                onClick={() => setRecommendationStatus.mutate({ recommendationId: rec.id, status: 'dismissed' })}
                className="rounded bg-white px-2 py-1 text-xs text-purple-700 hover:bg-purple-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}

        {unacknowledged.length === 0 && pendingRecommendations.length === 0 && (
          <p className="text-sm text-slate-500">
            Nothing yet — click "Analyze progress" once your child has some review/quiz activity recorded.
          </p>
        )}
      </div>
    </section>
  );
}
