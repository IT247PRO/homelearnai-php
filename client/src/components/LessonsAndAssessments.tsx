import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Play,
  FileCheck,
  Eye,
  Check,
  Archive,
  Layers,
} from 'lucide-react';
import { api, apiErrorBody } from '../lib/api';
import { RichContent } from './RichContent';

interface LessonSection {
  id: number;
  kind: string;
  content: string;
  sortOrder: number;
  interactionType?: string | null;
  choices?: string[] | null;
  hints?: string[] | null;
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
  const [expandAllLessons, setExpandAllLessons] = useState(false);
  const [expandAllQuizzes, setExpandAllQuizzes] = useState(false);

  return (
    <div className="space-y-6 pt-1">
      <LessonsSubsection
        topicId={topicId}
        allExpanded={expandAllLessons}
        onToggleExpandAll={() => setExpandAllLessons(!expandAllLessons)}
      />
      <AssessmentsSubsection
        topicId={topicId}
        childId={childId}
        allExpanded={expandAllQuizzes}
        onToggleExpandAll={() => setExpandAllQuizzes(!expandAllQuizzes)}
      />
    </div>
  );
}

function LessonsSubsection({
  topicId,
  allExpanded,
  onToggleExpandAll,
}: {
  topicId: number;
  allExpanded: boolean;
  onToggleExpandAll: () => void;
}) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const lessonsQuery = useQuery({
    queryKey: ['topics', topicId, 'lessons'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Lesson[] }>(`/topics/${topicId}/lessons`);
      return data.data;
    },
  });

  // Keep expandedIds in sync if allExpanded changes
  useEffect(() => {
    if (lessonsQuery.data) {
      if (allExpanded) {
        setExpandedIds(new Set(lessonsQuery.data.map((l) => l.id)));
      } else {
        setExpandedIds(new Set());
      }
    }
  }, [allExpanded, lessonsQuery.data]);

  const toggleLesson = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const lessons = lessonsQuery.data ?? [];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">Interactive Lessons</h3>
            <p className="text-[11px] text-slate-400">
              {lessons.length} structured {lessons.length === 1 ? 'lesson' : 'lessons'} available
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lessons.length > 0 && (
            <button
              onClick={onToggleExpandAll}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {allExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
            </button>
          )}

          {!generating && (
            <button
              onClick={() => setGenerating(true)}
              className="flex items-center gap-1 rounded-lg bg-gradient-to-tl from-purple-700 to-pink-500 px-3 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Sparkles className="h-3 w-3" />
              <span>Generate AI Lesson</span>
            </button>
          )}
        </div>
      </div>

      {generating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            generate.mutate();
          }}
          className="mb-4 space-y-3 rounded-xl border border-purple-100 bg-purple-50/40 p-3.5"
        >
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-purple-900">What should this lesson focus on?</label>
            <span className="text-[11px] text-purple-600">AI Pedagogical Designer</span>
          </div>
          <textarea
            required
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="e.g. Focus on step-by-step visual examples with practice questions and real-world analogies."
            aria-label="Lesson generation prompt"
            className="w-full rounded-xl border border-purple-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setGenerating(false)}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generate.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-tl from-purple-700 to-pink-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:opacity-95 disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              <span>{generate.isPending ? 'Crafting Lesson…' : 'Create Lesson'}</span>
            </button>
          </div>
        </form>
      )}

      {lessons.length === 0 && !generating && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <p className="text-xs font-semibold text-slate-600">No lessons generated yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
            Generate an interactive lesson with reading passages, questions, and progressive hints.
          </p>
          <button
            onClick={() => setGenerating(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:bg-purple-700"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Generate First Lesson</span>
          </button>
        </div>
      )}

      <div className="space-y-3">
        {lessons.map((lesson) => {
          const isExpanded = expandedIds.has(lesson.id);

          return (
            <div
              key={lesson.id}
              className={`rounded-xl border transition-all ${
                isExpanded ? 'border-purple-200 bg-white shadow-soft-md ring-1 ring-purple-100' : 'border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200'
              }`}
            >
              {/* Lesson Card Header (Click to Expand / Collapse) */}
              <div className="flex items-center justify-between p-3">
                <button
                  onClick={() => toggleLesson(lesson.id)}
                  className="flex flex-1 items-center gap-2.5 text-left"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-purple-600" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800 truncate">{lesson.title}</span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          lesson.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : lesson.status === 'archived'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                        }`}
                      >
                        {STATUS_LABEL[lesson.status] || lesson.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {lesson.sections.length} {lesson.sections.length === 1 ? 'section' : 'sections'}
                      {lesson.estimatedMinutes ? ` • ~${lesson.estimatedMinutes} mins` : ''}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-1.5 ml-2">
                  <button
                    onClick={() => toggleLesson(lesson.id)}
                    className="rounded-lg p-1.5 text-xs font-semibold text-purple-600 hover:bg-purple-50"
                    title={isExpanded ? 'Collapse' : 'Expand full lesson content'}
                  >
                    {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Expanded Lesson Full Content */}
              {isExpanded && (
                <div className="border-t border-purple-100/60 p-4 space-y-4 bg-white rounded-b-xl">
                  <div className="space-y-4">
                    {lesson.sections.map((s, idx) => (
                      <div
                        key={s.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/40 p-3.5 transition-all hover:bg-slate-50/70"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                              {s.kind.replace('_', ' ')}
                            </span>
                          </div>
                          {s.interactionType && (
                            <span className="rounded-md bg-sky-50 border border-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                              {s.interactionType.replace('_', ' ')}
                            </span>
                          )}
                        </div>

                        {/* Rich Reading Content */}
                        <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed font-normal">
                          <RichContent content={s.content} />
                        </div>

                        {/* If multiple choice or question choices */}
                        {s.choices && Array.isArray(s.choices) && s.choices.length > 0 && (
                          <div className="mt-3 space-y-1.5 border-t border-slate-200/60 pt-2.5">
                            <p className="text-[11px] font-bold text-slate-500">Choices:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {s.choices.map((c, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                                >
                                  <span className="h-2 w-2 rounded-full bg-purple-400" />
                                  <span>{c}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2">
                      {lesson.status !== 'approved' && (
                        <button
                          onClick={() => setStatus.mutate({ lessonId: lesson.id, status: 'approved' })}
                          disabled={setStatus.isPending}
                          className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:bg-emerald-700"
                        >
                          <Check className="h-3 w-3" />
                          <span>Approve Lesson</span>
                        </button>
                      )}
                      {lesson.status !== 'archived' && (
                        <button
                          onClick={() => setStatus.mutate({ lessonId: lesson.id, status: 'archived' })}
                          disabled={setStatus.isPending}
                          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          <Archive className="h-3 w-3" />
                          <span>Archive</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AssessmentsSubsection({
  topicId,
  childId,
  allExpanded,
  onToggleExpandAll,
}: {
  topicId: number;
  childId: number;
  allExpanded: boolean;
  onToggleExpandAll: () => void;
}) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [takingId, setTakingId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const assessmentsQuery = useQuery({
    queryKey: ['topics', topicId, 'assessments'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Assessment[] }>(`/topics/${topicId}/assessments`);
      return data.data;
    },
  });

  useEffect(() => {
    if (assessmentsQuery.data) {
      if (allExpanded) {
        setExpandedIds(new Set(assessmentsQuery.data.map((a) => a.id)));
      } else {
        setExpandedIds(new Set());
      }
    }
  }, [allExpanded, assessmentsQuery.data]);

  const toggleAssessment = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const assessments = assessmentsQuery.data ?? [];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-100 text-pink-700">
            <FileCheck className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">Topic Quizzes & Checks</h3>
            <p className="text-[11px] text-slate-400">
              {assessments.length} {assessments.length === 1 ? 'quiz' : 'quizzes'} available
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {assessments.length > 0 && (
            <button
              onClick={onToggleExpandAll}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {allExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
            </button>
          )}

          {!generating && (
            <button
              onClick={() => setGenerating(true)}
              className="flex items-center gap-1 rounded-lg bg-gradient-to-tl from-purple-700 to-pink-500 px-3 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Sparkles className="h-3 w-3" />
              <span>Generate AI Quiz</span>
            </button>
          )}
        </div>
      </div>

      {generating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            generate.mutate();
          }}
          className="mb-4 space-y-3 rounded-xl border border-pink-100 bg-pink-50/40 p-3.5"
        >
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-pink-900">What concepts should this quiz test?</label>
            <span className="text-[11px] text-pink-600">AI Assessment Engine</span>
          </div>
          <textarea
            required
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="e.g. 5 multiple-choice questions focusing on vocabulary, reading comprehension, and problem solving."
            aria-label="Quiz generation prompt"
            className="w-full rounded-xl border border-pink-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/20"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setGenerating(false)}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generate.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-tl from-purple-700 to-pink-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:opacity-95 disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              <span>{generate.isPending ? 'Generating Quiz…' : 'Create Quiz'}</span>
            </button>
          </div>
        </form>
      )}

      {assessments.length === 0 && !generating && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <p className="text-xs font-semibold text-slate-600">No quizzes generated yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
            Generate a targeted quiz with diagnostic questions and difficulty tagging.
          </p>
          <button
            onClick={() => setGenerating(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-pink-600 px-3 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:bg-pink-700"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Generate First Quiz</span>
          </button>
        </div>
      )}

      <div className="space-y-3">
        {assessments.map((assessment) => {
          const isExpanded = expandedIds.has(assessment.id);
          const isTaking = takingId === assessment.id;

          if (isTaking) {
            return (
              <div key={assessment.id} className="rounded-xl border border-purple-200 bg-white p-4 shadow-soft-md">
                <QuizAttempt assessment={assessment} childId={childId} onClose={() => setTakingId(null)} />
              </div>
            );
          }

          return (
            <div
              key={assessment.id}
              className={`rounded-xl border transition-all ${
                isExpanded ? 'border-purple-200 bg-white shadow-soft-md' : 'border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between p-3">
                <button
                  onClick={() => toggleAssessment(assessment.id)}
                  className="flex flex-1 items-center gap-2.5 text-left"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-purple-600" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs text-slate-800 truncate block">{assessment.title}</span>
                    <span className="text-[10px] text-slate-400">
                      {assessment.questions.length} questions • AI Generated
                    </span>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAssessment(assessment.id)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                  </button>

                  <button
                    onClick={() => setTakingId(assessment.id)}
                    className="flex items-center gap-1 rounded-lg bg-gradient-to-tl from-purple-700 to-pink-500 px-3 py-1 text-xs font-bold text-white shadow-soft-xs hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    <span>Take Quiz</span>
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-purple-100/60 p-4 space-y-3 bg-white rounded-b-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Question Preview ({assessment.questions.length})
                    </p>
                    <button
                      onClick={() => setTakingId(assessment.id)}
                      className="text-xs font-bold text-purple-600 hover:underline"
                    >
                      Start Interactive Quiz →
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {assessment.questions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            Q{idx + 1}. {q.type.replace('_', ' ')}
                          </span>
                          <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-600 capitalize">
                            {q.difficultyLevel}
                          </span>
                        </div>
                        <div className="text-slate-700 font-medium leading-relaxed">
                          <RichContent content={q.prompt} />
                        </div>
                        {q.choices && Array.isArray(q.choices) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {q.choices.map((choice, cIdx) => (
                              <div
                                key={cIdx}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-600"
                              >
                                {choice}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuizAttempt({
  assessment,
  childId,
  onClose,
}: {
  assessment: Assessment;
  childId: number;
  onClose: () => void;
}) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (result) {
    const percentage = result.score !== null ? Math.round(result.score * 100) : null;

    return (
      <div className="p-4 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div>
          <h3 className="font-bold text-base text-slate-800">Quiz Completed!</h3>
          <p className="text-sm font-semibold text-emerald-600 mt-1">
            {percentage !== null ? `Score: ${percentage}%` : 'Answers recorded for review'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-soft-xs hover:bg-slate-800"
        >
          Return to Studio
        </button>
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="p-8 text-center text-xs font-medium text-slate-400">
        Preparing quiz questions…
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-bold text-sm text-slate-800">{assessment.title}</h3>
          <p className="text-[11px] text-slate-400">
            {Object.keys(responses).length} of {assessment.questions.length} answered
          </p>
        </div>
        <button onClick={onClose} className="text-xs font-bold text-slate-400 hover:text-slate-600">
          ✕ Cancel
        </button>
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
        {assessment.questions.map((q, idx) => (
          <div key={q.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">
                {idx + 1}
              </span>
              <span className="font-bold text-xs text-slate-800">Question {idx + 1}</span>
            </div>

            <div className="text-xs text-slate-800 font-medium leading-relaxed">
              <RichContent content={q.prompt} />
            </div>

            {(q.type === 'multiple_choice' || q.type === 'true_false') && q.choices ? (
              <div className="space-y-1.5 pt-1">
                {q.choices.map((choice) => (
                  <label
                    key={choice}
                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs font-medium cursor-pointer transition-all ${
                      responses[q.id] === choice
                        ? 'border-purple-500 bg-purple-50/60 font-bold text-purple-900 ring-1 ring-purple-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={responses[q.id] === choice}
                      onChange={() => setResponses((prev) => ({ ...prev, [q.id]: choice }))}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span>{choice}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                value={responses[q.id] ?? ''}
                onChange={(e) => setResponses((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Type your answer here..."
                aria-label={`Answer for: ${q.prompt}`}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={onClose}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          onClick={() => finish.mutate()}
          disabled={finish.isPending}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-4 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>{finish.isPending ? 'Grading Answers…' : 'Submit & Finish Quiz'}</span>
        </button>
      </div>
    </div>
  );
}
