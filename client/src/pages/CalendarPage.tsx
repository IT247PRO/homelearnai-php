import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../components/AppLayout';
import { ChildNavHeader } from '../components/ChildNavHeader';
import { TimeBlockForm, BLANK_TIME_BLOCK, WEEKDAY_NAMES, type TimeBlockFormState } from '../components/TimeBlockForm';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';


interface TimeBlockItem {
  id: number;
  label: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  commitmentType: string;
  isImported: boolean;
}

interface ReviewSlotItem {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotType: string;
  isActive: boolean;
}

const GRID_START_MINUTES = 6 * 60; // 6:00am
const GRID_END_MINUTES = 21 * 60; // 9:00pm
const GRID_SPAN = GRID_END_MINUTES - GRID_START_MINUTES;
const HOURS = Array.from({ length: 16 }, (_, i) => 6 + i);

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function topPct(time: string): number {
  return Math.max(0, ((minutesOf(time) - GRID_START_MINUTES) / GRID_SPAN) * 100);
}

function heightPct(start: string, end: string): number {
  return Math.max(2, ((minutesOf(end) - minutesOf(start)) / GRID_SPAN) * 100);
}

export default function CalendarPage() {
  const { childId: childIdParam } = useParams<{ childId: string }>();
  const childId = Number(childIdParam);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [editingBlock, setEditingBlock] = useState<TimeBlockItem | null>(null);
  const [icsContent, setIcsContent] = useState<string | null>(null);
  const [preview, setPreview] = useState<Array<{ uid: string; summary: string; start: string; durationMinutes: number }> | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skippedDuplicates: number } | null>(null);
  const [icsUrl, setIcsUrl] = useState('');

  const timeBlocksQuery = useQuery({
    queryKey: ['children', childId, 'time-blocks'],
    queryFn: async () => {
      const { data } = await api.get<{ data: TimeBlockItem[] }>(`/children/${childId}/time-blocks`);
      return data.data;
    },
  });

  const reviewSlotsQuery = useQuery({
    queryKey: ['children', childId, 'review-slots'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ReviewSlotItem[] }>(`/children/${childId}/review-slots`);
      return data.data;
    },
  });

  const invalidateTimeBlocks = () => queryClient.invalidateQueries({ queryKey: ['children', childId, 'time-blocks'] });

  const createTimeBlock = useMutation({
    mutationFn: async (values: TimeBlockFormState) => {
      await api.post(`/children/${childId}/time-blocks`, values);
    },
    onSuccess: () => {
      setAddingDay(null);
      invalidateTimeBlocks();
    },
  });

  const updateTimeBlock = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: TimeBlockFormState }) => {
      await api.patch(`/time-blocks/${id}`, values);
    },
    onSuccess: () => {
      setEditingBlock(null);
      invalidateTimeBlocks();
    },
  });

  const deleteTimeBlock = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/time-blocks/${id}`);
    },
    onSuccess: () => {
      setEditingBlock(null);
      invalidateTimeBlocks();
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data } = await api.post(`/children/${childId}/time-blocks/import/preview`, { icsContent: content });
      return data.data as Array<{ uid: string; summary: string; start: string; durationMinutes: number }>;
    },
    onSuccess: setPreview,
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/children/${childId}/time-blocks/import`, { icsContent });
      return data.data as { imported: number; skippedDuplicates: number };
    },
    onSuccess: (result) => {
      setImportResult(result);
      setPreview(null);
      invalidateTimeBlocks();
    },
  });

  const importUrlMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/children/${childId}/time-blocks/import/url`, { url: icsUrl });
      return data.data as { imported: number; skippedDuplicates: number };
    },
    onSuccess: (result) => {
      setImportResult(result);
      setIcsUrl('');
      invalidateTimeBlocks();
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setIcsContent(content);
    setImportResult(null);
    previewMutation.mutate(content);
  }

  const startsMonday = user?.weekStart === 'monday';
  const dayOrder = startsMonday ? [1, 2, 3, 4, 5, 6, 7] : [7, 1, 2, 3, 4, 5, 6];

  const timeBlocksByDay = (day: number) => timeBlocksQuery.data?.filter((tb) => tb.dayOfWeek === day) ?? [];
  const reviewSlotsByDay = (day: number) => reviewSlotsQuery.data?.filter((rs) => rs.dayOfWeek === day && rs.isActive) ?? [];

  return (
    <AppLayout>
      <ChildNavHeader childId={childId} activeTab="calendar" />

      <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-xl">

        <div className="grid min-w-[900px] grid-cols-[3rem_repeat(7,1fr)]">
          <div className="border-b border-r border-slate-100" />
          {dayOrder.map((day) => (
            <div key={day} className="border-b border-r border-slate-100 p-2 text-center text-sm font-medium text-slate-700 last:border-r-0">
              {WEEKDAY_NAMES[day]}
              <button onClick={() => setAddingDay(day)} className="ml-2 text-xs text-brand-600 hover:underline">
                +
              </button>
            </div>
          ))}

          <div className="relative" style={{ height: `${HOURS.length * 3}rem` }}>
            {HOURS.map((h, i) => (
              <div key={h} className="absolute left-0 right-0 border-t border-slate-100 pr-1 text-right text-[10px] text-slate-400" style={{ top: `${(i / HOURS.length) * 100}%` }}>
                {h}:00
              </div>
            ))}
          </div>

          {dayOrder.map((day) => (
            <div key={day} className="relative border-r border-slate-100 last:border-r-0" style={{ height: `${HOURS.length * 3}rem` }}>
              {HOURS.map((h, i) => (
                <div key={h} className="absolute left-0 right-0 border-t border-slate-100" style={{ top: `${(i / HOURS.length) * 100}%` }} />
              ))}
              {timeBlocksByDay(day).map((tb) => (
                <button
                  key={tb.id}
                  onClick={() => setEditingBlock(tb)}
                  style={{ top: `${topPct(tb.startTime)}%`, height: `${heightPct(tb.startTime, tb.endTime)}%` }}
                  className={`absolute left-0.5 right-0.5 overflow-hidden rounded px-1 py-0.5 text-left text-[11px] text-white ${
                    tb.isImported ? 'bg-slate-400' : 'bg-brand-600'
                  }`}
                >
                  {tb.label}
                </button>
              ))}
              {reviewSlotsByDay(day).map((rs) => (
                <div
                  key={`slot-${rs.id}`}
                  style={{ top: `${topPct(rs.startTime)}%`, height: `${heightPct(rs.startTime, rs.endTime)}%` }}
                  className="absolute left-0.5 right-0.5 rounded border border-dashed border-emerald-400 bg-emerald-50/70"
                  title={`Review slot (${rs.slotType})`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {(addingDay !== null || editingBlock) && (
        <div className="mb-4">
          <TimeBlockForm
            initial={
              editingBlock
                ? { label: editingBlock.label, dayOfWeek: editingBlock.dayOfWeek, startTime: editingBlock.startTime, endTime: editingBlock.endTime, commitmentType: editingBlock.commitmentType }
                : { ...BLANK_TIME_BLOCK, dayOfWeek: addingDay ?? 1 }
            }
            submitting={createTimeBlock.isPending || updateTimeBlock.isPending}
            onSubmit={(values) => (editingBlock ? updateTimeBlock.mutate({ id: editingBlock.id, values }) : createTimeBlock.mutate(values))}
            onCancel={() => {
              setAddingDay(null);
              setEditingBlock(null);
            }}
          />
          {editingBlock && (
            <button
              onClick={() => {
                if (confirm(`Delete "${editingBlock.label}"?`)) deleteTimeBlock.mutate(editingBlock.id);
              }}
              className="mt-2 text-sm text-red-600 hover:underline"
            >
              Delete this time block
            </button>
          )}
        </div>
      )}

      <div className="rounded border border-slate-200 bg-white p-4">
        <label className="block text-sm font-medium text-slate-700">Import a calendar (.ics file)</label>
        <input type="file" accept=".ics,text/calendar" onChange={handleFileChange} className="mt-2 text-sm" />

        {preview && (
          <div className="mt-3">
            <p className="mb-2 text-sm text-slate-600">{preview.length} event(s) found:</p>
            <ul className="mb-3 max-h-40 space-y-1 overflow-y-auto text-sm">
              {preview.map((ev) => (
                <li key={ev.uid} className="rounded bg-slate-50 px-2 py-1">
                  {ev.summary} — {new Date(ev.start).toLocaleString()} ({ev.durationMinutes} min)
                </li>
              ))}
            </ul>
            <button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending}
              className="rounded bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Import {preview.length} event(s)
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700">…or import from a calendar URL</label>
            <input
              type="url"
              value={icsUrl}
              onChange={(e) => setIcsUrl(e.target.value)}
              placeholder="https://example.com/calendar.ics"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => importUrlMutation.mutate()}
            disabled={!icsUrl || importUrlMutation.isPending}
            className="rounded bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Import from URL
          </button>
        </div>

        {importResult && (
          <p className="mt-3 text-sm text-emerald-700">
            Imported {importResult.imported}, skipped {importResult.skippedDuplicates} duplicate(s).
          </p>
        )}
      </div>
    </AppLayout>
  );
}
