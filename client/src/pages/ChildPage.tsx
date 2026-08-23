import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../components/AppLayout';
import { OcclusionEditor, type OcclusionBox } from '../components/OcclusionEditor';
import { RichContent } from '../components/RichContent';
import { LessonsAndAssessmentsSection } from '../components/LessonsAndAssessments';
import { MasterySection } from '../components/MasterySection';
import { LearningProfileSection } from '../components/LearningProfileSection';
import { InsightsSection } from '../components/InsightsSection';
import { TutorChat } from '../components/TutorChat';
import { api, apiErrorBody } from '../lib/api';

interface Subject {
  id: number;
  name: string;
  color: string;
}
interface Unit {
  id: number;
  name: string;
}
interface Topic {
  id: number;
  title: string;
  estimatedMinutes: number;
}
interface Flashcard {
  id: number;
  cardType: string;
  question: string;
  answer: string;
  choices: string[] | null;
  correctChoices: string[] | null;
  clozeText: string | null;
  clozeAnswers: string[] | null;
  questionImageUrl: string | null;
  occlusionData: OcclusionBox[] | null;
}

export default function ChildPage() {
  const { childId } = useParams<{ childId: string }>();

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Curriculum</h1>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link to={`/children/${childId}/planning`} className="rounded bg-slate-700 px-3 py-2 text-white hover:bg-slate-800">
            Planning board
          </Link>
          <Link to={`/children/${childId}/review`} className="rounded bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700">
            Review flashcards
          </Link>
          <Link to={`/children/${childId}/ai`} className="rounded bg-purple-600 px-3 py-2 text-white hover:bg-purple-700">
            AI curriculum generator
          </Link>
          <Link to={`/curricula/new?childId=${childId}`} className="rounded bg-purple-100 px-3 py-2 text-purple-800 hover:bg-purple-200">
            Import curriculum
          </Link>
          <EnterKidsModeButton childId={Number(childId)} />
        </div>
      </div>
      <SubjectsSection childId={Number(childId)} />
      <LearningProfileSection childId={Number(childId)} />
      <MasterySection childId={Number(childId)} />
      <InsightsSection childId={Number(childId)} />
      <SessionsSection childId={Number(childId)} />
      <ScheduleSection childId={Number(childId)} />
      <CatchUpSection childId={Number(childId)} />
      <ReviewSlotsSection childId={Number(childId)} />
    </AppLayout>
  );
}

