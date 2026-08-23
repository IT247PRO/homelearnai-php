import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorBody } from '../lib/api';
import { RichContent } from './RichContent';

interface LessonSection {
  id: number;
  kind: string;
  content: string;
  sortOrder: number;
}
interface Lesson {
  id: number;
  title: string;
  estimatedMinutes: number | null;
  status: string;
  source: string;
  sections: LessonSection[];
}
interface Question {
  id: number;
  type: string;
  prompt: string;
  choices: string[] | null;
  difficultyLevel: string;
}
interface Assessment {
  id: number;
  title: string;
  source: string;
  questions: Question[];
}

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', approved: 'Approved', archived: 'Archived' };

export function LessonsAndAssessmentsSection({ topicId, childId }: { topicId: number; childId: number }) {
  return (
    <div className="mt-4 space-y-4 border-t border-slate-100 pt-3">
      <LessonsSubsection topicId={topicId} />
      <AssessmentsSubsection topicId={topicId} childId={childId} />
    </div>
  );
}

function LessonsSubsection({ topicId }: { topicId: number }) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const lessonsQuery = useQuery({
    queryKey: ['topics', topicId, 'lessons'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Lesson[] }>(`/topics/${topicId}/lessons`);
      return data.data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['topics', topicId, 'lessons'] });

  const generate = useMutation({
    mutationFn: async () => {
      await api.post(`/topics/${topicId}/ai/lesson-generations`, { prompt });
    },
    onSuccess: () => {
      setPrompt('');
      setGenerating(false);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(apiErrorBody(err)?.message ?? apiErrorBody(err)?.error ?? 'Could not generate a lesson'),
  });

  const setStatus = useMutation({
    mutationFn: async ({ lessonId, status }: { lessonId: number; status: string }) => {
      await api.patch(`/lessons/${lessonId}/status`, { status });
    },
    onSuccess: invalidate,
  });

  return (
    <div className="rounded border border-slate-200 bg-white p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium text-slate-700">Lessons</p>
        {!generating && (
          <button onClick={() => setGenerating(true)} className="text-xs text-purple-600 hover:underline">
            + Generate a lesson
          </button>
        )}
      </div>

      {generating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            generate.mutate();
          }}
          className="mb-3 space-y-2 rounded bg-slate-50 p-2"
        >
          <textarea
            required
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="What should this lesson cover or emphasize?"
            aria-label="Lesson generation prompt"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={generate.isPending} className="rounded bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700 disabled:opacity-50">
              {generate.isPending ? 'Generating…' : 'Generate'}
            </button>
            <button type="button" onClick={() => setGenerating(false)} className="rounded bg-slate-200 px-3 py-1.5 text-xs text-slate-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-1">
        {lessonsQuery.data?.map((lesson) => (
          <li key={lesson.id} className="rounded bg-slate-50 p-2">
            <button onClick={() => setExpandedId(expandedId === lesson.id ? null : lesson.id)} className="flex w-full items-center justify-between text-left">
              <span>
                {lesson.title}{' '}
                <span className={`ml-1 rounded px-1.5 py-0.5 text-xs ${lesson.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : lesson.status === 'archived' ? 'bg-slate-200 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>
                  {STATUS_LABEL[lesson.status]}
                </span>
              </span>
              <span aria-hidden="true" className="text-slate-400">
                {expandedId === lesson.id ? '▲' : '▼'}
              </span>
            </button>
            {expandedId === lesson.id && (
              <div className="mt-2 space-y-3">
                {lesson.sections.map((s) => (
                  <div key={s.id}>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{s.kind.replace('_', ' ')}</p>
                    <RichContent content={s.content} />
                  </div>
                ))}
                <div className="flex gap-2 border-t border-slate-200 pt-2">
                  {lesson.status !== 'approved' && (
                    <button onClick={() => setStatus.mutate({ lessonId: lesson.id, status: 'approved' })} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700">
                      Approve
                    </button>
                  )}
                  {lesson.status !== 'archived' && (
                    <button onClick={() => setStatus.mutate({ lessonId: lesson.id, status: 'archived' })} className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700">
                      Archive
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
        {lessonsQuery.data?.length === 0 && !generating && <p className="text-xs text-slate-400">No lessons yet.</p>}
      </ul>
    </div>
  );
}

function AssessmentsSubsection({ topicId, childId }: { topicId: number; childId: number }) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [takingId, setTakingId] = useState<number | null>(null);

  const assessmentsQuery = useQuery({
    queryKey: ['topics', topicId, 'assessments'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Assessment[] }>(`/topics/${topicId}/assessments`);
      return data.data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['topics', topicId, 'assessments'] });

  const generate = useMutation({
    mutationFn: async () => {
      await api.post(`/topics/${topicId}/ai/assessment-generations`, { prompt });
    },
    onSuccess: () => {
      setPrompt('');
      setGenerating(false);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(apiErrorBody(err)?.message ?? apiErrorBody(err)?.error ?? 'Could not generate a quiz'),
  });

  return (
    <div className="rounded border border-slate-200 bg-white p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium text-slate-700">Quizzes</p>
        {!generating && (
          <button onClick={() => setGenerating(true)} className="text-xs text-purple-600 hover:underline">
            + Generate a quiz
          </button>
        )}
      </div>

      {generating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            generate.mutate();
          }}
          className="mb-3 space-y-2 rounded bg-slate-50 p-2"
        >
          <textarea
            required
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="What should this quiz test?"
            aria-label="Quiz generation prompt"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={generate.isPending} className="rounded bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700 disabled:opacity-50">
              {generate.isPending ? 'Generating…' : 'Generate'}
            </button>
            <button type="button" onClick={() => setGenerating(false)} className="rounded bg-slate-200 px-3 py-1.5 text-xs text-slate-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-1">
        {assessmentsQuery.data?.map((assessment) =>
          takingId === assessment.id ? (
            <li key={assessment.id}>
              <QuizAttempt assessment={assessment} childId={childId} onClose={() => setTakingId(null)} />
            </li>
          ) : (
            <li key={assessment.id} className="flex items-center justify-between rounded bg-slate-50 p-2">
              <span>
                {assessment.title} <span className="text-xs text-slate-400">({assessment.questions.length} question(s))</span>
              </span>
              <button onClick={() => setTakingId(assessment.id)} className="text-xs text-brand-600 hover:underline">
                Take quiz
              </button>
            </li>
          )
        )}
        {assessmentsQuery.data?.length === 0 && !generating && <p className="text-xs text-slate-400">No quizzes yet.</p>}
      </ul>
    </div>
  );
}

function QuizAttempt({ assessment, childId, onClose }: { assessment: Assessment; childId: number; onClose: () => void }) {
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ score: number | null } | null>(null);

  const start = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { id: number } }>(`/assessments/${assessment.id}/attempts`, { childId });
      return data.data.id;
    },
    onSuccess: setAttemptId,
  });

  const finish = useMutation({
    mutationFn: async () => {
      if (!attemptId) throw new Error('No attempt in progress');
      for (const question of assessment.questions) {
        const response = responses[question.id];
        if (response === undefined) continue;
        await api.post(`/assessment-attempts/${attemptId}/answers`, { questionId: question.id, response });
      }
      const { data } = await api.post<{ data: { score: number | null } }>(`/assessment-attempts/${attemptId}/complete`);
      return data.data;
    },
    onSuccess: setResult,
  });

  useEffect(() => {
    start.mutate();
    // Start exactly one attempt when this quiz is opened — deliberately not re-running on
    // `start` identity changes (a new mutation object every render would restart the quiz).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (result) {
    return (
      <div className="rounded border border-slate-200 bg-white p-3">
        <p className="mb-2 font-medium text-slate-900">
          {result.score !== null ? `Score: ${Math.round(result.score * 100)}%` : 'Submitted — some answers need manual review.'}
        </p>
        <button onClick={onClose} className="text-xs text-brand-600 hover:underline">
          Close
        </button>
      </div>
    );
  }

  if (!attemptId) {
    return <p className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-500">Starting quiz…</p>;
  }

  return (
    <div className="space-y-3 rounded border border-slate-200 bg-white p-3">
      {assessment.questions.map((q) => (
        <div key={q.id}>
          <RichContent content={q.prompt} className="[&>p]:m-0" />
          {(q.type === 'multiple_choice' || q.type === 'true_false') && q.choices ? (
            <div className="mt-1 flex flex-col gap-1">
              {q.choices.map((choice) => (
                <label key={choice} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={responses[q.id] === choice}
                    onChange={() => setResponses((prev) => ({ ...prev, [q.id]: choice }))}
                  />
                  {choice}
                </label>
              ))}
            </div>
          ) : (
            <input
              value={responses[q.id] ?? ''}
              onChange={(e) => setResponses((prev) => ({ ...prev, [q.id]: e.target.value }))}
              aria-label={`Answer for: ${q.prompt}`}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          )}
        </div>
      ))}
      <div className="flex gap-2 border-t border-slate-200 pt-2">
        <button onClick={() => finish.mutate()} disabled={finish.isPending} className="rounded bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-700 disabled:opacity-50">
          {finish.isPending ? 'Submitting…' : 'Finish quiz'}
        </button>
        <button onClick={onClose} className="rounded bg-slate-200 px-3 py-1.5 text-xs text-slate-700">
          Cancel
        </button>
      </div>
    </div>
  );
}
