import { useState } from 'react';

export interface TimeBlockFormState {
  label: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  commitmentType: string;
}

export const BLANK_TIME_BLOCK: TimeBlockFormState = { label: '', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', commitmentType: 'preferred' };

export const WEEKDAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TimeBlockForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial: TimeBlockFormState;
  onSubmit: (values: TimeBlockFormState) => void;
  onCancel?: () => void;
  submitting: boolean;
}) {
  const [values, setValues] = useState(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-white p-3 text-sm"
    >
      <div>
        <label className="block text-xs font-medium text-slate-700">Label</label>
        <input
          required
          value={values.label}
          onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
          className="mt-1 rounded border border-slate-300 px-2 py-1"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Day</label>
        <select
          value={values.dayOfWeek}
          onChange={(e) => setValues((v) => ({ ...v, dayOfWeek: Number(e.target.value) }))}
          className="mt-1 rounded border border-slate-300 px-2 py-1"
        >
          {WEEKDAY_NAMES.slice(1).map((day, i) => (
            <option key={day} value={i + 1}>
              {day}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Start</label>
        <input
          type="time"
          value={values.startTime}
          onChange={(e) => setValues((v) => ({ ...v, startTime: e.target.value }))}
          className="mt-1 rounded border border-slate-300 px-2 py-1"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">End</label>
        <input
          type="time"
          value={values.endTime}
          onChange={(e) => setValues((v) => ({ ...v, endTime: e.target.value }))}
          className="mt-1 rounded border border-slate-300 px-2 py-1"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Commitment</label>
        <select
          value={values.commitmentType}
          onChange={(e) => setValues((v) => ({ ...v, commitmentType: e.target.value }))}
          className="mt-1 rounded border border-slate-300 px-2 py-1"
        >
          <option value="fixed">Fixed</option>
          <option value="preferred">Preferred</option>
          <option value="flexible">Flexible</option>
        </select>
      </div>
      <button type="submit" disabled={submitting} className="rounded bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700 disabled:opacity-50">
        Save
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="rounded bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-slate-200">
          Cancel
        </button>
      )}
    </form>
  );
}
