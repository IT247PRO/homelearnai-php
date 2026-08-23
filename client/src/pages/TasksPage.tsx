import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Trash2, Plus } from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { api } from '../lib/api';


interface Task {
  id: number;
  title: string;
  priority: string;
  status: string;
  dueDate: string | null;
}

const PRIORITY_BADGES: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-slate-100', text: 'text-slate-600' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-700' },
  high: { bg: 'bg-amber-100', text: 'text-amber-700' },
  urgent: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Task[] }>('/tasks');
      return data.data;
    },
  });

  const createTask = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: Task }>('/tasks', { title, priority });
      return data.data;
    },
    onSuccess: () => {
      setTitle('');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const toggleTask = useMutation({
    mutationFn: async (task: Task) => {
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
      await api.patch(`/tasks/${task.id}`, { status: nextStatus });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: number) => {
      await api.delete(`/tasks/${taskId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const allTasks = tasksQuery.data ?? [];
  const filteredTasks = allTasks.filter((t) => {
    if (filter === 'pending') return t.status !== 'completed';
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  const pendingCount = allTasks.filter((t) => t.status !== 'completed').length;
  const completedCount = allTasks.filter((t) => t.status === 'completed').length;

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Tasks & To-Dos</h1>
          <p className="text-xs text-slate-400">
            Homeschool chores, lesson preparations, and parent action items
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              filter === 'all' ? 'bg-white text-slate-800 shadow-soft-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All ({allTasks.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              filter === 'pending' ? 'bg-white text-slate-800 shadow-soft-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              filter === 'completed' ? 'bg-white text-slate-800 shadow-soft-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Task List */}
        <div className="lg:col-span-2 space-y-3">
          {tasksQuery.isLoading && (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-xs text-slate-400 shadow-soft-xl">
              Loading tasks…
            </div>
          )}

          {!tasksQuery.isLoading && filteredTasks.length === 0 && (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-soft-xl">
              <CheckCircle2 className="mx-auto h-10 w-10 text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No tasks in this view</h3>
              <p className="text-xs text-slate-500 mt-1">
                {filter === 'completed'
                  ? 'No completed tasks yet. Finish pending tasks to see them here.'
                  : 'You are completely caught up! Add a new task using the form.'}
              </p>
            </div>
          )}

          {filteredTasks.map((task) => {
            const badge = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.medium;
            const isDone = task.status === 'completed';

            return (
              <div
                key={task.id}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-xl transition-all hover:shadow-soft-2xl"
              >
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => toggleTask.mutate(task)}
                    className="shrink-0 text-slate-300 hover:text-purple-600 transition-colors"
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>
                  <span
                    className={`text-xs font-semibold ${
                      isDone ? 'text-slate-400 line-through' : 'text-slate-800'
                    }`}
                  >
                    {task.title}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.bg} ${badge.text}`}
                  >
                    {task.priority}
                  </span>
                  <button
                    onClick={() => deleteTask.mutate(task.id)}
                    aria-label={`Delete "${task.title}"`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Task Card */}
        <div>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft-xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-xs">
                <Plus className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Add New Task</h2>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createTask.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="task-title" className="block text-xs font-bold text-slate-700">
                  Task Title
                </label>
                <input
                  id="task-title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Grade math unit test"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div>
                <label htmlFor="task-priority" className="block text-xs font-bold text-slate-700">
                  Priority Level
                </label>
                <select
                  id="task-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={createTask.isPending}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 py-2.5 text-xs font-bold text-white shadow-soft-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>{createTask.isPending ? 'Adding…' : 'Create Task'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
