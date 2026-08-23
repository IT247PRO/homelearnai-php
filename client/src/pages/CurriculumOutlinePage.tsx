import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Sparkles,
  Layers,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit2,
  Trash2,
  Printer,
  Calendar,
  ExternalLink,
  Target,
  ListChecks,
  RefreshCw,
  Sliders,
  Check,
  FolderPlus,
  ListPlus,
} from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { RichContent } from '../components/RichContent';
import { WorksheetModal } from '../components/WorksheetModal';
import { api, apiErrorBody } from '../lib/api';

interface Objective {
  id: number;
  description: string;
  curriculumSkillId: number | null;
}

interface Skill {
  id: number;
  title: string;
  objectives: Objective[];
}

interface PrerequisiteEdge {
  id: number;
  requiresTopic: { id: number; title: string };
}

interface LessonSection {
  id: number;
  kind: string;
  content: string;
}

interface CurriculumLesson {
  id: number;
  title: string;
  lessonType: string;
  estimatedMinutes: number;
  sequenceNumber: number;
  sections: LessonSection[];
}

interface AssessmentQuestion {
  id: number;
  type: string;
  prompt: string;
  difficultyLevel: string;
}

interface CurriculumAssessment {
  id: number;
  title: string;
  questions: AssessmentQuestion[];
}

interface CurriculumTopic {
  id: number;
  title: string;
  description: string | null;
  confidence: string;
  sourceExcerpt: string | null;
  estimatedLessonCount: number | null;
  lessonPlanStatus: 'pending' | 'generating' | 'generated' | 'failed';
  sortOrder: number;
  skills: Skill[];
  objectives: Objective[];
  prerequisites: PrerequisiteEdge[];
  lessons: CurriculumLesson[];
  assessment: CurriculumAssessment | null;
}

interface CurriculumUnit {
  id: number;
  title: string;
  description: string | null;
  confidence: string;
  sortOrder: number;
  topics: CurriculumTopic[];
}

interface CurriculumDetail {
  id: number;
  title: string;
  subjectArea: string;
  gradeLevel: string | null;
  schoolYear: string | null;
  status: string;
  masteryThresholdPercent: number;
  sourceType: string;
  sourceName: string | null;
  sourceUrl: string | null;
  units: CurriculumUnit[];
}

interface QualityWarning {
  severity: 'warning' | 'info';
  message: string;
  unitId?: number;
  topicId?: number;
}

interface ChildItem {
  id: number;
  name: string;
}

interface StudyPlan {
  id: number;
  name: string;
  status: string;
  items: Array<{ id: number; topicId: number | null; lessonId: number | null; scheduledDate: string | null }>;
}

interface Coverage {
  totalTopics: number;
  masteredTopics: number;
  inProgressTopics: number;
  totalLessons: number;
  completedLessons: number;
  percentComplete: number;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; step: number }
