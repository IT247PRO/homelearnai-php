import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Edit2, Trash2, ArrowRight } from 'lucide-react';
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Learners & Children</h1>
          <p className="text-xs text-slate-400">
            Manage child profiles, assign grade levels, and customize pacing
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Children Cards List */}
        <div className="lg:col-span-2 space-y-4">
          {childrenQuery.isLoading && (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-xs text-slate-400 shadow-soft-xl">
              Loading learners…
            </div>
          )}

          {!childrenQuery.isLoading && childrenQuery.data?.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-soft-xl">
              <Users className="mx-auto h-10 w-10 text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No children registered yet</h3>
              <p className="text-xs text-slate-500 mt-1">
                Add your first child using the form to get started.
              </p>
            </div>
          )}

          {childrenQuery.data?.map((child) =>
            editingId === child.id ? (
              <div
                key={child.id}
                className="rounded-2xl border border-purple-200 bg-purple-50/50 p-5 shadow-soft-md"
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateChild.mutate(child.id);
                  }}
                  className="space-y-4"
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900">
                    Edit Learner Profile
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`edit-name-${child.id}`} className="block text-xs font-bold text-slate-700">
                        Full Name
                      </label>
                      <input
                        id={`edit-name-${child.id}`}
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>
                    <div>
                      <label htmlFor={`edit-grade-${child.id}`} className="block text-xs font-bold text-slate-700">
                        Grade Level
                      </label>
                      <input
                        id={`edit-grade-${child.id}`}
                        value={editGrade}
                        onChange={(e) => setEditGrade(e.target.value)}
                        placeholder="e.g. 4th"
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={updateChild.isPending}
                      className="rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-4 py-2 text-xs font-bold text-white shadow-soft-xs hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {updateChild.isPending ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-xl bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div
                key={child.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft-xl transition-all hover:shadow-soft-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 text-base font-bold text-white shadow-soft-sm">
                    {child.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/children/${child.id}`}
                        className="font-bold text-slate-800 hover:text-purple-600 transition-colors"
                      >
                        {child.name}
                      </Link>
                      {child.grade && (
                        <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                          Grade {child.grade}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Independence level: {child.independenceLevel}/5
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/children/${child.id}`}
                    className="flex items-center gap-1 rounded-xl bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors"
                  >
                    <span>View Hub</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() => startEdit(child)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100"
                    title="Edit profile"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${child.name}? This removes all of their subjects, units, topics, and history.`)) {
                        deleteChild.mutate(child.id);
                      }
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                    title="Delete child"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {/* Add Child Form Card */}
        <div>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft-xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-xs">
                <Plus className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Add New Learner</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createChild.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="child-name" className="block text-xs font-bold text-slate-700">
                  Child's Name
                </label>
                <input
                  id="child-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Leo"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
              <div>
                <label htmlFor="child-grade" className="block text-xs font-bold text-slate-700">
                  Grade / Age
                </label>
                <input
                  id="child-grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g. 3rd"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
              <button
                type="submit"
                disabled={createChild.isPending}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 py-2.5 text-xs font-bold text-white shadow-soft-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>{createChild.isPending ? 'Adding…' : 'Add Learner'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
