import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { RichContent } from '../components/RichContent';

interface Question {
  id: number;
  type: string;
  prompt: string;
  choices: string[] | null;
  difficultyLevel: string;
}
interface AssessmentData {
  id: number;
  title: string;
  masteryThresholdPercent: number;
  questions: Question[];
}

/** Kids Mode's topic-quiz flow (Plan3 §38/§39): reuses the same deterministic/AI grading
 * and mastery-threshold logic as the parent-facing quiz preview (services/assessmentAttempts.ts),
 * through the Kids-scoped /kids/assessments/* endpoints so it works without the parent's own
 * session and never exposes correctAnswer before submission. */
export default function KidsAssessmentPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const id = Number(assessmentId);

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ score: number | null } | null>(null);

  const assessmentQuery = useQuery({
    queryKey: ['kids-assessment', id],
    queryFn: async () => {
      const { data } = await api.get<{ data: AssessmentData }>(`/kids/assessments/${id}`);
      return data.data;
    },
  });

  const start = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { id: number } }>(`/kids/assessments/${id}/attempts`, {});
      return data.data.id;
    },
    onSuccess: setAttemptId,
  });

  useEffect(() => {
    if (assessmentQuery.data && attemptId === null) start.mutate();
    // Start exactly one attempt once the quiz has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentQuery.data]);

  const finish = useMutation({
    mutationFn: async () => {
      if (!attemptId || !assessmentQuery.data) throw new Error('No attempt in progress');
      for (const question of assessmentQuery.data.questions) {
        const response = responses[question.id];
        if (response === undefined) continue;
        await api.post(`/kids/assessment-attempts/${attemptId}/answers`, { questionId: question.id, response });
      }
      const { data } = await api.post<{ data: { score: number | null } }>(`/kids/assessment-attempts/${attemptId}/complete`);
      return data.data;
    },
    onSuccess: setResult,
  });

  const allAnswered = assessmentQuery.data ? assessmentQuery.data.questions.every((q) => responses[q.id]?.trim()) : false;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <Link to="/kids" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
          ← Back to Today's Work
        </Link>

        {!assessmentQuery.data || !attemptId ? (
          <p className="text-center text-slate-500">Loading quiz…</p>
        ) : result ? (
          <ResultScreen score={result.score} thresholdPercent={assessmentQuery.data.masteryThresholdPercent} />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="mb-4 text-xl font-bold text-slate-900">{assessmentQuery.data.title}</h1>
            <div className="space-y-5">
              {assessmentQuery.data.questions.map((q, i) => (
                <div key={q.id}>
                  <p className="mb-2 font-medium text-slate-800">
                    {i + 1}. <RichContent content={q.prompt} className="inline [&>p]:m-0 [&>p]:inline" />
                  </p>
                  {(q.type === 'multiple_choice' || q.type === 'true_false') && q.choices ? (
                    <div className="flex flex-col gap-2">
                      {q.choices.map((choice) => (
                        <label
                          key={choice}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 ${
                            responses[q.id] === choice ? 'border-sky-500 bg-sky-50' : 'border-slate-200'
                          }`}
                        >
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
                      aria-label={`Answer for question ${i + 1}`}
                      className="w-full rounded-lg border-2 border-slate-200 px-3 py-2"
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => finish.mutate()}
              disabled={!allAnswered || finish.isPending}
              className="mt-6 w-full rounded-full bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
            >
              {finish.isPending ? 'Submitting…' : 'Submit Quiz'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultScreen({ score, thresholdPercent }: { score: number | null; thresholdPercent: number }) {
  const passed = score !== null && score >= thresholdPercent / 100;
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="mb-2 text-4xl">{score === null ? '📝' : passed ? '🌟' : '💪'}</p>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">
        {score === null ? 'Submitted!' : `Score: ${Math.round(score * 100)}%`}
      </h1>
      <p className="mb-6 text-slate-600">
        {score === null
          ? "Some answers need a parent's review before we can score this quiz."
          : passed
            ? "Great job — you've mastered this topic!"
            : "Nice try! Let's review this a bit more before moving on."}
      </p>
      <Link to="/kids" className="block w-full rounded-full bg-slate-100 py-3 font-semibold text-slate-700 hover:bg-slate-200">
        Back to Today's Work
      </Link>
    </div>
  );
}