function EnterKidsModeButton({ childId }: { childId: number }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const enterMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/kids-mode/${childId}/enter`, { pin });
    },
    onSuccess: () => navigate('/kids'),
    onError: (err) => setError(apiErrorBody(err)?.error ?? 'Could not enter Kids Mode'),
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded bg-amber-500 px-3 py-2 text-white hover:bg-amber-600">
        Enter Kids Mode
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        enterMutation.mutate();
      }}
      className="flex items-center gap-2"
    >
      <input
        type="password"
        inputMode="numeric"
        placeholder="PIN"
        aria-label="Kids Mode PIN"
        required
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="w-20 rounded border border-slate-300 px-2 py-2"
        autoFocus
      />
      <button type="submit" className="rounded bg-amber-500 px-3 py-2 text-white hover:bg-amber-600">
        Go
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}

interface TimeBlockItem {
  id: number;
  label: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  commitmentType: string;
  isImported: boolean;
}

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function ScheduleSection({ childId }: { childId: number }) {
  const timeBlocksQuery = useQuery({
    queryKey: ['children', childId, 'time-blocks'],
    queryFn: async () => {
      const { data } = await api.get<{ data: TimeBlockItem[] }>(`/children/${childId}/time-blocks`);
      return data.data;
    },
  });

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Schedule</h2>
        <Link to={`/children/${childId}/calendar`} className="rounded bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700">
          Open full calendar
        </Link>
      </div>

      <div className="space-y-2">
        {timeBlocksQuery.data?.map((tb) => (
          <div key={tb.id} className="flex items-center justify-between rounded border border-slate-200 bg-white px-4 py-2 text-sm">
            <span>
              {tb.label} — {DAY_NAMES[tb.dayOfWeek]} {tb.startTime}-{tb.endTime}
              <span className="ml-2 text-xs uppercase text-slate-400">{tb.commitmentType}</span>
            </span>
            {tb.isImported && <span className="text-xs text-slate-400">imported</span>}
          </div>
        ))}
        {timeBlocksQuery.data?.length === 0 && (
          <p className="text-sm text-slate-500">
            No time blocks yet — <Link to={`/children/${childId}/calendar`} className="text-brand-600 hover:underline">add one on the calendar</Link>.
          </p>
        )}
      </div>
    </section>
  );
}

interface CatchUp {
  id: number;
  priority: number;
  status: string;
  missedDate: string;
  reason: string | null;
  topic: { title: string };
}

interface LearningSessionItem {
  id: number;
  estimatedMinutes: number;
  status: string;
  scheduledDate: string | null;
  topic: { title: string };
}

interface QualityWarning {
  code: string;
  message: string;
}

function SessionsSection({ childId }: { childId: number }) {
  const queryClient = useQueryClient();
  const [dates, setDates] = useState<Record<number, string>>({});
  const [warningsBySession, setWarningsBySession] = useState<Record<number, QualityWarning[]>>({});
  const [suggestionsBySession, setSuggestionsBySession] = useState<Record<number, Array<{ date: string; currentLoad: number }>>>({});

  const sessionsQuery = useQuery({
    queryKey: ['children', childId, 'learning-sessions'],
    queryFn: async () => {
      const { data } = await api.get<{ data: LearningSessionItem[] }>(`/children/${childId}/learning-sessions`);
      return data.data.filter((s) => s.status === 'backlog' || s.status === 'planned');
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['children', childId, 'learning-sessions'] });

  const schedule = useMutation({
    mutationFn: async (sessionId: number) => {
      const date = dates[sessionId];
      const { data } = await api.patch(`/learning-sessions/${sessionId}/schedule`, {
        scheduledDate: new Date(date).toISOString(),
      });
      return { sessionId, warnings: data.warnings as QualityWarning[] };
    },
    onSuccess: ({ sessionId, warnings }) => {
      setWarningsBySession((prev) => ({ ...prev, [sessionId]: warnings }));
      invalidate();
    },
  });

  const fetchSuggestions = useMutation({
    mutationFn: async (sessionId: number) => {
      const { data } = await api.get(`/learning-sessions/${sessionId}/reschedule-suggestions`);
      return { sessionId, suggestions: data.data as Array<{ date: string; currentLoad: number }> };
    },
    onSuccess: ({ sessionId, suggestions }) => setSuggestionsBySession((prev) => ({ ...prev, [sessionId]: suggestions })),
  });

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-slate-900">Sessions to Schedule</h2>
      <div className="space-y-3">
        {sessionsQuery.data?.map((session) => (
          <div key={session.id} className="rounded border border-slate-200 bg-white p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {session.topic.title} <span className="text-slate-400">({session.estimatedMinutes} min)</span>
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label={`Schedule date for ${session.topic.title}`}
                  value={dates[session.id] ?? ''}
                  onChange={(e) => setDates((prev) => ({ ...prev, [session.id]: e.target.value }))}
                  className="rounded border border-slate-300 px-2 py-1"
                />
                <button
                  onClick={() => schedule.mutate(session.id)}
                  disabled={!dates[session.id] || schedule.isPending}
                  className="rounded bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Schedule
                </button>
                <button onClick={() => fetchSuggestions.mutate(session.id)} className="text-brand-600 hover:underline">
                  Suggest days
                </button>
              </div>
            </div>

            {warningsBySession[session.id]?.map((w) => (
              <p key={w.code} className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                ⚠️ {w.message}
              </p>
            ))}

            {suggestionsBySession[session.id] && (
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestionsBySession[session.id].map((s) => (
                  <button
                    key={s.date}
                    onClick={() => setDates((prev) => ({ ...prev, [session.id]: s.date.slice(0, 10) }))}
                    className="rounded-full border border-slate-300 px-2 py-1 text-xs hover:border-brand-500"
                  >
                    {new Date(s.date).toLocaleDateString()} ({s.currentLoad} scheduled)
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {sessionsQuery.data?.length === 0 && <p className="text-sm text-slate-500">No sessions waiting to be scheduled.</p>}
      </div>
    </section>
  );
}

function CatchUpSection({ childId }: { childId: number }) {
  const queryClient = useQueryClient();

  const catchUpsQuery = useQuery({
    queryKey: ['children', childId, 'catch-up-sessions'],
    queryFn: async () => {
      const { data } = await api.get<{ data: CatchUp[] }>(`/children/${childId}/catch-up-sessions`);
      return data.data;
    },
  });

  const redistributeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/children/${childId}/catch-up-sessions/redistribute`);
      return data.data as { reassigned: number; stillPending: number };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['children', childId, 'catch-up-sessions'] }),
  });

  const pending = catchUpsQuery.data?.filter((c) => c.status === 'pending') ?? [];

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Catch-Up</h2>
        {pending.length > 0 && (
          <button
            onClick={() => redistributeMutation.mutate()}
            disabled={redistributeMutation.isPending}
            className="rounded bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Redistribute {pending.length} missed session(s)
          </button>
        )}
      </div>
      <div className="space-y-2">
        {catchUpsQuery.data?.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded border border-slate-200 bg-white px-4 py-2 text-sm">
            <span>
              {c.topic.title} — missed {new Date(c.missedDate).toLocaleDateString()}
            </span>
            <span className="text-xs uppercase text-slate-400">{c.status}</span>
          </div>
        ))}
        {catchUpsQuery.data?.length === 0 && <p className="text-sm text-slate-500">No missed sessions.</p>}
      </div>
    </section>
  );
}