> = {
  draft: { label: 'Draft Outline', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', step: 1 },
  analyzing: { label: 'AI Analyzing…', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', step: 2 },
  outline_generated: { label: 'Outline Ready for Review', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', step: 3 },
  awaiting_approval: { label: 'Outline Approved', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200', step: 3 },
  generating_lessons: { label: 'Generating Lessons…', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', step: 4 },
  ready: { label: 'Ready to Schedule', bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-300', step: 5 },
  archived: { label: 'Archived', bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', step: 0 },
  failed: { label: 'Analysis Failed', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200', step: 1 },
};

function ConfidencePill({ confidence }: { confidence: string }) {
  if (confidence === 'explicit') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
        <Check className="h-2.5 w-2.5" /> Source
      </span>
    );
  }
  if (confidence === 'inferred') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-100">
        <Sparkles className="h-2.5 w-2.5" /> AI Inferred
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
      {confidence}
    </span>
  );
}

export default function CurriculumOutlinePage() {
  const { id } = useParams<{ id: string }>();
  const curriculumId = Number(id);
  const [searchParams] = useSearchParams();
  const childIdParam = searchParams.get('childId');
  const queryClient = useQueryClient();

  const [activeWorksheetTopic, setActiveWorksheetTopic] = useState<{ id: number; title: string } | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['curricula', curriculumId] });

  const curriculumQuery = useQuery({
    queryKey: ['curricula', curriculumId],
    queryFn: async () => {
      const { data } = await api.get<{ data: CurriculumDetail }>(`/curricula/${curriculumId}`);
      return data.data;
    },
  });

  const qualityQuery = useQuery({
    queryKey: ['curricula', curriculumId, 'quality'],
    queryFn: async () => {
      const { data } = await api.get<{ data: { warnings: QualityWarning[] } }>(`/curricula/${curriculumId}/quality-check`);
      return data.data.warnings;
    },
    enabled: !!curriculumQuery.data && curriculumQuery.data.units.length > 0,
  });

  if (curriculumQuery.isLoading || !curriculumQuery.data) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 animate-pulse mb-3">
            <BookOpen className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-slate-600">Loading curriculum outline…</p>
        </div>
      </AppLayout>
    );
  }

  const curriculum = curriculumQuery.data;
  const allTopics = curriculum.units.flatMap((u) => u.topics);
  const totalLessons = allTopics.reduce((acc, t) => acc + (t.lessons?.length || t.estimatedLessonCount || 0), 0);
  const generatedLessonsCount = allTopics.reduce((acc, t) => acc + (t.lessons?.length || 0), 0);
  const statusInfo = STATUS_CONFIG[curriculum.status] || {
    label: curriculum.status,
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    step: 1,
  };

  return (
    <AppLayout>
      {/* Breadcrumb and Top Nav */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link to={childIdParam ? `/curricula?childId=${childIdParam}` : '/curricula'} className="hover:text-purple-600 transition-colors">
            Curricula
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-bold truncate max-w-xs sm:max-w-md">{curriculum.title}</span>
        </div>

        <div className="flex items-center gap-2">
          {curriculum.sourceUrl && (
            <a
              href={curriculum.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-purple-600 shadow-soft-xs transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>{curriculum.sourceName || 'Source'}</span>
            </a>
          )}
          {childIdParam && (
            <Link
              to={`/children/${childIdParam}`}
              className="inline-flex items-center gap-1 rounded-xl bg-purple-50 border border-purple-200 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 shadow-soft-xs transition-all"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Return to Child Dashboard</span>
            </Link>
          )}
        </div>
      </div>

      {/* Hero Curriculum Header Card */}
      <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-soft-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-gradient-to-tl from-purple-700 to-pink-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-soft-xs">
                {curriculum.subjectArea}
              </span>
              {curriculum.gradeLevel && (
                <span className="rounded-md bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-800 border border-purple-200">
                  Grade {curriculum.gradeLevel}
                </span>
              )}
              {curriculum.schoolYear && (
                <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  {curriculum.schoolYear}
                </span>
              )}
              <span
                className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
              >
                {statusInfo.label}
              </span>
            </div>

            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">{curriculum.title}</h1>
            <p className="text-xs text-slate-500 max-w-2xl">
              Hierarchical curriculum map with units, topic breakdown, prerequisite dependency graph, KaTeX mathematical formulas, and practice worksheets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <MasteryThresholdControl curriculum={curriculum} onSaved={invalidate} />
          </div>
        </div>

        {/* Step Progress Visual Bar */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-2">
            <span className={statusInfo.step >= 1 ? 'text-purple-700 font-bold' : ''}>1. Ingestion</span>
            <span className={statusInfo.step >= 2 ? 'text-purple-700 font-bold' : ''}>2. Decomposition</span>
            <span className={statusInfo.step >= 3 ? 'text-purple-700 font-bold' : ''}>3. Outline Approval</span>
            <span className={statusInfo.step >= 4 ? 'text-purple-700 font-bold' : ''}>4. Lesson Plan Gen</span>
            <span className={statusInfo.step >= 5 ? 'text-emerald-700 font-bold' : ''}>5. Active Schedule</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-emerald-500 transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(15, (statusInfo.step / 5) * 100))}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-xl flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-lg font-extrabold text-slate-800">{curriculum.units.length}</span>
            <span className="text-[11px] font-semibold text-slate-400">Total Units</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-xl flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-lg font-extrabold text-slate-800">{allTopics.length}</span>
            <span className="text-[11px] font-semibold text-slate-400">Topic Modules</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-xl flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-600">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-lg font-extrabold text-slate-800">
              {generatedLessonsCount > 0 ? `${generatedLessonsCount} built` : `~${totalLessons}`}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">Lesson Sessions</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-xl flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-lg font-extrabold text-slate-800">{curriculum.masteryThresholdPercent}%</span>
            <span className="text-[11px] font-semibold text-slate-400">Mastery Target</span>
          </div>
        </div>
      </div>

      {/* Quality Check Warnings */}
      {qualityQuery.data && qualityQuery.data.length > 0 && (
        <div className="mb-6 space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-soft-xs">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Curriculum Quality & Completeness Audit</span>
          </div>
          <div className="space-y-1.5 pl-6">
            {qualityQuery.data.map((w, i) => (
              <p key={i} className="text-xs text-amber-800 font-medium flex items-start gap-1.5">
                <span className="shrink-0">•</span>
                <span>{w.message}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Stage Actions */}
      {(curriculum.status === 'draft' || curriculum.status === 'failed' || curriculum.status === 'analyzing') && (
        <AnalyzeSection curriculumId={curriculumId} status={curriculum.status} onDone={invalidate} />
      )}

      {curriculum.status === 'outline_generated' && (
        <ApproveOutlineSection curriculumId={curriculumId} onDone={invalidate} />
      )}

      {['awaiting_approval', 'generating_lessons', 'ready'].includes(curriculum.status) && (
        <BuildLearningPlanSection curriculum={curriculum} onProgress={invalidate} />
      )}

      {curriculum.status === 'ready' && (
        <AdoptSection curriculumId={curriculumId} initialChildId={childIdParam} />
      )}

      {/* Outline Tree & Unit Manager */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-base font-bold text-slate-800">Curriculum Units & Learning Hierarchy</h2>
            <p className="text-xs text-slate-400">
              Customize units, topics, learning objectives, and generate printable practice worksheets.
            </p>
          </div>
        </div>

        <OutlineTree
          curriculum={curriculum}
          allTopics={allTopics}
          onChanged={invalidate}
          onOpenWorksheet={(topic) => setActiveWorksheetTopic(topic)}
        />
      </div>

      {/* Printable Worksheet Modal */}
      {activeWorksheetTopic && (
        <WorksheetModal
          isOpen={true}
          onClose={() => setActiveWorksheetTopic(null)}
          topicId={activeWorksheetTopic.id}
          childId={childIdParam ? Number(childIdParam) : undefined}
          defaultTitle={activeWorksheetTopic.title}
        />
      )}
    </AppLayout>
  );
}

function MasteryThresholdControl({ curriculum, onSaved }: { curriculum: CurriculumDetail; onSaved: () => void }) {
  const [value, setValue] = useState(curriculum.masteryThresholdPercent);
  const [isEditing, setIsEditing] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      await api.patch(`/curricula/${curriculum.id}`, { masteryThresholdPercent: value });
    },
    onSuccess: () => {
      setIsEditing(false);
      onSaved();
    },
  });

  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-700">
      <Sliders className="h-3.5 w-3.5 text-purple-600" />
      <span>Mastery:</span>
      {isEditing ? (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={50}
            max={100}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-14 rounded-lg border border-purple-300 bg-white px-1.5 py-0.5 text-xs font-bold text-purple-700 text-center"
          />
          <span className="text-xs text-slate-400">%</span>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-lg bg-purple-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-purple-700"
          >
            Save
          </button>
          <button
            onClick={() => {
              setValue(curriculum.masteryThresholdPercent);
              setIsEditing(false);
            }}
            className="text-[11px] text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="font-bold text-purple-700 hover:underline flex items-center gap-1"
          title="Click to change mastery threshold percentage"
        >
          <span>{curriculum.masteryThresholdPercent}%</span>
          <Edit2 className="h-2.5 w-2.5 text-slate-400" />
        </button>
      )}
    </div>
  );
}

function AnalyzeSection({ curriculumId, status, onDone }: { curriculumId: number; status: string; onDone: () => void }) {
  const [notConfigured, setNotConfigured] = useState<string | null>(null);
  const analyze = useMutation({
    mutationFn: async () => {
      await api.post(`/curricula/${curriculumId}/analyze`);
    },
    onSuccess: () => {
      setNotConfigured(null);
      onDone();
    },
    onError: (err) => {
      const body = apiErrorBody(err);
      if (body?.error === 'ai_not_configured') setNotConfigured(body.message ?? 'AI is not configured yet.');
    },
  });

  return (
    <div className="mb-6 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/60 to-white p-5 shadow-soft-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-800">AI Curriculum Decomposition</h3>
          </div>
          <p className="text-xs text-slate-500 max-w-xl">
            {status === 'failed'
              ? 'The previous analysis encountered an issue. Click below to retry decomposing this syllabus into units and lessons.'
              : 'Deconstruct this syllabus into standardized units, skill objectives, prerequisite dependencies, and estimated lesson counts.'}
          </p>
        </div>

        <button
          onClick={() => analyze.mutate()}
          disabled={analyze.isPending || status === 'analyzing'}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-5 py-2.5 text-xs font-bold text-white shadow-soft-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all shrink-0"
        >
          {analyze.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Analyzing Syllabus…</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>{status === 'failed' ? 'Retry AI Analysis' : 'Analyze Curriculum with AI'}</span>
            </>
          )}
        </button>
      </div>
      {notConfigured && <p className="mt-3 text-xs text-rose-600 font-semibold">{notConfigured}</p>}
    </div>
  );
}

function ApproveOutlineSection({ curriculumId, onDone }: { curriculumId: number; onDone: () => void }) {
  const approve = useMutation({
    mutationFn: async () => {
      await api.post(`/curricula/${curriculumId}/approve-outline`);
    },
    onSuccess: onDone,
  });

  return (
    <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-soft-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-bold text-blue-900">Step 3: Review & Approve Outline</h3>
          </div>
          <p className="text-xs text-blue-800 max-w-xl">
            Review the generated units and topics below. You can rename, reorder, add/remove objectives, or add prerequisites. Once satisfied, approve the outline to enable lesson plan generation.
          </p>
        </div>

        <button
          onClick={() => approve.mutate()}
          disabled={approve.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-soft-md hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 transition-all shrink-0"
        >
          {approve.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Approving…</span>
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              <span>Approve Outline & Proceed</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function BuildLearningPlanSection({ curriculum, onProgress }: { curriculum: CurriculumDetail; onProgress: () => void }) {
  const allTopics = curriculum.units.flatMap((u) => u.topics);
  const pending = allTopics.filter((t) => t.lessonPlanStatus !== 'generated');
  const [building, setBuilding] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function buildAll() {
    setBuilding(true);
    setError(null);
    setDone(0);
    for (const topic of pending) {
      try {
        await api.post(`/curriculum-topics/${topic.id}/generate-lessons`);
        setDone((d) => d + 1);
        onProgress();
      } catch (err) {
        const body = apiErrorBody(err);
        setError(body?.message ?? `Failed to generate lessons for "${topic.title}". You can retry — already-generated topics are kept.`);
        onProgress();
        setBuilding(false);
        return;
      }
    }
    setBuilding(false);
  }

  if (pending.length === 0) {
    return (
      <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-soft-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-900">All Topic Lessons & Quizzes Generated</h3>
            <p className="text-xs text-emerald-700">
              Every topic now has an AI lesson sequence and assessment ready to schedule for a child.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const percent = allTopics.length > 0 ? Math.round(((allTopics.length - pending.length + done) / allTopics.length) * 100) : 0;

  return (
    <div className="mb-6 rounded-2xl border border-purple-100 bg-white p-5 shadow-soft-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-800">Generate Structured Lessons & Assessments</h3>
          </div>
          <p className="text-xs text-slate-500 max-w-xl">
            Synthesize rich teaching plans, study guides, and assessments for all topics ({allTopics.length - pending.length}/{allTopics.length} generated).
          </p>
        </div>

        <button
          onClick={buildAll}
          disabled={building}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-5 py-2.5 text-xs font-bold text-white shadow-soft-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all shrink-0"
        >
          {building ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Generating ({done}/{pending.length})…</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Generate All Lessons ({pending.length} remaining)</span>
            </>
          )}
        </button>
      </div>

      {building && (
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between text-[11px] font-bold text-slate-500">
            <span>Building lesson sequences…</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-purple-600 transition-all duration-300" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-rose-600 font-semibold">{error}</p>}
    </div>
  );
}

function AdoptSection({ curriculumId, initialChildId }: { curriculumId: number; initialChildId: string | null }) {
  const [selectedChildId, setSelectedChildId] = useState(initialChildId ?? '');
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);

  const childrenQuery = useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ChildItem[] }>('/children');
      return data.data;
    },
  });

  const adopt = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: StudyPlan }>(`/children/${selectedChildId}/curricula/${curriculumId}/adopt`, {});
      return data.data;
    },
    onSuccess: setStudyPlan,
  });

  const approve = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: StudyPlan }>(`/study-plans/${studyPlan?.id}/approve`);
      return data.data;
    },
    onSuccess: setStudyPlan,
  });

  return (
    <div className="mb-6 rounded-2xl border border-emerald-200 bg-white p-5 shadow-soft-xl">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-5 w-5 text-emerald-600" />
        <h2 className="text-sm font-bold text-slate-800">Adopt & Schedule for a Child</h2>
      </div>

      {!studyPlan && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px] max-w-xs">
            <label htmlFor="adopt-child" className="block text-xs font-bold text-slate-600 mb-1">
              Select Child
            </label>
            <select
              id="adopt-child"
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="">Select a child…</option>
              {childrenQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => adopt.mutate()}
            disabled={!selectedChildId || adopt.isPending}
            className="rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-4 py-2 text-xs font-bold text-white shadow-soft-xs hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {adopt.isPending ? 'Building schedule…' : "Add to Child's Schedule"}
          </button>
          {adopt.isError && (
            <p className="text-xs text-rose-600 font-semibold">
              {apiErrorBody(adopt.error)?.error === 'already_adopted'
                ? 'This child already has this curriculum adopted. View their profile below.'
                : 'Could not schedule this curriculum.'}
            </p>
          )}
        </div>
      )}

      {studyPlan && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-slate-800">{studyPlan.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Status: <span className="font-semibold text-slate-700">{studyPlan.status}</span> · {studyPlan.items.length} lesson(s) mapped
              </p>
            </div>
            {studyPlan.status === 'pending_approval' && (
              <button
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-soft-xs disabled:opacity-50"
              >
                {approve.isPending ? 'Approving…' : 'Approve & Activate Schedule'}
              </button>
            )}
          </div>

          {studyPlan.status === 'active' && (
            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Scheduled successfully — lesson sessions are live on the Planning board.</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Link
                  to={`/children/${selectedChildId}/planning`}
                  className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 font-bold text-purple-700 hover:bg-purple-50 shadow-soft-xs"
                >
                  Open Planning Board →
                </Link>
                <Link
                  to={`/children/${selectedChildId}`}
                  className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 shadow-soft-xs"
                >
                  Open Child Dashboard →
                </Link>
              </div>
              <CoveragePanel childId={Number(selectedChildId)} curriculumId={curriculumId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CoveragePanel({ childId, curriculumId }: { childId: number; curriculumId: number }) {
  const coverageQuery = useQuery({
    queryKey: ['children', childId, 'curricula', curriculumId, 'coverage'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Coverage }>(`/children/${childId}/curricula/${curriculumId}/coverage`);
      return data.data;
    },
  });

  if (!coverageQuery.data) return null;
  const c = coverageQuery.data;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-soft-xs text-xs">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-bold text-slate-800">Child Curriculum Coverage</span>
        <span className="font-bold text-purple-600">{c.percentComplete}% Complete</span>
      </div>
      <p className="text-slate-500">
        <span className="font-semibold text-slate-700">{c.masteredTopics}/{c.totalTopics}</span> topics mastered ·{' '}
        <span className="font-semibold text-slate-700">{c.completedLessons}/{c.totalLessons}</span> lessons completed
      </p>
    </div>
  );
}

function OutlineTree({
  curriculum,
  allTopics,
  onChanged,
  onOpenWorksheet,
}: {
  curriculum: CurriculumDetail;
  allTopics: CurriculumTopic[];
  onChanged: () => void;
  onOpenWorksheet: (topic: { id: number; title: string }) => void;
}) {
  const [newUnitTitle, setNewUnitTitle] = useState('');
  const [addingUnit, setAddingUnit] = useState(false);

  const addUnit = useMutation({
    mutationFn: async () => {
      await api.post(`/curricula/${curriculum.id}/units`, { title: newUnitTitle });
    },
    onSuccess: () => {
      setNewUnitTitle('');
      setAddingUnit(false);
      onChanged();
    },
  });

  function moveUnit(index: number, direction: -1 | 1) {
    const target = curriculum.units[index + direction];
    const current = curriculum.units[index];
    if (!target) return;
    api.patch(`/curriculum-units/${current.id}`, { sortOrder: index + direction }).then(onChanged);
    api.patch(`/curriculum-units/${target.id}`, { sortOrder: index }).then(onChanged);
  }

  return (
    <div className="space-y-4">
      {curriculum.units.map((unit, index) => (
        <UnitCard
          key={unit.id}
          unit={unit}
          unitIndex={index + 1}
          curriculumStatus={curriculum.status}
          allTopics={allTopics}
          onChanged={onChanged}
          onOpenWorksheet={onOpenWorksheet}
          onMoveUp={index > 0 ? () => moveUnit(index, -1) : undefined}
          onMoveDown={index < curriculum.units.length - 1 ? () => moveUnit(index, 1) : undefined}
        />
      ))}

      {addingUnit ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addUnit.mutate();
          }}
          className="flex items-center gap-2 rounded-2xl border border-purple-200 bg-purple-50/50 p-4 shadow-soft-sm"
        >
          <input
            required
            value={newUnitTitle}
            onChange={(e) => setNewUnitTitle(e.target.value)}
            placeholder="e.g. Unit 4: Linear Algebra & Coordinate Geometry…"
            aria-label="New unit title"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            autoFocus
          />
          <button
            type="submit"
            disabled={addUnit.isPending}
            className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-soft-xs hover:bg-purple-700 disabled:opacity-50"
          >
            {addUnit.isPending ? 'Adding…' : 'Save Unit'}
          </button>
          <button
            type="button"
            onClick={() => setAddingUnit(false)}
            className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setAddingUnit(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 py-3.5 text-xs font-bold text-slate-600 hover:border-purple-300 hover:bg-purple-50/40 hover:text-purple-700 transition-all shadow-soft-xs"
        >
          <FolderPlus className="h-4 w-4" />
          <span>Add New Curriculum Unit</span>
        </button>
      )}
    </div>
  );
}

