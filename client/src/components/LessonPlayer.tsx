import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { RichContent } from './RichContent';
import { InteractionRenderer, type InteractiveSectionData } from './InteractionRenderer';
import { TutorChat } from './TutorChat';

interface LessonSectionData extends InteractiveSectionData {
  kind: string;
  content: string;
}
interface LessonData {
  id: number;
  title: string;
  topicId: number;
  currentSectionIndex: number;
  completedAt: string | null;
  sections: LessonSectionData[];
}

const KIND_LABELS: Record<string, string> = {
  introduction: 'Introduction',
  instruction: 'Learn',
  example: 'Example',
  guided_practice: "Let's Do One Together",
  independent_practice: 'Your Turn',
  interactive_activity: 'Quick Check',
  activity: 'Activity',
  practice: 'Practice',
  questions: 'Quick Check',
  challenge: 'Challenge',
  vocabulary: 'Vocabulary',
  summary: 'What You Learned',
  exit_ticket: 'Exit Check',
  homework: 'Homework',
};

/** Kids Mode 2.0's Lesson Player (Plan3 §27/§28/§60/§61): one section at a time, a required
 * interactive check gates "Next" (never a page-viewed-only completion — §65), and an
 * AI tutor that knows the current lesson/section rides alongside on desktop, in a
 * slide-up drawer on mobile. */
export function LessonPlayer({ lessonId, onCompleted }: { lessonId: number; onCompleted: () => void }) {
  const queryClient = useQueryClient();
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [localOutcomes, setLocalOutcomes] = useState<Record<number, boolean>>({});
  const [tutorOpen, setTutorOpen] = useState(false);

  const lessonQuery = useQuery({
    queryKey: ['kids-lesson', lessonId],
    queryFn: async () => {
      const { data } = await api.get<{ data: LessonData }>(`/kids/lessons/${lessonId}`);
      return data.data;
    },
  });

  const lesson = lessonQuery.data;

  useEffect(() => {
    if (lesson && viewIndex === null) {
      setViewIndex(Math.min(lesson.currentSectionIndex, Math.max(lesson.sections.length - 1, 0)));
    }
  }, [lesson, viewIndex]);

  useEffect(() => {
    if (lesson?.completedAt) onCompleted();
    // Only re-check when the lesson data itself changes — onCompleted is a stable callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.completedAt]);

  const advance = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { completed: boolean; currentSectionIndex: number } }>(`/kids/lessons/${lessonId}/advance`);
      return data.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['kids-lesson', lessonId] });
      if (result.completed) {
        onCompleted();
      } else {
        setViewIndex(result.currentSectionIndex);
      }
    },
  });

  if (!lesson || viewIndex === null || lesson.completedAt) {
    return <p className="p-4 text-center text-slate-500">Loading lesson…</p>;
  }

  const section = lesson.sections[viewIndex];
  const atFrontier = viewIndex === lesson.currentSectionIndex;
  const frontierSection = lesson.sections[lesson.currentSectionIndex];
  const frontierCanAdvance =
    !frontierSection ||
    !frontierSection.interactionType ||
    frontierSection.isCorrect === true ||
    frontierSection.attemptCount >= 3 ||
    localOutcomes[frontierSection.id] === true;
  const isLastSection = viewIndex === lesson.sections.length - 1;

  function goNext() {
    if (viewIndex! < lesson!.currentSectionIndex) {
      setViewIndex(viewIndex! + 1);
    } else {
      advance.mutate();
    }
  }

  const tutorPanel = (
    <TutorChat kidsStyle messagesUrl={`/kids/topics/${lesson.topicId}/tutor/messages`} lessonId={lesson.id} sectionId={section.id} />
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex-1">
        <div className="mb-3">
          <p className="mb-1 text-sm font-medium text-slate-500">
            Section {viewIndex + 1} of {lesson.sections.length}
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${((viewIndex + 1) / lesson.sections.length) * 100}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-600">{KIND_LABELS[section.kind] ?? section.kind}</p>
          <RichContent content={section.content} />

          {section.interactionType && (
            <div className="mt-4">
              <InteractionRenderer
                lessonId={lesson.id}
                section={section}
                onOutcome={(canAdvance) => {
                  if (canAdvance) setLocalOutcomes((prev) => ({ ...prev, [section.id]: true }));
                }}
              />
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setViewIndex(Math.max(0, viewIndex! - 1))}
            disabled={viewIndex === 0}
            className="rounded-full bg-slate-100 px-5 py-2 font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40"
          >
            ← Previous
          </button>
          <button
            onClick={goNext}
            disabled={(atFrontier && !frontierCanAdvance) || advance.isPending}
            className="rounded-full bg-brand-600 px-6 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
          >
            {advance.isPending ? '…' : isLastSection && atFrontier ? 'Finish lesson 🎉' : 'Next →'}
          </button>
        </div>

        <button onClick={() => setTutorOpen(true)} className="mt-4 w-full rounded-full bg-sky-100 py-2 text-sm font-medium text-sky-700 hover:bg-sky-200 lg:hidden">
          🤖 Ask My Tutor
        </button>
      </div>

      <div className="hidden lg:block lg:w-96">{tutorPanel}</div>

      {tutorOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t-2 border-sky-200 bg-white p-4 shadow-2xl lg:hidden">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-slate-800">Ask My Tutor</p>
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
