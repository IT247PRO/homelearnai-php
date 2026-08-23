import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

interface ChildDraft {
  name: string;
  grade: string;
}

interface CreatedChild {
  id: number;
  name: string;
}

const TEMPLATE_OPTIONS = [
  { key: 'math', name: 'Math' },
  { key: 'reading', name: 'Reading & Language Arts' },
  { key: 'science', name: 'Science' },
  { key: 'social-studies', name: 'Social Studies' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [childDrafts, setChildDrafts] = useState<ChildDraft[]>([{ name: '', grade: '' }]);
  const [createdChildren, setCreatedChildren] = useState<CreatedChild[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<Record<number, string[]>>({});

  const skip = useMutation({
    mutationFn: async () => {
      await api.patch('/onboarding/skip');
    },
    onSuccess: () => navigate('/dashboard'),
  });

  const createChildren = useMutation({
    mutationFn: async () => {
      const payload = childDrafts.filter((c) => c.name.trim()).map((c) => ({ name: c.name, grade: c.grade || undefined }));
      const { data } = await api.post<{ data: CreatedChild[] }>('/onboarding/children', { children: payload });
      return data.data;
    },
    onSuccess: (children) => {
      setCreatedChildren(children);
      setStep(2);
    },
  });

  const createSubjects = useMutation({
    mutationFn: async () => {
      await Promise.all(
        createdChildren.map((child) => {
          const templateKeys = selectedTemplates[child.id] ?? [];
          if (templateKeys.length === 0) return Promise.resolve();
          return api.post(`/onboarding/subjects`, { childId: child.id, templateKeys });
        })
      );
    },
    onSuccess: () => setStep(3),
  });

  const complete = useMutation({
    mutationFn: async () => {
      await api.patch('/onboarding/complete');
    },
    onSuccess: () => navigate('/dashboard'),
  });

  function toggleTemplate(childId: number, key: string) {
    setSelectedTemplates((prev) => {
      const current = prev[childId] ?? [];
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      return { ...prev, [childId]: next };
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Welcome to HomeLearnAI</h1>
          <button onClick={() => skip.mutate()} className="text-sm text-slate-500 hover:underline">
            Skip for now
          </button>
        </div>

        {step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createChildren.mutate();
            }}
            className="space-y-4"
          >
            <p className="text-sm text-slate-600">Let&rsquo;s start with your child (or children).</p>
            {childDrafts.map((draft, i) => (
              <div key={i} className="flex gap-2">
                <input
                  required
                  value={draft.name}
                  onChange={(e) =>
                    setChildDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, name: e.target.value } : d)))
                  }
                  placeholder="Child's name"
                  aria-label={`Child ${i + 1} name`}
                  className="flex-1 rounded border border-slate-300 px-3 py-2"
                />
                <input
                  value={draft.grade}
                  onChange={(e) =>
                    setChildDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, grade: e.target.value } : d)))
                  }
                  placeholder="Grade (e.g. 3rd)"
                  aria-label={`Child ${i + 1} grade`}
                  className="w-32 rounded border border-slate-300 px-3 py-2"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setChildDrafts((prev) => [...prev, { name: '', grade: '' }])}
              className="text-sm text-brand-600 hover:underline"
            >
              + Add another child
            </button>
            <button
              type="submit"
              disabled={createChildren.isPending}
              className="w-full rounded bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Continue
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <p className="text-sm text-slate-600">Pick a few subjects to start each child off with (optional).</p>
            {createdChildren.map((child) => (
              <div key={child.id}>
                <p className="mb-2 font-medium text-slate-900">{child.name}</p>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_OPTIONS.map((option) => {
                    const isSelected = (selectedTemplates[child.id] ?? []).includes(option.key);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => toggleTemplate(child.id, option.key)}
                        className={`rounded-full border px-3 py-1 text-sm ${isSelected ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600'}`}
                      >
                        {option.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              onClick={() => createSubjects.mutate()}
              disabled={createSubjects.isPending}
              className="w-full rounded bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center">
            <p className="text-3xl">🎉</p>
            <p className="text-lg text-slate-900">You&rsquo;re all set!</p>
            <p className="text-sm text-slate-600">You can add more children, subjects, and flashcards any time.</p>
            <button
              onClick={() => complete.mutate()}
              disabled={complete.isPending}
              className="w-full rounded bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Go to my dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
