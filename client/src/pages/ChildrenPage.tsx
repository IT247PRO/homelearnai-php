import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../components/AppLayout';
import { api } from '../lib/api';

interface Child {
  id: number;
  name: string;
  grade: string | null;
  independenceLevel: number;
}

export default function ChildrenPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState('');

  const childrenQuery = useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Child[] }>('/children');
      return data.data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['children'] });

  const createChild = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: Child }>('/children', { name, grade: grade || null });
      return data.data;
    },
    onSuccess: () => {
      setName('');
      setGrade('');
      invalidate();
    },
  });

  const updateChild = useMutation({
    mutationFn: async (childId: number) => {
      await api.patch(`/children/${childId}`, { name: editName, grade: editGrade || null });
    },
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  const deleteChild = useMutation({
    mutationFn: async (childId: number) => {
      await api.delete(`/children/${childId}`);
    },
    onSuccess: invalidate,
  });

  function startEdit(child: Child) {
    setEditingId(child.id);
    setEditName(child.name);
    setEditGrade(child.grade ?? '');
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Children</h1>

      <ul className="mb-6 space-y-2">
        {childrenQuery.data?.map((child) =>
          editingId === child.id ? (
            <li key={child.id}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateChild.mutate(child.id);
                }}
                className="flex flex-wrap items-end gap-3 rounded border border-brand-300 bg-white p-3"
              >
                <div>
                  <label htmlFor={`edit-name-${child.id}`} className="block text-xs font-medium text-slate-700">
                    Name
                  </label>
                  <input
                    id={`edit-name-${child.id}`}
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`edit-grade-${child.id}`} className="block text-xs font-medium text-slate-700">
                    Grade
                  </label>
                  <input
                    id={`edit-grade-${child.id}`}
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value)}
                    className="mt-1 w-24 rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <button type="submit" disabled={updateChild.isPending} className="rounded bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700">
                  Save
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200">
                  Cancel
                </button>
              </form>
            </li>
          ) : (
            <li key={child.id} className="flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-3 hover:border-brand-500">
              <Link to={`/children/${child.id}`} className="flex-1">
                <span className="font-medium text-slate-900">{child.name}</span>
                {child.grade && <span className="ml-2 text-sm text-slate-500">Grade: {child.grade}</span>}
              </Link>
              <button onClick={() => startEdit(child)} className="text-sm text-brand-600 hover:underline">
                Edit
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete ${child.name}? This removes all of their subjects, units, topics, and history.`)) {
                    deleteChild.mutate(child.id);
                  }
                }}
                className="text-sm text-red-600 hover:underline"
              >
                Delete
              </button>
            </li>
          )
        )}
        {childrenQuery.data?.length === 0 && <p className="text-slate-500">No children yet — add one below.</p>}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createChild.mutate();
        }}
        className="flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-4"
      >
        <div>
          <label htmlFor="child-name" className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="child-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="child-grade" className="block text-sm font-medium text-slate-700">
            Grade
          </label>
          <input
            id="child-grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="e.g. 3rd"
            className="mt-1 w-24 rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={createChild.isPending}
          className="rounded bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Add child
        </button>
      </form>
    </AppLayout>
  );
}
