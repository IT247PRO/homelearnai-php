import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AppLayout } from '../components/AppLayout';
import { api, apiErrorBody } from '../lib/api';

interface Curriculum {
  id: number;
}

const SOURCE_TYPES = [
  { value: 'school', label: 'School curriculum' },
  { value: 'parent_created', label: 'Parent-created' },
  { value: 'imported', label: 'Imported' },
  { value: 'custom', label: 'Custom' },
];

export default function CurriculumImportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const childId = searchParams.get('childId');

  const [title, setTitle] = useState('');
  const [subjectArea, setSubjectArea] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [schoolYear, setSchoolYear] = useState('');
  const [sourceType, setSourceType] = useState('school');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [notConfigured, setNotConfigured] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const { data: created } = await api.post<{ data: Curriculum }>('/curricula', {
        title,
        subjectArea,
        gradeLevel: gradeLevel || undefined,
        schoolYear: schoolYear || undefined,
        sourceType,
        sourceName: sourceName || undefined,
        sourceUrl: sourceUrl || undefined,
        rawText,
      });
      const curriculumId = created.data.id;

      try {
        await api.post(`/curricula/${curriculumId}/analyze`);
      } catch (err) {
        const body = apiErrorBody(err);
        if (body?.error === 'ai_not_configured') {
          setNotConfigured(body.message ?? 'AI is not configured yet.');
        } else {
          throw err;
        }
      }
      return curriculumId;
    },
    onSuccess: (curriculumId) => {
      navigate(childId ? `/curricula/${curriculumId}/outline?childId=${childId}` : `/curricula/${curriculumId}/outline`);
    },
  });

  return (
    <AppLayout>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Import Curriculum</h1>
      <p className="mb-6 text-sm text-slate-500">
        Paste a real course description (for example, a school district's course catalog entry) and HomeLearnAI will analyze
        it into a reviewable outline before generating any lessons.
      </p>

      {notConfigured && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="font-medium">AI isn't set up yet</p>
          <p className="text-sm">{notConfigured} Your curriculum was saved — you can retry analysis from its outline page once AI is configured.</p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setNotConfigured(null);
          submit.mutate();
        }}
        className="space-y-4 rounded border border-slate-200 bg-white p-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Curriculum name</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Waukee 7th Grade Science"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Subject</label>
            <input
              required
              value={subjectArea}
              onChange={(e) => setSubjectArea(e.target.value)}
              placeholder="Science"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Grade level</label>
            <input
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="7th Grade"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">School year</label>
            <input
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              placeholder="2026-2027"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Source type</label>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2">
              {SOURCE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Source name (optional)</label>
            <input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Waukee Community School District"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Source URL (optional)</label>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="curriculum-raw-text" className="block text-sm font-medium text-slate-700">
            Curriculum / course description
          </label>
          <textarea
            id="curriculum-raw-text"
            required
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={12}
            placeholder="Paste the course description here…"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={submit.isPending}
          className="rounded bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {submit.isPending ? 'Analyzing…' : 'Analyze Curriculum'}
        </button>
      </form>
    </AppLayout>
  );
}
