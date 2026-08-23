import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Plus, ArrowRight, Layers } from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { api } from '../lib/api';


interface CurriculumListItem {
  id: number;
  title: string;
  subjectArea: string;
  gradeLevel: string | null;
  schoolYear: string | null;
  status: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  analyzing: { label: 'AI Analyzing…', color: 'bg-purple-100 text-purple-700' },
  outline_generated: { label: 'Outline Ready', color: 'bg-blue-100 text-blue-700' },
  awaiting_approval: { label: 'Outline Approved', color: 'bg-emerald-100 text-emerald-700' },
  generating_lessons: { label: 'Generating Lessons…', color: 'bg-amber-100 text-amber-700' },
  ready: { label: 'Ready to Teach', color: 'bg-emerald-100 text-emerald-800' },
  archived: { label: 'Archived', color: 'bg-slate-100 text-slate-500' },
  failed: { label: 'Analysis Failed', color: 'bg-red-100 text-red-700' },
};

export default function CurriculaListPage() {
  const [searchParams] = useSearchParams();
  const childId = searchParams.get('childId');

  const curriculaQuery = useQuery({
    queryKey: ['curricula'],
    queryFn: async () => {
      const { data } = await api.get<{ data: CurriculumListItem[] }>('/curricula');
      return data.data;
    },
  });

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Curricula & Courses</h1>
          <p className="text-xs text-slate-400">
            Decomposed AI learning plans, units, lesson sequences, and assessments
          </p>
        </div>
        <Link
          to={childId ? `/curricula/new?childId=${childId}` : '/curricula/new'}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-4 py-2 text-xs font-bold text-white shadow-soft-md transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          <span>Import Curriculum</span>
        </Link>
      </div>

      <div className="space-y-3">
        {curriculaQuery.isLoading && (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-xs text-slate-400 shadow-soft-xl">
            Loading curricula…
          </div>
        )}

        {!curriculaQuery.isLoading && curriculaQuery.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-soft-xl">
            <Layers className="mx-auto h-10 w-10 text-slate-300 mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No curricula imported yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Paste standard school syllabi or course descriptions to let AI generate structured weekly learning plans.
            </p>
            <Link
              to={childId ? `/curricula/new?childId=${childId}` : '/curricula/new'}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-soft-xs hover:bg-purple-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Import Your First Curriculum</span>
            </Link>
          </div>
        )}

        {curriculaQuery.data?.map((c) => {
          const statusInfo = STATUS_LABELS[c.status] || { label: c.status, color: 'bg-slate-100 text-slate-700' };

          return (
            <Link
              key={c.id}
              to={childId ? `/curricula/${c.id}/outline?childId=${childId}` : `/curricula/${c.id}/outline`}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft-xl transition-all hover:shadow-soft-2xl hover:translate-y-[-1px]"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-sm">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 group-hover:text-purple-600 transition-colors">
                    {c.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span className="font-semibold text-slate-600">{c.subjectArea}</span>
                    {c.gradeLevel && <span>· Grade {c.gradeLevel}</span>}
                    {c.schoolYear && <span>· {c.schoolYear}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`rounded-xl px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          );
        })}
      </div>
    </AppLayout>
  );
}
