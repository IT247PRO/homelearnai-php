import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../components/AppLayout';
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

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  analyzing: 'Analyzing…',
  outline_generated: 'Outline ready for review',
  awaiting_approval: 'Outline approved — ready to build lessons',
  generating_lessons: 'Generating lessons…',
  ready: 'Ready to schedule',
  archived: 'Archived',
  failed: 'Analysis failed',
};

const CONFIDENCE_BADGE: Record<string, string> = {
  explicit: 'bg-emerald-100 text-emerald-800',
  inferred: 'bg-amber-100 text-amber-800',
};

function ConfidenceBadge({ confidence }: { confidence: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${CONFIDENCE_BADGE[confidence] ?? 'bg-slate-100 text-slate-600'}`}>
      {confidence === 'explicit' ? 'From source' : confidence === 'inferred' ? 'AI-inferred' : confidence}
    </span>
  );
}

export default function CurriculumOutlinePage() {
  const { id } = useParams<{ id: string }>();
  const curriculumId = Number(id);
  const [searchParams] = useSearchParams();
  const childId = searchParams.get('childId');
  const queryClient = useQueryClient();

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
        <p className="text-sm text-slate-500">Loading…</p>
      </AppLayout>
    );
  }

  const curriculum = curriculumQuery.data;
  const allTopics = curriculum.units.flatMap((u) => u.topics);

  return (
    <AppLayout>
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{curriculum.title}</h1>
          <p className="text-sm text-slate-500">
            {curriculum.subjectArea}
            {curriculum.gradeLevel ? ` · Grade ${curriculum.gradeLevel}` : ''}
            {curriculum.schoolYear ? ` · ${curriculum.schoolYear}` : ''}
          </p>
        </div>
        <span className="whitespace-nowrap rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
          {STATUS_LABELS[curriculum.status] ?? curriculum.status}
        </span>
      </div>

      {curriculum.sourceUrl && (
        <a href={curriculum.sourceUrl} target="_blank" rel="noreferrer" className="mb-4 inline-block text-xs text-brand-600 hover:underline">
          Source: {curriculum.sourceName ?? curriculum.sourceUrl}
        </a>
      )}

      <MasteryThresholdControl curriculum={curriculum} onSaved={invalidate} />

      {(curriculum.status === 'draft' || curriculum.status === 'failed' || curriculum.status === 'analyzing') && (
        <AnalyzeSection curriculumId={curriculumId} status={curriculum.status} onDone={invalidate} />
      )}

      {qualityQuery.data && qualityQuery.data.length > 0 && (
        <div className="mb-4 space-y-1 rounded border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase text-amber-800">Quality check</p>
          {qualityQuery.data.map((w, i) => (
            <p key={i} className="text-xs text-amber-900">
              {w.severity === 'warning' ? '⚠️' : 'ℹ️'} {w.message}
            </p>
          ))}
        </div>
      )}

      {curriculum.units.length > 0 && (
        <OutlineTree curriculum={curriculum} allTopics={allTopics} onChanged={invalidate} />
      )}

      {curriculum.status === 'outline_generated' && <ApproveOutlineSection curriculumId={curriculumId} onDone={invalidate} />}

      {['awaiting_approval', 'generating_lessons', 'ready'].includes(curriculum.status) && (
        <BuildLearningPlanSection curriculum={curriculum} onProgress={invalidate} />
      )}

      {curriculum.status === 'ready' && <AdoptSection curriculumId={curriculumId} initialChildId={childId} />}
    </AppLayout>
  );
}

function MasteryThresholdControl({ curriculum, onSaved }: { curriculum: CurriculumDetail; onSaved: () => void }) {
  const [value, setValue] = useState(curriculum.masteryThresholdPercent);
  const save = useMutation({
    mutationFn: async () => {
      await api.patch(`/curricula/${curriculum.id}`, { masteryThresholdPercent: value });
    },
    onSuccess: onSaved,
  });

  return (
    <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
      <label htmlFor="mastery-threshold">Mastery threshold:</label>
      <input
        id="mastery-threshold"
        type="number"
        min={1}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-16 rounded border border-slate-300 px-2 py-1"
      />
      <span>%</span>
      {value !== curriculum.masteryThresholdPercent && (
        <button onClick={() => save.mutate()} disabled={save.isPending} className="text-xs text-brand-600 hover:underline">
          Save
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
    <div className="mb-4 rounded border border-slate-200 bg-white p-4">
      <p className="mb-2 text-sm text-slate-600">
        {status === 'failed'
          ? 'The last analysis attempt failed. You can retry it below.'
          : 'This curriculum has not been analyzed yet.'}
      </p>
      <button
        onClick={() => analyze.mutate()}
        disabled={analyze.isPending || status === 'analyzing'}
        className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
      >
        {analyze.isPending ? 'Analyzing…' : 'Analyze Curriculum'}
      </button>
      {notConfigured && <p className="mt-2 text-xs text-amber-800">{notConfigured}</p>}
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
    <div className="mb-4 rounded border border-brand-200 bg-brand-50 p-4">
      <p className="mb-2 text-sm text-slate-700">
        Review the outline above — rename, reorder, add, or delete units and topics as needed. Once you're happy with it, approve
        it to move on to lesson generation.
      </p>
      <button
        onClick={() => approve.mutate()}
        disabled={approve.isPending}
        className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {approve.isPending ? 'Approving…' : 'Approve Outline'}
      </button>
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
      <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        ✓ Every topic has a generated lesson sequence and assessment. This curriculum is ready to schedule.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded border border-slate-200 bg-white p-4">
      <p className="mb-2 text-sm text-slate-600">
        Generate a lesson sequence and assessment for each topic ({allTopics.length - pending.length}/{allTopics.length} done).
      </p>
      {building && (
        <div className="mb-2 h-2 w-full overflow-hidden rounded bg-slate-100">
          <div
            className="h-full bg-brand-600 transition-all"
            style={{ width: `${allTopics.length > 0 ? ((allTopics.length - pending.length + done) / allTopics.length) * 100 : 0}%` }}
          />
        </div>
      )}
      <button
        onClick={buildAll}
        disabled={building}
        className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {building ? `Generating lessons… (${done}/${pending.length})` : 'Build Learning Plan'}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
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
    <div className="mb-4 rounded border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-lg font-semibold text-slate-900">Schedule for a child</h2>

      {!studyPlan && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="adopt-child" className="block text-sm text-slate-700">
              Child
            </label>
            <select
              id="adopt-child"
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
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
            className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {adopt.isPending ? 'Building schedule…' : "Add to this child's schedule"}
          </button>
          {adopt.isError && (
            <p className="text-xs text-red-600">
              {apiErrorBody(adopt.error)?.error === 'already_adopted'
                ? 'This child already has this curriculum. See their curriculum page for progress.'
                : 'Could not schedule this curriculum.'}
            </p>
          )}
        </div>
      )}

      {studyPlan && (
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <p className="font-medium text-slate-900">{studyPlan.name}</p>
          <p className="text-sm text-slate-500">
            Status: {studyPlan.status} · {studyPlan.items.length} lesson(s)
          </p>
          {studyPlan.status === 'pending_approval' && (
            <button
              onClick={() => approve.mutate()}
              disabled={approve.isPending}
              className="mt-3 rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {approve.isPending ? 'Approving…' : 'Approve and schedule'}
            </button>
          )}
          {studyPlan.status === 'active' && (
            <>
              <p className="mt-2 text-sm text-emerald-700">✓ Scheduled — sessions are on the child's Planning board.</p>
              <div className="mt-3 flex gap-3 text-sm">
                <Link to={`/children/${selectedChildId}/planning`} className="text-brand-600 hover:underline">
                  Open Planning board
                </Link>
                <Link to={`/children/${selectedChildId}`} className="text-brand-600 hover:underline">
                  Open child's curriculum page
                </Link>
              </div>
              <CoveragePanel childId={Number(selectedChildId)} curriculumId={curriculumId} />
            </>
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
    <div className="mt-3 rounded border border-slate-200 bg-white p-3 text-sm">
      <p className="mb-1 font-medium text-slate-700">Coverage</p>
      <p className="text-slate-600">
        {c.masteredTopics}/{c.totalTopics} topics mastered ({c.percentComplete}%) · {c.completedLessons}/{c.totalLessons} lessons completed
      </p>
    </div>
  );
}

function OutlineTree({ curriculum, allTopics, onChanged }: { curriculum: CurriculumDetail; allTopics: CurriculumTopic[]; onChanged: () => void }) {
  const [newUnitTitle, setNewUnitTitle] = useState('');

  const addUnit = useMutation({
    mutationFn: async () => {
      await api.post(`/curricula/${curriculum.id}/units`, { title: newUnitTitle });
    },
    onSuccess: () => {
      setNewUnitTitle('');
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
    <div className="mb-4 space-y-3">
      {curriculum.units.map((unit, index) => (
        <UnitCard
          key={unit.id}
          unit={unit}
          curriculumStatus={curriculum.status}
          allTopics={allTopics}
          onChanged={onChanged}
          onMoveUp={index > 0 ? () => moveUnit(index, -1) : undefined}
          onMoveDown={index < curriculum.units.length - 1 ? () => moveUnit(index, 1) : undefined}
        />
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addUnit.mutate();
        }}
        className="flex items-end gap-2"
      >
        <input
          required
          value={newUnitTitle}
          onChange={(e) => setNewUnitTitle(e.target.value)}
          placeholder="New unit title"
          aria-label="New unit title"
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-800">
          Add unit
        </button>
      </form>
    </div>
  );
}

function UnitCard({
  unit,
  curriculumStatus,
  allTopics,
  onChanged,
  onMoveUp,
  onMoveDown,
}: {
  unit: CurriculumUnit;
  curriculumStatus: string;
  allTopics: CurriculumTopic[];
  onChanged: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(unit.title);
  const [newTopicTitle, setNewTopicTitle] = useState('');

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
    <div className="rounded border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              rename.mutate();
            }}
            className="flex flex-1 gap-2"
          >
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
            <button type="submit" className="text-xs text-brand-600 hover:underline">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:underline">
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <ConfidenceBadge confidence={unit.confidence} />
            <span className="font-semibold text-slate-900">{unit.title}</span>
          </div>
        )}
        {!editing && (
          <div className="flex items-center gap-2 text-xs">
            {onMoveUp && (
              <button onClick={onMoveUp} className="text-slate-400 hover:text-slate-700">
                ↑
              </button>
            )}
            {onMoveDown && (
              <button onClick={onMoveDown} className="text-slate-400 hover:text-slate-700">
                ↓
              </button>
            )}
            <button onClick={() => setEditing(true)} className="text-brand-600 hover:underline">
              Rename
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete "${unit.title}"? This removes all of its topics.`)) remove.mutate();
              }}
              className="text-red-600 hover:underline"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2 p-4">
        {unit.topics.map((topic, index) => (
          <TopicRow
            key={topic.id}
            topic={topic}
            curriculumStatus={curriculumStatus}
            allTopics={allTopics}
            onChanged={onChanged}
            onMoveUp={index > 0 ? () => moveTopic(index, -1) : undefined}
            onMoveDown={index < unit.topics.length - 1 ? () => moveTopic(index, 1) : undefined}
          />
        ))}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            addTopic.mutate();
          }}
          className="flex items-end gap-2"
        >
          <input
            required
            value={newTopicTitle}
            onChange={(e) => setNewTopicTitle(e.target.value)}
            placeholder="New topic title"
            aria-label="New topic title"
            className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200">
            Add topic
          </button>
        </form>
      </div>
    </div>
  );
}

