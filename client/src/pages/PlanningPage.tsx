import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { AppLayout } from '../components/AppLayout';
import { ChildNavHeader } from '../components/ChildNavHeader';
import { api } from '../lib/api';


interface SessionItem {
  id: number;
  estimatedMinutes: number;
  status: string;
  commitmentType: string;
  scheduledDayOfWeek: number | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  topic: { title: string };
}

interface CatchUpItem {
  id: number;
  priority: number;
  status: string;
  missedDate: string;
  topic: { title: string };
}

interface DayCapacity {
  day: number;
  dayName: string;
  availableMinutes: number;
  scheduledMinutes: number;
  remainingMinutes: number;
  utilizationPercent: number;
  status: 'green' | 'yellow' | 'red';
  timeBlocksCount: number;
  sessionsCount: number;
}

interface QualityAnalysis {
  ageGroup: string;
  maxDailyMinutes: number;
  daysExceedingAgeLimit: number;
  recommendations: string[];
}

const STATUSES = ['backlog', 'planned', 'scheduled', 'done'] as const;
const STATUS_LABELS: Record<string, string> = { backlog: 'Backlog', planned: 'Planned', scheduled: 'Scheduled', done: 'Done' };
const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-slate-50 border-slate-200',
  planned: 'bg-blue-50 border-blue-200',
  scheduled: 'bg-emerald-50 border-emerald-200',
  done: 'bg-purple-50 border-purple-200',
};
const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PlanningPage() {
  const { childId: childIdParam } = useParams<{ childId: string }>();
  const childId = Number(childIdParam);
  const queryClient = useQueryClient();
  const [scheduling, setScheduling] = useState<SessionItem | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ['children', childId, 'planning-sessions'],
    queryFn: async () => {
      const { data } = await api.get<{ data: SessionItem[] }>(`/children/${childId}/learning-sessions`);
      return data.data;
    },
  });

  const catchUpsQuery = useQuery({
    queryKey: ['children', childId, 'catch-up-sessions'],
    queryFn: async () => {
      const { data } = await api.get<{ data: CatchUpItem[] }>(`/children/${childId}/catch-up-sessions`);
      return data.data;
    },
  });

  const capacityQuery = useQuery({
    queryKey: ['children', childId, 'planning-capacity'],
    queryFn: async () => {
      const { data } = await api.get<{ data: DayCapacity[] }>(`/children/${childId}/planning/capacity`);
      return data.data;
    },
  });

  const qualityQuery = useQuery({
    queryKey: ['children', childId, 'planning-quality'],
    queryFn: async () => {
      const { data } = await api.get<{ data: QualityAnalysis }>(`/children/${childId}/planning/quality-analysis`);
      return data.data;
    },
  });

  const invalidateBoard = () => {
    queryClient.invalidateQueries({ queryKey: ['children', childId, 'planning-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['children', childId, 'planning-capacity'] });
    queryClient.invalidateQueries({ queryKey: ['children', childId, 'planning-quality'] });
  };

  const setStatus = useMutation({
    mutationFn: async ({ sessionId, status }: { sessionId: number; status: string }) => {
      await api.patch(`/learning-sessions/${sessionId}/status`, { status });
    },
    onSuccess: invalidateBoard,
  });

  const [activeSession, setActiveSession] = useState<SessionItem | null>(null);

  function handleDragStart(event: DragStartEvent) {
    const session = sessionsQuery.data?.find((s) => s.id === event.active.id);
    setActiveSession(session ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveSession(null);
    const { active, over } = event;
    if (!over) return;
    const session = sessionsQuery.data?.find((s) => s.id === active.id);
    const newStatus = String(over.id);
    if (!session || session.status === newStatus) return;

    if (newStatus === 'scheduled') {
      setScheduling(session);
    } else {
      setStatus.mutate({ sessionId: session.id, status: newStatus });
    }
  }

  const sessionsByStatus = (status: string) => sessionsQuery.data?.filter((s) => s.status === status) ?? [];

  return (
    <AppLayout>
      <ChildNavHeader childId={childId} activeTab="planning" />

      {capacityQuery.data && <CapacityMeter days={capacityQuery.data} />}
      {qualityQuery.data && <QualityAnalysisPanel analysis={qualityQuery.data} />}

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {STATUSES.map((status) => (
            <StatusColumn
              key={status}
              status={status}
              sessions={sessionsByStatus(status)}
              onInvalidate={invalidateBoard}
            />
          ))}
          <CatchUpColumn childId={childId} catchUps={catchUpsQuery.data ?? []} onInvalidate={invalidateBoard} />
        </div>
        <DragOverlay>{activeSession && <SessionCardBody session={activeSession} />}</DragOverlay>
      </DndContext>

      {scheduling && (
        <ScheduleModal
          session={scheduling}
          onClose={() => setScheduling(null)}
          onScheduled={() => {
            setScheduling(null);
            invalidateBoard();
          }}
        />
      )}
    </AppLayout>
  );
}

function CapacityMeter({ days }: { days: DayCapacity[] }) {
  const statusColor: Record<string, string> = { green: 'bg-emerald-500', yellow: 'bg-amber-500', red: 'bg-red-500' };
  return (
    <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft-xl">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Weekly Capacity & Utilization</h2>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => (
          <div key={d.day} className="rounded-xl bg-slate-50/70 p-2 text-center text-xs">
            <div className="mb-1 font-bold text-slate-700">{DAY_NAMES[d.day]}</div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
              {d.availableMinutes > 0 && (
                <div className={`h-full ${statusColor[d.status]}`} style={{ width: `${Math.min(100, d.utilizationPercent)}%` }} />
              )}
            </div>
            <div className="mt-1 text-[10px] text-slate-500 font-medium">
              {d.availableMinutes > 0 ? `${d.scheduledMinutes}/${d.availableMinutes}m` : 'No blocks'}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function QualityAnalysisPanel({ analysis }: { analysis: QualityAnalysis }) {
  if (analysis.recommendations.length === 0) return null;
  return (
    <section className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 shadow-soft-sm">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-900">
        Schedule Quality Analysis — {analysis.daysExceedingAgeLimit} day(s) over the {analysis.maxDailyMinutes}m/day guideline
      </h2>
      <ul className="list-inside list-disc space-y-1 text-xs text-amber-800">
        {analysis.recommendations.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
  );
}


function StatusColumn({
  status,
  sessions,
  onInvalidate,
}: {
  status: string;
  sessions: SessionItem[];
  onInvalidate: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-3 ${STATUS_COLORS[status]} ${isOver ? 'ring-2 ring-brand-500' : ''}`}
    >
      <h3 className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-800">
        {STATUS_LABELS[status]}
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">{sessions.length}</span>
      </h3>
      <div className="min-h-16 space-y-2">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} onInvalidate={onInvalidate} />
        ))}
      </div>
    </div>
  );
}

function SessionCardBody({ session }: { session: SessionItem }) {
  return (
    <div className="rounded border border-slate-300 bg-white p-3 text-sm shadow">
      <p className="font-medium text-slate-900">{session.topic.title}</p>
      <p className="text-xs text-slate-500">
        {session.estimatedMinutes} min · {session.commitmentType}
      </p>
    </div>
  );
}

function SessionCard({ session, onInvalidate }: { session: SessionItem; onInvalidate: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: session.id });
  const [suggestions, setSuggestions] = useState<Array<{ date: string; currentLoad: number }> | null>(null);
  const [skipping, setSkipping] = useState(false);
  const [skipReason, setSkipReason] = useState('');

  const suggest = useMutation({
    mutationFn: async () => {
      const { data } = await api.get(`/learning-sessions/${session.id}/reschedule-suggestions`);
      return data.data as Array<{ date: string; currentLoad: number }>;
    },
    onSuccess: setSuggestions,
  });

  const skip = useMutation({
    mutationFn: async () => {
      await api.post(`/learning-sessions/${session.id}/skip`, { reason: skipReason || undefined });
    },
    onSuccess: () => {
      setSkipping(false);
      setSkipReason('');
      onInvalidate();
    },
  });

  const setCommitment = useMutation({
    mutationFn: async (commitmentType: string) => {
      await api.patch(`/learning-sessions/${session.id}/commitment-type`, { commitmentType });
    },
    onSuccess: onInvalidate,
  });

  const remove = useMutation({
    mutationFn: async () => {
      await api.delete(`/learning-sessions/${session.id}`);
    },
    onSuccess: onInvalidate,
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded border border-slate-200 bg-white p-2 text-sm shadow-sm ${isDragging ? 'opacity-40' : ''}`}
    >
      <div {...listeners} {...attributes} className="cursor-move">
        <p className="font-medium text-slate-900">{session.topic.title}</p>
        <p className="text-xs text-slate-500">
          {session.estimatedMinutes} min
          {session.status === 'scheduled' && session.scheduledDayOfWeek && (
            <> · {DAY_NAMES[session.scheduledDayOfWeek]} {session.scheduledStartTime}</>
          )}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <select
          value={session.commitmentType}
          onChange={(e) => setCommitment.mutate(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5"
        >
          <option value="fixed">Fixed</option>
          <option value="preferred">Preferred</option>
          <option value="flexible">Flexible</option>
        </select>
        {session.status === 'scheduled' && session.commitmentType !== 'fixed' && (
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setSkipping(true)} className="text-orange-600 hover:underline">
            Skip day
          </button>
        )}
        {session.status !== 'done' && (
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => suggest.mutate()} className="text-brand-600 hover:underline">
            Suggest days
          </button>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            if (confirm('Delete this session?')) remove.mutate();
          }}
          className="text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>

      {suggestions && (
        <div className="mt-1 flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <span key={s.date} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {new Date(s.date).toLocaleDateString()} ({s.currentLoad})
            </span>
          ))}
        </div>
      )}

      {skipping && (
        <form
          onPointerDown={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            skip.mutate();
          }}
          className="mt-2 space-y-1 rounded bg-orange-50 p-2"
        >
          <input
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            placeholder="Reason (optional)"
            aria-label="Skip reason"
            className="w-full rounded border border-orange-200 px-2 py-1 text-xs"
          />
          <p className="text-xs text-orange-700">Moves this session to the Catch-Up lane.</p>
          <div className="flex gap-1">
            <button type="submit" className="rounded bg-orange-600 px-2 py-1 text-xs text-white">
              Skip
            </button>
            <button type="button" onClick={() => setSkipping(false)} className="rounded bg-slate-200 px-2 py-1 text-xs">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ScheduleModal({ session, onClose, onScheduled }: { session: SessionItem; onClose: () => void; onScheduled: () => void }) {
  const [dayOfWeek, setDayOfWeek] = useState(session.scheduledDayOfWeek ?? 1);
  const [startTime, setStartTime] = useState(session.scheduledStartTime ?? '09:00');
  const [endTime, setEndTime] = useState(session.scheduledEndTime ?? '10:00');
  const [error, setError] = useState<string | null>(null);

  const schedule = useMutation({
    mutationFn: async () => {
      await api.patch(`/learning-sessions/${session.id}/schedule`, { scheduledDayOfWeek: dayOfWeek, scheduledStartTime: startTime, scheduledEndTime: endTime });
    },
    onSuccess: onScheduled,
    onError: () => setError('Could not schedule this session.'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Schedule "{session.topic.title}"</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            schedule.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700">Day</label>
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
              {DAY_NAMES.slice(1).map((day, i) => (
                <option key={day} value={i + 1}>
                  {day}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-700">Start</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-700">End</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={schedule.isPending} className="rounded bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
              Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CatchUpColumn({ childId, catchUps, onInvalidate }: { childId: number; catchUps: CatchUpItem[]; onInvalidate: () => void }) {
  // Not a drop target — sessions arrive here only via "Skip day", never by dragging.
  const pending = catchUps.filter((c) => c.status === 'pending').sort((a, b) => a.priority - b.priority);

  const redistribute = useMutation({
    mutationFn: async () => {
      await api.post(`/children/${childId}/catch-up-sessions/redistribute`);
    },
    onSuccess: onInvalidate,
  });

  const setPriority = useMutation({
    mutationFn: async ({ catchUpId, priority }: { catchUpId: number; priority: number }) => {
      await api.patch(`/catch-up-sessions/${catchUpId}/priority`, { priority });
    },
    onSuccess: onInvalidate,
  });

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
      <h3 className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-800">
        Catch-Up
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">{pending.length}</span>
      </h3>
      {pending.length > 0 && (
        <button
          onClick={() => redistribute.mutate()}
          disabled={redistribute.isPending}
          className="mb-2 w-full rounded bg-orange-600 px-2 py-1.5 text-xs text-white hover:bg-orange-700 disabled:opacity-50"
        >
          Auto-redistribute
        </button>
      )}
      <div className="space-y-2">
        {pending.map((c) => (
          <div key={c.id} className="rounded border border-orange-200 bg-white p-2 text-sm">
            <p className="font-medium text-slate-900">{c.topic.title}</p>
            <p className="text-xs text-slate-500">missed {new Date(c.missedDate).toLocaleDateString()}</p>
            <label className="mt-1 flex items-center gap-1 text-xs text-slate-600">
              Priority
              <select
                value={c.priority}
                onChange={(e) => setPriority.mutate({ catchUpId: c.id, priority: Number(e.target.value) })}
                className="rounded border border-slate-200 px-1 py-0.5"
              >
                {[1, 2, 3, 4, 5].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
        {pending.length === 0 && <p className="text-xs text-slate-400">No missed sessions.</p>}
      </div>
    </div>
  );
}