const DAY_NAMES_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface ReviewSlot {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotType: string;
  isActive: boolean;
}

function ReviewSlotsSection({ childId }: { childId: number }) {
  const queryClient = useQueryClient();
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:05');

  const slotsQuery = useQuery({
    queryKey: ['children', childId, 'review-slots'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ReviewSlot[] }>(`/children/${childId}/review-slots`);
      return data.data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['children', childId, 'review-slots'] });

  const createDefaults = useMutation({
    mutationFn: async () => {
      await api.post(`/children/${childId}/review-slots/create-defaults`);
    },
    onSuccess: invalidate,
  });

  const createSlot = useMutation({
    mutationFn: async () => {
      await api.post(`/children/${childId}/review-slots`, { dayOfWeek, startTime, endTime, slotType: 'micro' });
    },
    onSuccess: invalidate,
  });

  const toggleSlot = useMutation({
    mutationFn: async (slotId: number) => {
      await api.patch(`/review-slots/${slotId}/toggle`);
    },
    onSuccess: invalidate,
  });

  const deleteSlot = useMutation({
    mutationFn: async (slotId: number) => {
      await api.delete(`/review-slots/${slotId}`);
    },
    onSuccess: invalidate,
  });

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Review Slots</h2>
        {slotsQuery.data?.length === 0 && (
          <button
            onClick={() => createDefaults.mutate()}
            disabled={createDefaults.isPending}
            className="rounded bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Add default schedule (2/day)
          </button>
        )}
      </div>
      <div className="mb-3 space-y-1">
        {slotsQuery.data?.map((slot) => (
          <div key={slot.id} className="flex items-center justify-between rounded border border-slate-200 bg-white px-4 py-2 text-sm">
            <span className={slot.isActive ? '' : 'text-slate-400 line-through'}>
              {DAY_NAMES_SHORT[slot.dayOfWeek]} {slot.startTime}-{slot.endTime} · {slot.slotType}
            </span>
            <div className="flex gap-2">
              <button onClick={() => toggleSlot.mutate(slot.id)} className="text-xs text-brand-600 hover:underline">
                {slot.isActive ? 'Disable' : 'Enable'}
              </button>
              <button onClick={() => deleteSlot.mutate(slot.id)} className="text-xs text-red-600 hover:underline">
                Remove
              </button>
            </div>
          </div>
        ))}
        {slotsQuery.data?.length === 0 && <p className="text-sm text-slate-500">No review slots configured yet.</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createSlot.mutate();
        }}
        className="flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-white p-3 text-sm"
      >
        <div>
          <label htmlFor="slot-day" className="block text-xs font-medium text-slate-700">
            Day
          </label>
          <select
            id="slot-day"
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          >
            {DAY_NAMES_SHORT.slice(1).map((day, i) => (
              <option key={day} value={i + 1}>
                {day}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="slot-start" className="block text-xs font-medium text-slate-700">
            Start
          </label>
          <input
            id="slot-start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          />
        </div>
        <div>
          <label htmlFor="slot-end" className="block text-xs font-medium text-slate-700">
            End
          </label>
          <input
            id="slot-end"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          />
        </div>
        <button type="submit" className="rounded bg-slate-700 px-3 py-2 text-white hover:bg-slate-800">
          Add slot
        </button>
      </form>
    </section>
  );
}

const SUBJECT_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4b5563'];

function SubjectsSection({ childId }: { childId: number }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(SUBJECT_COLORS[0]);

  const subjectsQuery = useQuery({
    queryKey: ['children', childId, 'subjects'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Subject[] }>(`/children/${childId}/subjects`);
      return data.data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['children', childId, 'subjects'] });

  const createSubject = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: Subject }>(`/children/${childId}/subjects`, { name });
      return data.data;
    },
    onSuccess: () => {
      setName('');
      invalidate();
    },
  });

  const updateSubject = useMutation({
    mutationFn: async (subjectId: number) => {
      await api.patch(`/subjects/${subjectId}`, { name: editName, color: editColor });
    },
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  const deleteSubject = useMutation({
    mutationFn: async (subjectId: number) => {
      await api.delete(`/subjects/${subjectId}`);
    },
    onSuccess: invalidate,
  });

  function startEdit(subject: Subject) {
    setEditingId(subject.id);
    setEditName(subject.name);
    setEditColor(subject.color ?? SUBJECT_COLORS[0]);
  }

  return (
    <div className="space-y-3">
      {subjectsQuery.data?.map((subject) => (
        <div key={subject.id} className="rounded border border-slate-200 bg-white">
          {editingId === subject.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateSubject.mutate(subject.id);
              }}
              className="flex flex-wrap items-end gap-3 p-4"
            >
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-700">Name</label>
                <input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-700">Color</span>
                <div className="mt-1 flex gap-1">
                  {SUBJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Color ${c}`}
                      onClick={() => setEditColor(c)}
                      style={{ backgroundColor: c }}
                      className={`h-7 w-7 rounded-full border-2 ${editColor === c ? 'border-slate-900' : 'border-transparent'}`}
                    />
                  ))}
                </div>
              </div>
              <button type="submit" disabled={updateSubject.isPending} className="rounded bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700">
                Save
              </button>
              <button type="button" onClick={() => setEditingId(null)} className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200">
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex w-full items-center justify-between px-4 py-3">
              <button
                onClick={() => setExpanded(expanded === subject.id ? null : subject.id)}
                aria-expanded={expanded === subject.id}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
                <span className="font-medium text-slate-900">{subject.name}</span>
              </button>
              <div className="flex items-center gap-3">
                <button onClick={() => startEdit(subject)} className="text-xs text-brand-600 hover:underline">
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${subject.name}"? This removes all of its units and topics.`)) deleteSubject.mutate(subject.id);
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
                <button onClick={() => setExpanded(expanded === subject.id ? null : subject.id)} aria-hidden="true" className="text-slate-400">
                  {expanded === subject.id ? '▲' : '▼'}
                </button>
              </div>
            </div>
          )}
          {expanded === subject.id && (
            <div className="border-t border-slate-100 p-4">
              <UnitsSection subjectId={subject.id} childId={childId} />
            </div>
          )}
        </div>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createSubject.mutate();
        }}
        className="flex items-end gap-3 rounded border border-slate-200 bg-white p-4"
      >
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700">New subject</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <button type="submit" className="rounded bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
          Add
        </button>
      </form>
    </div>
  );
}