const LESSON_STATUS_LABELS: Record<string, string> = {
  pending: 'Lessons not generated yet',
  generating: 'Generating…',
  generated: 'Lessons generated',
  failed: 'Generation failed',
};

function TopicRow({
  topic,
  curriculumStatus,
  allTopics,
  onChanged,
  onMoveUp,
  onMoveDown,
}: {
  topic: CurriculumTopic;
  curriculumStatus: string;
  allTopics: CurriculumTopic[];
  onChanged: () => void;
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

  return (
    <div className="rounded border border-slate-100 bg-slate-50">
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              rename.mutate();
            }}
            className="flex flex-1 gap-2"
          >
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
            <button type="submit" className="text-xs text-brand-600 hover:underline">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:underline">
              Cancel
            </button>
          </form>
        ) : (
          <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="flex flex-1 items-center gap-2 text-left">
            <ConfidenceBadge confidence={topic.confidence} />
            <span className="text-slate-800">{topic.title}</span>
            <span className="text-xs text-slate-400">
              {topic.estimatedLessonCount ? `~${topic.estimatedLessonCount} lessons` : ''} · {LESSON_STATUS_LABELS[topic.lessonPlanStatus]}
            </span>
          </button>
        )}
        {!editing && (
          <div className="flex items-center gap-2 text-xs">
            {onMoveUp && (
              <button onClick={onMoveUp} className="text-slate-400 hover:text-slate-700">
                ↑
              </button>
            )}
            {onMoveDown && (
              <button onClick={onMoveDown} className="text-slate-400 hover:text-slate-700">
                ↓
              </button>
            )}
            <button onClick={() => setEditing(true)} className="text-brand-600 hover:underline">
              Rename
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete "${topic.title}"?`)) remove.mutate();
              }}
              className="text-red-600 hover:underline"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-slate-200 p-3 text-sm">
          {topic.description && <p className="text-slate-600">{topic.description}</p>}
          {topic.sourceExcerpt && <p className="italic text-slate-400">"{topic.sourceExcerpt}"</p>}

          {topic.skills.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Skills &amp; objectives</p>
              <ul className="space-y-1">
                {topic.skills.map((skill) => (
                  <li key={skill.id}>
                    <span className="font-medium text-slate-700">{skill.title}</span>
                    <ul className="ml-4 list-disc text-slate-600">
                      {skill.objectives.map((o) => (
                        <li key={o.id} className="flex items-start justify-between gap-2">
                          <span>{o.description}</span>
                          <button onClick={() => removeObjective.mutate(o.id)} className="shrink-0 text-xs text-red-500 hover:underline">
                            remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {topic.objectives.length > 0 && (
            <ul className="ml-4 list-disc text-slate-600">
              {topic.objectives.map((o) => (
                <li key={o.id} className="flex items-start justify-between gap-2">
                  <span>{o.description}</span>
                  <button onClick={() => removeObjective.mutate(o.id)} className="shrink-0 text-xs text-red-500 hover:underline">
                    remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addObjective.mutate();
            }}
            className="flex items-end gap-2"
          >
            <input
              required
              value={newObjective}
              onChange={(e) => setNewObjective(e.target.value)}
              placeholder="Add a learning objective…"
              aria-label="New learning objective"
              className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
            />
            <button type="submit" className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-300">
              Add
            </button>
          </form>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Prerequisites</p>
            <div className="flex flex-wrap gap-1">
              {topic.prerequisites.map((p) => (
                <span key={p.id} className="flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                  {p.requiresTopic.title}
                  <button onClick={() => removePrerequisite.mutate(p.id)} className="text-slate-500 hover:text-red-600">
                    &times;
                  </button>
                </span>
              ))}
              {topic.prerequisites.length === 0 && <span className="text-xs text-slate-400">None</span>}
            </div>
            {otherTopics.length > 0 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addPrerequisite.mutate();
                }}
                className="mt-1 flex items-end gap-2"
              >
                <select value={prereqChoice} onChange={(e) => setPrereqChoice(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs">
                  <option value="">Add prerequisite…</option>
                  {otherTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={!prereqChoice} className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-300 disabled:opacity-50">
                  Add
                </button>
              </form>
            )}
          </div>

          {canGenerate && (
            <div>
              <button
                onClick={() => generateLessons.mutate()}
                disabled={generateLessons.isPending}
                className="rounded bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {generateLessons.isPending
                  ? 'Generating…'
                  : topic.lessonPlanStatus === 'generated'
                    ? 'Regenerate lessons'
                    : 'Generate lessons'}
              </button>
              {genError && <p className="mt-1 text-xs text-red-600">{genError}</p>}
            </div>
          )}

          {topic.lessons.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Lessons ({topic.lessons.length})</p>
              <ol className="ml-4 list-decimal space-y-0.5 text-slate-700">
                {topic.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    {lesson.title} <span className="text-xs text-slate-400">({lesson.lessonType}, {lesson.estimatedMinutes} min)</span>
                  </li>
                ))}
              </ol>
              {topic.assessment && (
                <p className="mt-1 text-xs text-slate-500">
                  Topic assessment: {topic.assessment.title} ({topic.assessment.questions.length} questions)
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
