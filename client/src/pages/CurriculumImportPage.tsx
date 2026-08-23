import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, ArrowLeft, AlertCircle } from 'lucide-react';
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
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back</span>
        </button>
        <h1 className="text-xl font-bold text-slate-800">Import & Decompose Curriculum</h1>
        <p className="text-xs text-slate-400">
          Paste a school syllabus, standard course description, or custom learning goals to decompose into units & topics.
        </p>
      </div>

      {notConfigured && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 p-4 shadow-soft-sm text-amber-900">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold">AI Not Fully Configured</p>
            <p className="text-xs text-amber-800 mt-0.5">
              {notConfigured} Your curriculum was saved — you can review and analyze it once AI credentials are configured.
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setNotConfigured(null);
          submit.mutate();
        }}
        className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-soft-xl"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-slate-700">Curriculum Title *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 7th Grade Earth Science"
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700">Subject Area *</label>
            <input
              required
              value={subjectArea}
              onChange={(e) => setSubjectArea(e.target.value)}
              placeholder="e.g. Science"
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700">Grade Level</label>
            <input
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="e.g. 7th Grade"
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700">School Year</label>
            <input
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              placeholder="e.g. 2026-2027"
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700">Source Type</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              {SOURCE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700">Source Name / District (Optional)</label>
            <input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="e.g. State Board of Education"
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700">Source URL (Optional)</label>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>

        <div>
          <label htmlFor="curriculum-raw-text" className="block text-xs font-bold text-slate-700">
            Curriculum Content / Syllabus Text *
          </label>
          <p className="mb-2 text-xs text-slate-400">
            Paste course units, learning objectives, standard descriptions, or weekly plans.
          </p>
          <textarea
            id="curriculum-raw-text"
            required
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={10}
            placeholder="Paste syllabus text here…"
            className="w-full rounded-xl border border-slate-200 p-3 font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>

        <button
          type="submit"
          disabled={submit.isPending}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-5 py-2.5 text-xs font-bold text-white shadow-soft-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          <span>{submit.isPending ? 'Decomposing with AI…' : 'Analyze & Generate Outline'}</span>
        </button>
      </form>
    </AppLayout>
  );
}