function UnitsSection({ subjectId, childId }: { subjectId: number; childId: number }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const unitsQuery = useQuery({
    queryKey: ['subjects', subjectId, 'units'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Unit[] }>(`/subjects/${subjectId}/units`);
      return data.data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['subjects', subjectId, 'units'] });

  const createUnit = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: Unit }>(`/subjects/${subjectId}/units`, { name });
      return data.data;
    },
    onSuccess: () => {
      setName('');
      invalidate();
    },
  });

  const updateUnit = useMutation({
    mutationFn: async (unitId: number) => {
      await api.patch(`/units/${unitId}`, { name: editName });
    },
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  const deleteUnit = useMutation({
    mutationFn: async (unitId: number) => {
      await api.delete(`/units/${unitId}`);
    },
    onSuccess: invalidate,
  });

  const reorderUnit = useMutation({
    mutationFn: async ({ unitId, sortOrder }: { unitId: number; sortOrder: number }) => {
      await api.patch(`/units/${unitId}`, { sortOrder });
    },
    onSuccess: invalidate,
  });

  const units = unitsQuery.data ?? [];

  function move(index: number, direction: -1 | 1) {
    const target = units[index + direction];
    const current = units[index];
    if (!target) return;
    reorderUnit.mutate({ unitId: current.id, sortOrder: index + direction });
    reorderUnit.mutate({ unitId: target.id, sortOrder: index });
  }

  return (
    <div className="space-y-2">
      {units.map((unit, index) => (
        <div key={unit.id} className="rounded border border-slate-200">
          {editingId === unit.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateUnit.mutate(unit.id);
              }}
              className="flex items-end gap-2 p-3"
            >
              <input
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                aria-label="Unit name"
                className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              <button type="submit" disabled={updateUnit.isPending} className="rounded bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700">
                Save
              </button>
              <button type="button" onClick={() => setEditingId(null)} className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200">
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex w-full items-center justify-between px-3 py-2">
              <button
                onClick={() => setExpanded(expanded === unit.id ? null : unit.id)}
                aria-expanded={expanded === unit.id}
                className="flex-1 text-left text-slate-800"
              >
                {unit.name}
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${unit.name} up`} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
                  ↑
                </button>
                <button onClick={() => move(index, 1)} disabled={index === units.length - 1} aria-label={`Move ${unit.name} down`} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
                  ↓
                </button>
                <button
                  onClick={() => {
                    setEditingId(unit.id);
                    setEditName(unit.name);
                  }}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${unit.name}"? This removes all of its topics.`)) deleteUnit.mutate(unit.id);
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
                <span aria-hidden="true" className="text-slate-400">
                  {expanded === unit.id ? '▲' : '▼'}
                </span>
              </div>
            </div>
          )}
          {expanded === unit.id && (
            <div className="border-t border-slate-100 p-3">
              <TopicsSection unitId={unit.id} childId={childId} />
            </div>
          )}
        </div>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createUnit.mutate();
        }}
        className="flex items-end gap-2"
      >
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New unit name"
          aria-label="New unit name"
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-800">
          Add unit
        </button>
      </form>
    </div>
  );
}

