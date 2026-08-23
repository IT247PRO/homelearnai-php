import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  analyzing: 'Analyzing…',
  outline_generated: 'Outline ready for review',
  awaiting_approval: 'Outline approved',
  generating_lessons: 'Generating lessons…',
  ready: 'Ready',
  archived: 'Archived',
  failed: 'Analysis failed',
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Curricula</h1>
        <Link
          to={childId ? `/curricula/new?childId=${childId}` : '/curricula/new'}
          className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          + Import curriculum
        </Link>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Paste a real school curriculum or course description and turn it into a reviewable, AI-decomposed learning plan you can
        schedule for a child.
      </p>

      <div className="space-y-2">
        {curriculaQuery.data?.map((c) => (
          <Link
            key={c.id}
            to={childId ? `/curricula/${c.id}/outline?childId=${childId}` : `/curricula/${c.id}/outline`}
            className="flex items-center justify-between rounded border border-slate-200 bg-white px-4 py-3 hover:border-brand-400"
          >
            <div>
              <p className="font-medium text-slate-900">{c.title}</p>
              <p className="text-sm text-slate-500">
                {c.subjectArea}
                {c.gradeLevel ? ` · Grade ${c.gradeLevel}` : ''}
                {c.schoolYear ? ` · ${c.schoolYear}` : ''}
              </p>
            </div>
            <span className="text-xs uppercase text-slate-400">{STATUS_LABELS[c.status] ?? c.status}</span>
          </Link>
        ))}
        {curriculaQuery.data?.length === 0 && (
          <p className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No curricula yet. Import one to get started.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
