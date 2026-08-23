import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Sparkles, BookOpen } from 'lucide-react';
import { api } from '../lib/api';
import { RichContent } from '../components/RichContent';
import { TutorChat } from '../components/TutorChat';

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
}

interface StudyGuideContent {
  overview: string;
  learningObjectives: string[];
  concepts: StudyGuideConcept[];
  vocabulary?: { term: string; definition: string; childFriendlyExplanation?: string }[];
  practiceQuestions?: StudyGuideQuestion[];
  reviewQuestions?: StudyGuideQuestion[];
}

interface StudyGuideVersionData {
  id: number;
  versionNumber: number;
  content: StudyGuideContent;
}

/** Kids Mode's "read the whole topic" view (plan4.md §47) — a consolidated companion to the
 * section-by-section Lesson Player, stepping through the AI-synthesized concept map one
 * concept at a time, with the AI Tutor docked alongside knowing exactly which concept the
 * child is looking at (see TutorContext wiring in services/tutor.ts). */
export default function KidsStudyGuidePage() {
  const { topicId } = useParams<{ topicId: string }>();
  const id = Number(topicId);
  const [conceptIndex, setConceptIndex] = useState(0);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [flippedVocab, setFlippedVocab] = useState<Set<number>>(new Set());
  const [revealedQuestions, setRevealedQuestions] = useState<Set<number>>(new Set());

  const query = useQuery({
    queryKey: ['kids-study-guide', id],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudyGuideVersionData | null }>(`/kids/topics/${id}/study-guide`);
      return data.data;
    },
  });

  const guide = query.data;

  const header = (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-soft-xs">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
        <Link
          to="/kids"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Storybook</span>
        </Link>
        <div className="text-center truncate">
          <h1 className="text-sm font-black text-slate-900 flex items-center justify-center gap-1.5 truncate">
            <BookOpen className="h-4 w-4 text-indigo-600 shrink-0" />
            <span className="truncate">Study Guide</span>
          </h1>
          <p className="text-[11px] font-semibold text-slate-500">Everything you need to know about this topic</p>
        </div>
        <div className="w-24" />
      </div>
    </header>
  );

  if (query.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {header}
        <p className="p-8 text-center text-slate-500">Loading study guide…</p>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {header}
        <main className="flex-1 mx-auto w-full max-w-md px-4 py-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-600">No study guide is available for this topic yet.</p>
          <p className="mt-1 text-xs text-slate-400">Ask a parent to generate and publish one.</p>
        </main>
      </div>
    );
  }

  const concept = guide.content.concepts[conceptIndex];
  const tutorPanel = (
    <TutorChat kidsStyle messagesUrl={`/kids/topics/${id}/tutor/messages`} studyGuideVersionId={guide.id} conceptIndex={conceptIndex} />
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {header}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">What You'll Learn</p>
              <RichContent content={guide.content.overview} />
              <ul className="mt-3 space-y-1">
                {guide.content.learningObjectives.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 text-indigo-500">•</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>

            {concept && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="mb-1 text-sm font-medium text-slate-500">
                  Key Idea {conceptIndex + 1} of {guide.content.concepts.length}
                </p>
                <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${((conceptIndex + 1) / guide.content.concepts.length) * 100}%` }} />
                </div>
                <h2 className="mb-3 text-lg font-bold text-slate-900">{concept.title}</h2>
                <div className="space-y-3">
                  <RichContent content={concept.simpleExplanation} />
                  <RichContent content={concept.detailedExplanation} />
                  {concept.example && (
                    <div className="rounded-xl bg-indigo-50 p-3">
                      <p className="mb-1 text-xs font-bold text-indigo-700">📖 Example</p>
                      <RichContent content={concept.example} />
                    </div>
                  )}
                  {concept.realWorldApplication && (
                    <div className="rounded-xl bg-sky-50 p-3">
                      <p className="mb-1 text-xs font-bold text-sky-700">🌍 Why It Matters</p>
                      <RichContent content={concept.realWorldApplication} />
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <button
                    onClick={() => setConceptIndex((i) => Math.max(0, i - 1))}
                    disabled={conceptIndex === 0}
                    className="rounded-full bg-slate-100 px-5 py-2 font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setConceptIndex((i) => Math.min(guide.content.concepts.length - 1, i + 1))}
                    disabled={conceptIndex === guide.content.concepts.length - 1}
                    className="rounded-full bg-indigo-600 px-6 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {guide.content.vocabulary && guide.content.vocabulary.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-600">Vocabulary — Click to Flip</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {guide.content.vocabulary.map((term, i) => {
                    const flipped = flippedVocab.has(i);
                    return (
                      <div
                        key={i}
                        onClick={() =>
                          setFlippedVocab((prev) => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i);
                            else next.add(i);
                            return next;
                          })
                        }
                        className={`min-h-[100px] cursor-pointer rounded-xl border p-3.5 text-center transition-all ${flipped ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}
                      >
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{flipped ? 'Meaning' : 'Term'}</p>
                        <p className="font-semibold text-slate-800">{flipped ? term.childFriendlyExplanation || term.definition : term.term}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {Boolean(guide.content.practiceQuestions?.length || guide.content.reviewQuestions?.length) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-600">Quick Review</p>
                <div className="space-y-2">
                  {[...(guide.content.practiceQuestions ?? []), ...(guide.content.reviewQuestions ?? [])].map((q, i) => {
                    const revealed = revealedQuestions.has(i);
                    return (
                      <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="font-medium text-slate-800">{q.question}</p>
                        {revealed ? (
                          <p className="mt-2 text-sm text-emerald-700">{q.answer}</p>
                        ) : (
                          <button
                            onClick={() => setRevealedQuestions((prev) => new Set(prev).add(i))}
                            className="mt-2 text-xs font-bold text-indigo-600 hover:underline"
                          >
                            Show Answer →
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={() => setTutorOpen(true)} className="w-full rounded-full bg-sky-100 py-2 text-sm font-medium text-sky-700 hover:bg-sky-200 lg:hidden">
              🤖 Ask My Tutor
            </button>
          </div>

          <div className="hidden lg:block lg:w-96">{tutorPanel}</div>
        </div>
      </main>

      {tutorOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t-2 border-sky-200 bg-white p-4 shadow-2xl lg:hidden">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-sky-600" /> Ask My Tutor
            </p>
            <button onClick={() => setTutorOpen(false)} aria-label="Close tutor" className="text-slate-400">
              ✕
            </button>
          </div>
          {tutorPanel}
        </div>
      )}
    </div>
  );
}