function TopicsSection({ unitId, childId }: { unitId: number; childId: number }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [warningsByTopic, setWarningsByTopic] = useState<Record<number, QualityWarning[]>>({});
  const [addedTopics, setAddedTopics] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMinutes, setEditMinutes] = useState(30);

  const topicsQuery = useQuery({
    queryKey: ['units', unitId, 'topics'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Topic[] }>(`/units/${unitId}/topics`);
      return data.data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['units', unitId, 'topics'] });

  const createTopic = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: Topic }>(`/units/${unitId}/topics`, { title });
      return data.data;
    },
    onSuccess: () => {
      setTitle('');
      invalidate();
    },
  });

  const updateTopic = useMutation({
    mutationFn: async (topicId: number) => {
      await api.patch(`/topics/${topicId}`, { title: editTitle, estimatedMinutes: editMinutes });
    },
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  const deleteTopic = useMutation({
    mutationFn: async (topicId: number) => {
      await api.delete(`/topics/${topicId}`);
    },
    onSuccess: invalidate,
  });

  const reorderTopic = useMutation({
    mutationFn: async ({ topicId, sortOrder }: { topicId: number; sortOrder: number }) => {
      await api.patch(`/topics/${topicId}`, { sortOrder });
    },
    onSuccess: invalidate,
  });

  const topics = topicsQuery.data ?? [];

  function moveTopic(index: number, direction: -1 | 1) {
    const target = topics[index + direction];
    const current = topics[index];
    if (!target) return;
    reorderTopic.mutate({ topicId: current.id, sortOrder: index + direction });
    reorderTopic.mutate({ topicId: target.id, sortOrder: index });
  }

  const addToSchedule = useMutation({
    mutationFn: async (topicId: number) => {
      const { data } = await api.post(`/children/${childId}/learning-sessions`, { topicId });
      return { topicId, warnings: data.warnings as QualityWarning[] };
    },
    onSuccess: ({ topicId, warnings }) => {
      setWarningsByTopic((prev) => ({ ...prev, [topicId]: warnings }));
      setAddedTopics((prev) => new Set(prev).add(topicId));
      queryClient.invalidateQueries({ queryKey: ['children', childId, 'learning-sessions'] });
    },
  });

  return (
    <div className="space-y-2">
      {topics.map((topic, index) => (
        <div key={topic.id} className="rounded border border-slate-200">
          {editingId === topic.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateTopic.mutate(topic.id);
              }}
              className="flex flex-wrap items-end gap-2 p-3"
            >
              <input
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                aria-label="Topic title"
                className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              <div>
                <label className="block text-xs text-slate-500">Minutes</label>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(Number(e.target.value))}
                  aria-label="Estimated minutes"
                  className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <button type="submit" disabled={updateTopic.isPending} className="rounded bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700">
                Save
              </button>
              <button type="button" onClick={() => setEditingId(null)} className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200">
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex w-full items-center justify-between px-3 py-2 text-sm">
              <button
                onClick={() => setExpanded(expanded === topic.id ? null : topic.id)}
                aria-expanded={expanded === topic.id}
                className="flex-1 text-left"
              >
                <span className="text-slate-800">
                  {topic.title} <span className="text-slate-400">({topic.estimatedMinutes} min)</span>
                </span>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => moveTopic(index, -1)} disabled={index === 0} aria-label={`Move ${topic.title} up`} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
                  ↑
                </button>
                <button onClick={() => moveTopic(index, 1)} disabled={index === topics.length - 1} aria-label={`Move ${topic.title} down`} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
                  ↓
                </button>
                <button
                  onClick={() => {
                    setEditingId(topic.id);
                    setEditTitle(topic.title);
                    setEditMinutes(topic.estimatedMinutes);
                  }}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${topic.title}"?`)) deleteTopic.mutate(topic.id);
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
                <span aria-hidden="true" className="text-slate-400">
                  {expanded === topic.id ? '▲' : '▼'}
                </span>
              </div>
            </div>
          )}
          {expanded === topic.id && (
            <div className="border-t border-slate-100 p-3">
              <div className="mb-3">
                <button
                  onClick={() => addToSchedule.mutate(topic.id)}
                  disabled={addToSchedule.isPending || addedTopics.has(topic.id)}
                  className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {addedTopics.has(topic.id) ? 'Added to schedule ✓' : 'Add to schedule'}
                </button>
                {warningsByTopic[topic.id]?.map((w) => (
                  <p key={w.code} className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    ⚠️ {w.message}
                  </p>
                ))}
              </div>
              <MaterialsSection topicId={topic.id} />
              <LessonsAndAssessmentsSection topicId={topic.id} childId={childId} />
              <details className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-slate-700">🤖 Ask the tutor about this topic</summary>
                <div className="mt-2">
                  <TutorChat messagesUrl={`/topics/${topic.id}/tutor/messages`} />
                </div>
              </details>
              <div className="mt-4 border-t border-slate-100 pt-3">
                <FlashcardsSection topicId={topic.id} />
              </div>
            </div>
          )}
        </div>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createTopic.mutate();
        }}
        className="flex items-end gap-2"
      >
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New topic title"
          aria-label="New topic title"
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-800">
          Add topic
        </button>
      </form>
    </div>
  );
}