function UnitCard({
  unit,
  unitIndex,
  curriculumStatus,
  allTopics,
  onChanged,
  onOpenWorksheet,
  onMoveUp,
  onMoveDown,
}: {
  unit: CurriculumUnit;
  unitIndex: number;
  curriculumStatus: string;
  allTopics: CurriculumTopic[];
  onChanged: () => void;
  onOpenWorksheet: (topic: { id: number; title: string }) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(unit.title);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [addingTopic, setAddingTopic] = useState(false);

  const rename = useMutation({
    mutationFn: async () => {
      await api.patch(`/curriculum-units/${unit.id}`, { title });
    },
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      await api.delete(`/curriculum-units/${unit.id}`);
    },
    onSuccess: onChanged,
  });

  const addTopic = useMutation({
    mutationFn: async () => {
      await api.post(`/curriculum-units/${unit.id}/topics`, { title: newTopicTitle, estimatedLessonCount: 3 });
    },
    onSuccess: () => {
      setNewTopicTitle('');
      setAddingTopic(false);
      onChanged();
    },
  });

  function moveTopic(index: number, direction: -1 | 1) {
    const target = unit.topics[index + direction];
    const current = unit.topics[index];
    if (!target) return;
    api.patch(`/curriculum-topics/${current.id}`, { sortOrder: index + direction }).then(onChanged);
    api.patch(`/curriculum-topics/${target.id}`, { sortOrder: index }).then(onChanged);
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-soft-xl overflow-hidden">
      {/* Unit Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-700 transition-colors p-0.5"
            title={isExpanded ? 'Collapse Unit' : 'Expand Unit'}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tl from-purple-700 to-pink-500 text-[11px] font-bold text-white shrink-0 shadow-soft-xs">
            {unitIndex}
          </span>

          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                rename.mutate();
              }}
              className="flex flex-1 items-center gap-2"
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={rename.isPending}
                className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg bg-white border border-slate-200 px-2 py-1 text-xs text-slate-600"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h3 className="font-bold text-sm text-slate-800 truncate">{unit.title}</h3>
              <ConfidencePill confidence={unit.confidence} />
              <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {unit.topics.length} {unit.topics.length === 1 ? 'topic' : 'topics'}
              </span>
            </div>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-1.5 text-xs">
            {onMoveUp && (
              <button
                onClick={onMoveUp}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
                title="Move Unit Up"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            )}
            {onMoveDown && (
              <button
                onClick={onMoveDown}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
                title="Move Unit Down"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
              title="Rename Unit"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete unit "${unit.title}"? This deletes all associated topics.`)) remove.mutate();
              }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              title="Delete Unit"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Unit Topics Content */}
      {isExpanded && (
        <div className="p-5 space-y-3">
          {unit.topics.map((topic, index) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              topicNumber={`${unitIndex}.${index + 1}`}
              curriculumStatus={curriculumStatus}
              allTopics={allTopics}
              onChanged={onChanged}
              onOpenWorksheet={onOpenWorksheet}
              onMoveUp={index > 0 ? () => moveTopic(index, -1) : undefined}
              onMoveDown={index < unit.topics.length - 1 ? () => moveTopic(index, 1) : undefined}
            />
          ))}

          {addingTopic ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addTopic.mutate();
              }}
              className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50/40 p-3"
            >
              <input
                required
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="e.g. Quadratic Equations & Factoring Methods…"
                aria-label="New topic title"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={addTopic.isPending}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700"
              >
                {addTopic.isPending ? 'Adding…' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => setAddingTopic(false)}
                className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setAddingTopic(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-2.5 text-xs font-bold text-slate-500 hover:border-purple-300 hover:bg-purple-50/40 hover:text-purple-700 transition-all"
            >
              <ListPlus className="h-3.5 w-3.5" />
              <span>Add Topic to Unit {unitIndex}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const TOPIC_STATUS_BADGE: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  pending: { label: 'Pending', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  generating: { label: 'Generating…', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  generated: { label: 'Lessons Ready', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  failed: { label: 'Failed', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

function TopicRow({
  topic,
  topicNumber,
  curriculumStatus,
  allTopics,
  onChanged,
  onOpenWorksheet,
  onMoveUp,
  onMoveDown,
}: {
  topic: CurriculumTopic;
  topicNumber: string;
  curriculumStatus: string;
  allTopics: CurriculumTopic[];
  onChanged: () => void;
  onOpenWorksheet: (topic: { id: number; title: string }) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(topic.title);
  const [newObjective, setNewObjective] = useState('');
  const [prereqChoice, setPrereqChoice] = useState('');
  const [genError, setGenError] = useState<string | null>(null);

  const rename = useMutation({
    mutationFn: async () => {
      await api.patch(`/curriculum-topics/${topic.id}`, { title });
    },
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      await api.delete(`/curriculum-topics/${topic.id}`);
    },
    onSuccess: onChanged,
  });

  const addObjective = useMutation({
    mutationFn: async () => {
      await api.post(`/curriculum-topics/${topic.id}/objectives`, { description: newObjective });
    },
    onSuccess: () => {
      setNewObjective('');
      onChanged();
    },
  });

  const removeObjective = useMutation({
    mutationFn: async (objectiveId: number) => {
      await api.delete(`/curriculum-objectives/${objectiveId}`);
    },
    onSuccess: onChanged,
  });

  const addPrerequisite = useMutation({
    mutationFn: async () => {
      await api.post(`/curriculum-topics/${topic.id}/prerequisites`, { requiresTopicId: Number(prereqChoice) });
    },
    onSuccess: () => {
      setPrereqChoice('');
      onChanged();
    },
  });

  const removePrerequisite = useMutation({
    mutationFn: async (prerequisiteId: number) => {
      await api.delete(`/curriculum-prerequisites/${prerequisiteId}`);
    },
    onSuccess: onChanged,
  });

  const generateLessons = useMutation({
    mutationFn: async () => {
      await api.post(`/curriculum-topics/${topic.id}/generate-lessons`);
    },
    onSuccess: () => {
      setGenError(null);
      onChanged();
    },
    onError: (err) => setGenError(apiErrorBody(err)?.message ?? 'Failed to generate lessons.'),
  });

  const otherTopics = allTopics.filter((t) => t.id !== topic.id && !topic.prerequisites.some((p) => p.requiresTopic.id === t.id));
  const canGenerate = ['awaiting_approval', 'generating_lessons', 'ready'].includes(curriculumStatus);
  const statusBadge = TOPIC_STATUS_BADGE[topic.lessonPlanStatus] || {
    label: topic.lessonPlanStatus,
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50/70 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <button
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="text-slate-400 hover:text-slate-700 transition-colors p-0.5 shrink-0"
            title={expanded ? 'Collapse Topic' : 'Expand Details'}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          <span className="text-[11px] font-extrabold text-purple-700 shrink-0">
            {topicNumber}
          </span>

          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                rename.mutate();
              }}
              className="flex flex-1 items-center gap-2"
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={rename.isPending}
                className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg bg-white border border-slate-200 px-2 py-1 text-xs text-slate-600"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="font-bold text-xs text-slate-800 truncate">
                <RichContent content={topic.title} className="inline" />
              </span>
              <ConfidencePill confidence={topic.confidence} />
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
              >
                {statusBadge.label}
              </span>
              {topic.lessons?.length > 0 && (
                <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-100">
                  {topic.lessons.length} {topic.lessons.length === 1 ? 'lesson' : 'lessons'}
                </span>
              )}
            </div>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-1.5 text-xs">
            {/* Quick Practice Worksheet Button with Math Preservation */}
            <button
              type="button"
              onClick={() => onOpenWorksheet({ id: topic.id, title: topic.title })}
              className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100 shadow-soft-xs transition-colors"
              title="Generate printable practice worksheet with math KaTeX preservation"
            >
              <Printer className="h-3 w-3" />
              <span>Worksheet</span>
            </button>

            {onMoveUp && (
              <button
                onClick={onMoveUp}
                className="rounded p-1 text-slate-400 hover:text-slate-700 transition-colors"
                title="Move Topic Up"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            )}
            {onMoveDown && (
              <button
                onClick={onMoveDown}
                className="rounded p-1 text-slate-400 hover:text-slate-700 transition-colors"
                title="Move Topic Down"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="rounded p-1 text-slate-400 hover:text-purple-600 transition-colors"
              title="Rename Topic"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete topic "${topic.title}"?`)) remove.mutate();
              }}
              className="rounded p-1 text-slate-400 hover:text-rose-600 transition-colors"
              title="Delete Topic"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Expanded Topic Details Panel */}
      {expanded && (
        <div className="space-y-4 border-t border-slate-200/80 bg-white p-4 text-xs">
          {topic.description && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-slate-700 leading-relaxed">
              <RichContent content={topic.description} />
            </div>
          )}

          {topic.sourceExcerpt && (
            <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-3 italic text-slate-600 text-[11px]">
              <span className="font-bold not-italic text-purple-700 block mb-0.5">Syllabus Excerpt:</span>
              <RichContent content={topic.sourceExcerpt} />
            </div>
          )}

          {/* Skills & Objectives Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Learning Objectives & Competencies</span>
            </div>

            {topic.skills?.map((skill) => (
              <div key={skill.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1.5">
                <span className="font-bold text-xs text-purple-900">{skill.title}</span>
                <ul className="space-y-1 pl-2">
                  {skill.objectives?.map((o) => (
                    <li key={o.id} className="flex items-start justify-between gap-2 text-slate-700">
                      <div className="flex items-start gap-1.5 flex-1">
                        <span className="text-emerald-500 font-bold">•</span>
                        <RichContent content={o.description} />
                      </div>
                      <button
                        onClick={() => removeObjective.mutate(o.id)}
                        className="shrink-0 text-[10px] font-bold text-rose-500 hover:underline"
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {topic.objectives?.length > 0 && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 space-y-1.5">
                {topic.objectives.map((o) => (
                  <div key={o.id} className="flex items-start justify-between gap-2 text-slate-700">
                    <div className="flex items-start gap-1.5 flex-1">
                      <span className="text-emerald-500 font-bold">•</span>
                      <RichContent content={o.description} />
                    </div>
                    <button
                      onClick={() => removeObjective.mutate(o.id)}
                      className="shrink-0 text-[10px] font-bold text-rose-500 hover:underline"
                    >
                      remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addObjective.mutate();
              }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                required
                value={newObjective}
                onChange={(e) => setNewObjective(e.target.value)}
                placeholder="Add a new learning objective (LaTeX math supported, e.g. $f(x) = ax^2 + bx + c$)…"
                aria-label="New learning objective"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
              <button
                type="submit"
                disabled={addObjective.isPending}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900 shrink-0"
              >
                Add Objective
              </button>
            </form>
          </div>

          {/* Prerequisites Graph */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <span className="block text-xs font-bold text-slate-700">Prerequisite Topics</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {topic.prerequisites.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                >
                  <span>{p.requiresTopic.title}</span>
                  <button
                    onClick={() => removePrerequisite.mutate(p.id)}
                    className="text-slate-400 hover:text-rose-600 font-bold ml-1"
                    title="Remove prerequisite"
                  >
                    ×
                  </button>
                </span>
              ))}
              {topic.prerequisites.length === 0 && (
                <span className="text-slate-400 text-[11px]">No prerequisites required (Foundational topic)</span>
              )}
            </div>

            {otherTopics.length > 0 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addPrerequisite.mutate();
                }}
                className="flex items-center gap-2 pt-1"
              >
                <select
                  value={prereqChoice}
                  onChange={(e) => setPrereqChoice(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="">Select prerequisite topic…</option>
                  {otherTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!prereqChoice || addPrerequisite.isPending}
                  className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                >
                  Add Prerequisite
                </button>
              </form>
            )}
          </div>

          {/* Generated Lessons & Assessment Details */}
          {topic.lessons?.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Lesson Sequence ({topic.lessons.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  Total time: {topic.lessons.reduce((a, b) => a + b.estimatedMinutes, 0)} mins
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {topic.lessons.map((lesson, lIdx) => (
                  <div
                    key={lesson.id}
                    className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 shadow-soft-xs"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700 shrink-0">
                      {lIdx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-slate-800 truncate">{lesson.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="capitalize">{lesson.lessonType}</span>
                        <span>•</span>
                        <span>{lesson.estimatedMinutes} mins</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {topic.assessment && (
                <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3 space-y-1.5 mt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                    <span>Topic Assessment: {topic.assessment.title}</span>
                    <span>{topic.assessment.questions.length} questions</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {topic.assessment.questions.slice(0, 3).map((q, qIdx) => (
                      <div key={q.id} className="text-[11px] text-slate-700 flex items-start gap-1.5">
                        <span className="font-bold text-purple-600 shrink-0">Q{qIdx + 1}:</span>
                        <RichContent content={q.prompt} />
                      </div>
                    ))}
                    {topic.assessment.questions.length > 3 && (
                      <p className="text-[10px] text-slate-400 italic">
                        +{topic.assessment.questions.length - 3} more questions in quiz bank
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Row */}
          {canGenerate && (
            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                onClick={() => generateLessons.mutate()}
                disabled={generateLessons.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50 shadow-soft-xs"
              >
                {generateLessons.isPending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Generating…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                    <span>{topic.lessonPlanStatus === 'generated' ? 'Regenerate Topic Lessons' : 'Generate Topic Lessons'}</span>
                  </>
                )}
              </button>

              {genError && <p className="text-xs text-rose-600 font-semibold">{genError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
