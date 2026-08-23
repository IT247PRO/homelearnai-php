import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../components/AppLayout';
import { api } from '../lib/api';

interface Task {
  id: number;
  title: string;
  priority: string;
  status: string;
  dueDate: string | null;
}

const PRIORITY_CLASSES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');

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

  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Tasks</h1>

      <ul className="mb-6 space-y-2">
        {tasksQuery.data?.map((task) => (
          <li key={task.id} className="flex items-center gap-3 rounded border border-slate-200 bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={task.status === 'completed'}
              onChange={() => toggleTask.mutate(task)}
              aria-label={`Mark "${task.title}" as ${task.status === 'completed' ? 'not done' : 'done'}`}
            />
            <span className={`flex-1 ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
              {task.title}
            </span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_CLASSES[task.priority]}`}>
              {task.priority}
            </span>
            <button
              onClick={() => deleteTask.mutate(task.id)}
              aria-label={`Delete "${task.title}"`}
              className="text-slate-400 hover:text-red-600"
            >
              &times;
            </button>
          </li>
        ))}
        {tasksQuery.data?.length === 0 && <p className="text-slate-500">No tasks yet.</p>}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createTask.mutate();
        }}
        className="flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-4"
      >
        <div className="flex-1">
          <label htmlFor="task-title" className="block text-sm font-medium text-slate-700">
            New task
          </label>
          <input
            id="task-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="task-priority" className="block text-sm font-medium text-slate-700">
            Priority
          </label>
          <select
            id="task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1 rounded border border-slate-300 px-3 py-2"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <button type="submit" className="rounded bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
          Add task
        </button>
      </form>
    </AppLayout>
  );
}