interface FileAssetItem {
  id: number;
  kind: string;
  originalName: string;
  url: string | null;
  label: string | null;
}

const MATERIAL_KIND_ICONS: Record<string, string> = {
  video_link: '🔗',
  image: '🖼️',
  document: '📄',
  markdown: '📝',
};

function MaterialsSection({ topicId }: { topicId: number }) {
  const queryClient = useQueryClient();
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['topics', topicId, 'materials'] });

  const materialsQuery = useQuery({
    queryKey: ['topics', topicId, 'materials'],
    queryFn: async () => {
      const { data } = await api.get<{ data: FileAssetItem[] }>(`/topics/${topicId}/materials`);
      return data.data;
    },
  });

  const addLink = useMutation({
    mutationFn: async () => {
      await api.post(`/topics/${topicId}/materials/link`, { url: linkUrl, label: linkLabel || undefined });
    },
    onSuccess: () => {
      setLinkUrl('');
      setLinkLabel('');
      invalidate();
    },
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const isImage = file.type.startsWith('image/');
      await api.post(`/topics/${topicId}/materials/upload${isImage ? '?type=image' : ''}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: invalidate,
  });

  const uploadMarkdown = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/topics/${topicId}/materials/markdown-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: invalidate,
  });

  const deleteMaterial = useMutation({
    mutationFn: async (assetId: number) => {
      await api.delete(`/file-assets/${assetId}`);
    },
    onSuccess: invalidate,
  });

  const loadPreview = useMutation({
    mutationFn: async () => {
      const { data } = await api.get<{ data: { markdown: string } }>(`/topics/${topicId}/content/preview`);
      return data.data.markdown;
    },
    onSuccess: setPreview,
  });

  return (
    <div className="mb-4 space-y-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium text-slate-700">Materials</p>
        <button onClick={() => (preview === null ? loadPreview.mutate() : setPreview(null))} className="text-brand-600 hover:underline">
          {preview === null ? 'Preview content' : 'Hide preview'}
        </button>
      </div>

      {preview !== null && <RichContent content={preview} className="rounded border border-slate-200 bg-white p-3" />}

      <ul className="space-y-1">
        {materialsQuery.data?.map((asset) => (
          <li key={asset.id} className="flex items-center justify-between rounded bg-white px-2 py-1.5">
            <span>
              {MATERIAL_KIND_ICONS[asset.kind] ?? '📎'}{' '}
              {asset.url ? (
                <a href={asset.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                  {asset.label || asset.originalName}
                </a>
              ) : (
                <span>{asset.label || asset.originalName}</span>
              )}
            </span>
            <button onClick={() => deleteMaterial.mutate(asset.id)} aria-label={`Remove ${asset.originalName}`} className="text-slate-400 hover:text-red-600">
              &times;
            </button>
          </li>
        ))}
        {materialsQuery.data?.length === 0 && <p className="text-slate-500">No materials yet.</p>}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addLink.mutate();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <input
          type="url"
          required
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://…"
          aria-label="Material link URL"
          className="flex-1 rounded border border-slate-300 px-2 py-1"
        />
        <input
          value={linkLabel}
          onChange={(e) => setLinkLabel(e.target.value)}
          placeholder="Label (optional)"
          aria-label="Material link label"
          className="w-40 rounded border border-slate-300 px-2 py-1"
        />
        <button type="submit" className="rounded bg-slate-700 px-3 py-1.5 text-white hover:bg-slate-800">
          Add link
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-4">
        <label className="text-slate-600">
          Upload image/file:{' '}
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile.mutate(file);
              e.target.value = '';
            }}
          />
        </label>
        <label className="text-slate-600">
          Upload markdown notes:{' '}
          <input
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMarkdown.mutate(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </div>
  );
}

const CARD_TYPE_LABELS: Record<string, string> = {
  basic: 'Basic (question / answer)',
  typed_answer: 'Typed answer',
  multiple_choice: 'Multiple choice',
  true_false: 'True / False',
  cloze: 'Cloze (fill in the blank)',
  image_occlusion: 'Image occlusion',
};

interface FlashcardFormState {
  cardType: string;
  question: string;
  answer: string;
  choices: string[];
  correctChoices: string[];
  clozeText: string;
  clozeAnswers: string;
  questionImageUrl: string | null;
  occlusionData: OcclusionBox[];
}

function blankFlashcardForm(): FlashcardFormState {
  return {
    cardType: 'basic',
    question: '',
    answer: '',
    choices: ['', ''],
    correctChoices: [],
    clozeText: '',
    clozeAnswers: '',
    questionImageUrl: null,
    occlusionData: [],
  };
}

function flashcardToForm(card: Flashcard): FlashcardFormState {
  return {
    cardType: card.cardType,
    question: card.question,
    answer: card.answer,
    choices: card.choices && card.choices.length > 0 ? card.choices : ['', ''],
    correctChoices: card.correctChoices ?? [],
    clozeText: card.clozeText ?? '',
    clozeAnswers: (card.clozeAnswers ?? []).join(', '),
    questionImageUrl: card.questionImageUrl,
    occlusionData: card.occlusionData ?? [],
  };
}

/** Builds the API payload from form state, deriving `answer` (always required server-side)
 * from the type-specific fields when the user didn't type one directly. */
function flashcardFormToPayload(form: FlashcardFormState) {
  const clozeAnswers = form.clozeAnswers
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  switch (form.cardType) {
    case 'multiple_choice':
      return {
        cardType: form.cardType,
        question: form.question,
        answer: form.correctChoices.join(', ') || form.answer,
        choices: form.choices.filter(Boolean),
        correctChoices: form.correctChoices,
      };
    case 'true_false':
      return {
        cardType: form.cardType,
        question: form.question,
        answer: form.correctChoices[0] ?? form.answer,
        choices: ['True', 'False'],
        correctChoices: form.correctChoices,
      };
    case 'cloze':
      return {
        cardType: form.cardType,
        question: form.question || form.clozeText,
        answer: clozeAnswers.join(', ') || form.answer,
        clozeText: form.clozeText,
        clozeAnswers,
      };
    case 'image_occlusion':
      return {
        cardType: form.cardType,
        question: form.question || 'Identify the hidden area(s)',
        answer: form.answer || 'See highlighted regions',
        questionImageUrl: form.questionImageUrl,
        occlusionData: form.occlusionData,
      };
    default:
      return { cardType: form.cardType, question: form.question, answer: form.answer };
  }
}

function FlashcardFieldsEditor({ topicId, value, onChange }: { topicId: number; value: FlashcardFormState; onChange: (next: FlashcardFormState) => void }) {
  function set<K extends keyof FlashcardFormState>(key: K, val: FlashcardFormState[K]) {
    onChange({ ...value, [key]: val });
  }

  function setChoice(index: number, text: string) {
    const choices = [...value.choices];
    choices[index] = text;
    set('choices', choices);
  }

  function toggleCorrectChoice(choice: string, multi: boolean) {
    if (multi) {
      set('correctChoices', value.correctChoices.includes(choice) ? value.correctChoices.filter((c) => c !== choice) : [...value.correctChoices, choice]);
    } else {
      set('correctChoices', [choice]);
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs font-medium text-slate-700">Card type</label>
        <select
          value={value.cardType}
          onChange={(e) => onChange({ ...blankFlashcardForm(), cardType: e.target.value, question: value.question })}
          className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          {Object.entries(CARD_TYPE_LABELS).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {value.cardType !== 'image_occlusion' && (
        <input
          required
          value={value.question}
          onChange={(e) => set('question', e.target.value)}
          placeholder="Question"
          aria-label="Flashcard question"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      )}

      {(value.cardType === 'basic' || value.cardType === 'typed_answer') && (
        <input
          required
          value={value.answer}
          onChange={(e) => set('answer', e.target.value)}
          placeholder="Answer"
          aria-label="Flashcard answer"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      )}

      {value.cardType === 'multiple_choice' && (
        <div className="space-y-1">
          <span className="block text-xs font-medium text-slate-700">Choices (check the correct one(s))</span>
          {value.choices.map((choice, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.correctChoices.includes(choice) && choice !== ''}
                onChange={() => choice && toggleCorrectChoice(choice, true)}
                aria-label={`Choice ${i + 1} is correct`}
              />
              <input
                value={choice}
                onChange={(e) => setChoice(i, e.target.value)}
                placeholder={`Choice ${i + 1}`}
                aria-label={`Choice ${i + 1} text`}
                className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              {value.choices.length > 2 && (
                <button type="button" onClick={() => set('choices', value.choices.filter((_, idx) => idx !== i))} className="text-xs text-red-600">
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => set('choices', [...value.choices, ''])} className="text-xs text-brand-600 hover:underline">
            + Add choice
          </button>
        </div>
      )}

      {value.cardType === 'true_false' && (
        <div className="flex gap-4">
          {['True', 'False'].map((choice) => (
            <label key={choice} className="flex items-center gap-1 text-sm">
              <input type="radio" name="true-false" checked={value.correctChoices[0] === choice} onChange={() => toggleCorrectChoice(choice, false)} />
              {choice}
            </label>
          ))}
        </div>
      )}

      {value.cardType === 'cloze' && (
        <>
          <textarea
            required
            value={value.clozeText}
            onChange={(e) => set('clozeText', e.target.value)}
            rows={2}
            placeholder="Text with blanks, e.g. The capital of France is ___."
            aria-label="Cloze text"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            value={value.clozeAnswers}
            onChange={(e) => set('clozeAnswers', e.target.value)}
            placeholder="Answers for each blank, in order, comma-separated"
            aria-label="Cloze answers"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </>
      )}

      {value.cardType === 'image_occlusion' && (
        <OcclusionEditor
          topicId={topicId}
          imageUrl={value.questionImageUrl}
          boxes={value.occlusionData}
          onImageChange={(url) => set('questionImageUrl', url)}
          onBoxesChange={(boxes) => set('occlusionData', boxes)}
        />
      )}
    </div>
  );
}

function FlashcardsSection({ topicId }: { topicId: number }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<FlashcardFormState>(blankFlashcardForm());
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FlashcardFormState>(blankFlashcardForm());

  const flashcardsQuery = useQuery({
    queryKey: ['topics', topicId, 'flashcards', search],
    queryFn: async () => {
      const { data } = await api.get<{ data: Flashcard[] }>(`/topics/${topicId}/flashcards`, {
        params: search ? { q: search } : undefined,
      });
      return data.data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['topics', topicId, 'flashcards'] });

  const createFlashcard = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: Flashcard }>(`/topics/${topicId}/flashcards`, flashcardFormToPayload(createForm));
      return data.data;
    },
    onSuccess: () => {
      setCreateForm(blankFlashcardForm());
      setCreating(false);
      invalidate();
    },
  });

  const updateFlashcard = useMutation({
    mutationFn: async (cardId: number) => {
      await api.patch(`/flashcards/${cardId}`, flashcardFormToPayload(editForm));
    },
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  const deleteFlashcard = useMutation({
    mutationFn: async (cardId: number) => {
      await api.delete(`/flashcards/${cardId}`);
    },
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search flashcards…"
          aria-label="Search flashcards"
          className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
        />
        <Link to={`/topics/${topicId}/flashcards/preview`} className="text-sm text-brand-600 hover:underline">
          Preview
        </Link>
        <Link to={`/topics/${topicId}/flashcards/print`} className="text-sm text-brand-600 hover:underline">
          Print
        </Link>
      </div>

      <ul className="space-y-1">
        {flashcardsQuery.data?.map((card) =>
          editingId === card.id ? (
            <li key={card.id} className="rounded bg-slate-50 p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateFlashcard.mutate(card.id);
                }}
                className="space-y-2"
              >
                <FlashcardFieldsEditor topicId={topicId} value={editForm} onChange={setEditForm} />
                <div className="flex gap-2">
                  <button type="submit" disabled={updateFlashcard.isPending} className="rounded bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded bg-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-300">
                    Cancel
                  </button>
                </div>
              </form>
            </li>
          ) : (
            <li key={card.id} className="flex items-start justify-between gap-2 rounded bg-slate-50 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                {card.cardType !== 'basic' && <span className="mb-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">{CARD_TYPE_LABELS[card.cardType]}</span>}
                <RichContent content={card.question} className="[&>p]:m-0" />
                <RichContent content={card.answer} className="text-slate-500 [&>p]:m-0" />
              </div>
              <span className="flex shrink-0 gap-2">
                <button
                  onClick={() => {
                    setEditingId(card.id);
                    setEditForm(flashcardToForm(card));
                  }}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this flashcard?')) deleteFlashcard.mutate(card.id);
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </span>
            </li>
          )
        )}
        {flashcardsQuery.data?.length === 0 && <p className="text-sm text-slate-500">No flashcards yet.</p>}
      </ul>

      {creating ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createFlashcard.mutate();
          }}
          className="space-y-2 rounded border border-slate-200 bg-white p-3"
        >
          <FlashcardFieldsEditor topicId={topicId} value={createForm} onChange={setCreateForm} />
          <div className="flex gap-2">
            <button type="submit" disabled={createFlashcard.isPending} className="rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50">
              Add flashcard
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setCreateForm(blankFlashcardForm());
              }}
              className="rounded bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setCreating(true)} className="rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-800">
          + Add flashcard
        </button>
      )}

      <BulkImportForm topicId={topicId} />
    </div>
  );
}

function BulkImportForm({ topicId }: { topicId: number }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [result, setResult] = useState<{ importedCards: number; duplicateCards: number } | null>(null);

  const importMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/topics/${topicId}/flashcards/import`, { format: 'csv', content });
      return data.data as { importedCards: number; duplicateCards: number };
    },
    onSuccess: (data) => {
      setContent('');
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['topics', topicId, 'flashcards'] });
    },
  });

  return (
    <details className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
      <summary className="cursor-pointer font-medium text-slate-700">Bulk import (CSV: question,answer,hint)</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setResult(null);
          importMutation.mutate();
        }}
        className="mt-2 space-y-2"
      >
        <textarea
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          aria-label="Flashcard CSV content"
          rows={4}
          placeholder={'What is 2+2?,4\nCapital of France?,Paris'}
          className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
        />
        <button
          type="submit"
          disabled={importMutation.isPending}
          className="rounded bg-slate-700 px-3 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Import
        </button>
        {result && (
          <p className="text-emerald-700">
            Imported {result.importedCards}, skipped {result.duplicateCards} duplicate(s).
          </p>
        )}
      </form>
    </details>
  );
}
