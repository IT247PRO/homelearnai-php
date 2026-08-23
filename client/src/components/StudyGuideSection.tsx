import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, ChevronDown, ChevronRight, BookOpen, Check, History } from 'lucide-react';
import { api, apiErrorBody } from '../lib/api';
import { RichContent } from './RichContent';

interface StudyGuideConcept {
  title: string;
  simpleExplanation: string;
  detailedExplanation: string;
  example?: string;
  realWorldApplication?: string;
  commonMisconceptions?: string[];
}

interface StudyGuideQuestion {
  question: string;
  answer: string;
  explanation?: string;
}

interface StudyGuideContent {
  overview: string;
  learningObjectives: string[];
  concepts: StudyGuideConcept[];
  vocabulary?: { term: string; definition: string; childFriendlyExplanation?: string; example?: string }[];
  practiceQuestions?: StudyGuideQuestion[];
  reviewQuestions?: StudyGuideQuestion[];
}

interface StudyGuideVersion {
  id: number;
  versionNumber: number;
  status: string;
  content: StudyGuideContent;
  reason: string | null;
  createdAt: string;
}

interface StudyGuideData {
  id: number;
  currentVersionId: number | null;
  versions: StudyGuideVersion[];
}

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' };

export function StudyGuideSection({ topicId }: { topicId: number }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedConcepts, setExpandedConcepts] = useState<Set<number>>(new Set());
  const [showHistory, setShowHistory] = useState(false);

  const query = useQuery({
    queryKey: ['topics', topicId, 'study-guide'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudyGuideData | null }>(`/topics/${topicId}/study-guide`);
      return data.data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['topics', topicId, 'study-guide'] });

  const generate = useMutation({
    mutationFn: async (kind: 'generate' | 'regenerate') => {
      await api.post(`/topics/${topicId}/study-guide/${kind}`, { reason: reason || undefined });
    },
    onSuccess: () => {
      setReason('');
      setShowForm(false);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(apiErrorBody(err)?.message ?? apiErrorBody(err)?.error ?? 'Could not generate the study guide'),
  });

  const publish = useMutation({
    mutationFn: async (versionId: number) => {
      await api.post(`/topics/${topicId}/study-guide/versions/${versionId}/publish`);
    },
    onSuccess: invalidate,
  });

  const guide = query.data;
  const versions = guide?.versions ?? [];
  const currentVersion = versions.find((v) => v.id === guide?.currentVersionId) ?? versions[0];

  const toggleConcept = (index: number) => {
    setExpandedConcepts((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">Study Guide</h3>
            <p className="text-[11px] text-slate-400">
              {currentVersion ? `Version ${currentVersion.versionNumber} • ${STATUS_LABEL[currentVersion.status] ?? currentVersion.status}` : 'Not generated yet'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {versions.length > 0 && (
            <button
              onClick={() => setShowHistory((prev) => !prev)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <History className="h-3 w-3" />
              <span>{showHistory ? 'Hide History' : 'Version History'}</span>
            </button>
          )}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 rounded-lg bg-gradient-to-tl from-indigo-700 to-sky-500 px-3 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Sparkles className="h-3 w-3" />
              <span>{guide ? 'Regenerate' : 'Generate Study Guide'}</span>
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            generate.mutate(guide ? 'regenerate' : 'generate');
          }}
          className="mb-4 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5"
        >
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-indigo-900">{guide ? 'What should change in this version?' : 'Anything specific this guide should focus on? (optional)'}</label>
            <span className="text-[11px] text-indigo-600">AI Curriculum Synthesizer</span>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder={guide ? 'e.g. Make the explanations simpler and add two more examples.' : 'e.g. Emphasize real-world examples for a 7th grader.'}
            aria-label="Study guide generation instructions"
            className="w-full rounded-xl border border-indigo-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generate.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-tl from-indigo-700 to-sky-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:opacity-95 disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              <span>{generate.isPending ? 'Synthesizing…' : guide ? 'Create New Version' : 'Create Study Guide'}</span>
            </button>
          </div>
        </form>
      )}

      {!guide && !showForm && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <p className="text-xs font-semibold text-slate-600">No study guide generated yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
            Generate a complete, curriculum-grounded study guide covering this topic's concepts, vocabulary, and practice.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:bg-indigo-700"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Generate Study Guide</span>
          </button>
        </div>
      )}

      {showHistory && versions.length > 0 && (
        <div className="mb-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2.5 text-xs shadow-soft-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">Version {v.versionNumber}</span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      v.status === 'published'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : v.status === 'archived'
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                    }`}
                  >
                    {STATUS_LABEL[v.status] ?? v.status}
                  </span>
                </div>
                <p className="truncate text-[11px] text-slate-400">{v.reason || 'Initial generation'} • {new Date(v.createdAt).toLocaleDateString()}</p>
              </div>
              {v.status !== 'published' && (
                <button
                  onClick={() => publish.mutate(v.id)}
                  disabled={publish.isPending}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                  <span>Publish</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {currentVersion && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3.5">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-600">Overview</p>
            <RichContent content={currentVersion.content.overview} />
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3.5">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-600">Learning Objectives</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {currentVersion.content.learningObjectives.map((o, i) => (
                <li key={i}>
                  <RichContent content={o} className="inline-block" />
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Key Concepts</p>
            {currentVersion.content.concepts.map((concept, i) => {
              const isExpanded = expandedConcepts.has(i);
              return (
                <div key={i} className={`rounded-xl border transition-all ${isExpanded ? 'border-indigo-200 bg-white shadow-soft-md' : 'border-slate-100 bg-slate-50/50 hover:bg-white'}`}>
                  <button onClick={() => toggleConcept(i)} className="flex w-full items-center gap-2.5 p-3 text-left">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-indigo-600" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    <span className="font-bold text-xs text-slate-800">{concept.title}</span>
                  </button>
                  {isExpanded && (
                    <div className="space-y-3 border-t border-indigo-100/60 p-4 text-sm text-slate-700">
                      <RichContent content={concept.simpleExplanation} />
                      <RichContent content={concept.detailedExplanation} />
                      {concept.example && (
                        <div className="rounded-lg bg-indigo-50/60 p-2.5">
                          <p className="mb-1 text-[11px] font-bold text-indigo-700">Example</p>
                          <RichContent content={concept.example} />
                        </div>
                      )}
                      {concept.realWorldApplication && (
                        <div className="rounded-lg bg-sky-50/60 p-2.5">
                          <p className="mb-1 text-[11px] font-bold text-sky-700">Real-World Connection</p>
                          <RichContent content={concept.realWorldApplication} />
                        </div>
                      )}
                      {concept.commonMisconceptions && concept.commonMisconceptions.length > 0 && (
                        <div className="rounded-lg bg-amber-50/60 p-2.5">
                          <p className="mb-1 text-[11px] font-bold text-amber-700">Common Mistakes</p>
                          <ul className="list-disc space-y-0.5 pl-4 text-xs">
                            {concept.commonMisconceptions.map((m, mi) => (
                              <li key={mi}>
                                <RichContent content={m} className="inline-block" />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {currentVersion.content.vocabulary && currentVersion.content.vocabulary.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3.5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-600">Vocabulary</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {currentVersion.content.vocabulary.map((v, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                    <span className="font-bold text-slate-800">{v.term}</span>
                    <div className="mt-0.5 text-slate-600">
                      <RichContent content={v.definition} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Boolean(currentVersion.content.practiceQuestions?.length || currentVersion.content.reviewQuestions?.length) && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3.5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-600">Practice &amp; Review</p>
              <div className="space-y-2">
                {[...(currentVersion.content.practiceQuestions ?? []), ...(currentVersion.content.reviewQuestions ?? [])].map((q, i) => (
                  <details key={i} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                    <summary className="cursor-pointer font-semibold text-slate-800">
                      <div className="inline-block align-middle">
                        <RichContent content={q.question} />
                      </div>
                    </summary>
                    <div className="mt-1.5 border-t border-slate-100 pt-1.5 text-slate-600">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-0.5">Solution</p>
                      <RichContent content={q.answer} />
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
