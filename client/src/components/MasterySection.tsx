import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface MasteryRow {
  id: number;
  topicId: number;
  state: string;
  accuracy: number | null;
  attemptsCount: number;
  topic: {
    title: string;
    unit: { name: string; subject: { name: string; color: string } };
  };
}

const STATE_ORDER = ['not_started', 'introduced', 'practicing', 'developing', 'proficient', 'mastered'];
const STATE_LABEL: Record<string, string> = {
  not_started: 'Not started',
  introduced: 'Introduced',
  practicing: 'Practicing',
  developing: 'Developing',
  proficient: 'Proficient',
  mastered: 'Mastered',
};
const STATE_CLASS: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-500',
  introduced: 'bg-slate-200 text-slate-700',
  practicing: 'bg-amber-100 text-amber-700',
  developing: 'bg-amber-200 text-amber-800',
  proficient: 'bg-emerald-100 text-emerald-700',
  mastered: 'bg-emerald-600 text-white',
};

/** Deterministic mastery tracking — no AI involved. Read-only: the state itself is derived
 * from attempt count + rolling accuracy in services/mastery.ts, already wired into reviews,
 * assessments, and Kids Mode completion; this section just surfaces it. */
export function MasterySection({ childId }: { childId: number }) {
  const masteryQuery = useQuery({
    queryKey: ['children', childId, 'mastery'],
    queryFn: async () => {
      const { data } = await api.get<{ data: MasteryRow[] }>(`/children/${childId}/mastery`);
      return data.data;
    },
  });

  const bySubjectThenUnit = new Map<string, Map<string, MasteryRow[]>>();
  for (const row of masteryQuery.data ?? []) {
    const subjectName = row.topic.unit.subject.name;
    const unitName = row.topic.unit.name;
    if (!bySubjectThenUnit.has(subjectName)) bySubjectThenUnit.set(subjectName, new Map());
    const byUnit = bySubjectThenUnit.get(subjectName)!;
    if (!byUnit.has(unitName)) byUnit.set(unitName, []);
    byUnit.get(unitName)!.push(row);
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-slate-900">Mastery</h2>
      {masteryQuery.data?.length === 0 && <p className="text-sm text-slate-500">No activity recorded yet — mastery fills in as your child reviews and completes work.</p>}
      <div className="space-y-4">
        {Array.from(bySubjectThenUnit.entries()).map(([subjectName, byUnit]) => (
          <div key={subjectName} className="rounded border border-slate-200 bg-white p-3">
            <p className="mb-2 font-medium text-slate-900">{subjectName}</p>
            {Array.from(byUnit.entries()).map(([unitName, rows]) => (
              <div key={unitName} className="mb-2 last:mb-0">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{unitName}</p>
                <div className="flex flex-wrap gap-1.5">
                  {rows
                    .sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state))
                    .map((row) => (
                      <span
                        key={row.id}
                        title={`${row.attemptsCount} attempt(s)${row.accuracy !== null ? `, ${Math.round(row.accuracy * 100)}% accuracy` : ''}`}
                        className={`rounded-full px-2 py-1 text-xs ${STATE_CLASS[row.state]}`}
                      >
                        {row.topic.title} · {STATE_LABEL[row.state]}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
