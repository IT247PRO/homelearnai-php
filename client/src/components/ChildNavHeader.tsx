import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  BookOpen,
  Calendar,
  Kanban,
  Brain,
  Sparkles,
  Play,
  Layers,
  ChevronDown,
  X,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { api, apiErrorBody } from '../lib/api';

interface Child {
  id: number;
  name: string;
  grade: string | null;
  independenceLevel?: number;
}

interface ChildNavHeaderProps {
  childId: number;
  activeTab?: 'curriculum' | 'planning' | 'calendar' | 'review' | 'ai' | 'curricula';
}

export function ChildNavHeader({ childId, activeTab }: ChildNavHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [kidsModalOpen, setKidsModalOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const childrenQuery = useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Child[] }>('/children');
      return data.data;
    },
  });

  const activeChild = childrenQuery.data?.find((c) => c.id === childId);

  const enterKidsMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/kids-mode/${childId}/enter`, { pin });
    },
    onSuccess: () => navigate('/kids'),
    onError: (err) => setError(apiErrorBody(err)?.error ?? 'Could not enter Kids Mode. Check PIN in Settings.'),
  });

  const tabs = [
    {
      id: 'curriculum',
      label: 'Curriculum & Subjects',
      icon: BookOpen,
      to: `/children/${childId}`,
      active: location.pathname === `/children/${childId}`,
    },
    {
      id: 'planning',
      label: 'Planning Board',
      icon: Kanban,
      to: `/children/${childId}/planning`,
      active: location.pathname.includes('/planning'),
    },
    {
      id: 'calendar',
      label: 'Schedule & Blocks',
      icon: Calendar,
      to: `/children/${childId}/calendar`,
      active: location.pathname.includes('/calendar'),
    },
    {
      id: 'review',
      label: 'Flashcard Review',
      icon: Brain,
      to: `/children/${childId}/review`,
      active: location.pathname.includes('/review'),
    },
    {
      id: 'ai',
      label: 'AI Curriculum',
      icon: Sparkles,
      to: `/children/${childId}/ai`,
      active: location.pathname.includes('/ai'),
    },
    {
      id: 'curricula',
      label: 'Import Course',
      icon: Layers,
      to: `/curricula/new?childId=${childId}`,
      active: location.pathname.includes('/curricula/new'),
    },
  ];

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft-xl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar with gradient */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 text-base font-bold text-white shadow-soft-md">
            {activeChild?.name ? activeChild.name.charAt(0).toUpperCase() : 'C'}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">
                {activeChild?.name ?? `Child #${childId}`}
              </h2>
              {activeChild?.grade && (
                <span className="rounded-lg bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                  Grade {activeChild.grade}
                </span>
              )}

              {/* Sibling dropdown switcher */}
              {childrenQuery.data && childrenQuery.data.length > 1 && (
                <div className="relative group">
                  <button className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <span>Switch</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <div className="invisible absolute left-0 top-full z-20 mt-1 w-44 rounded-xl border border-slate-100 bg-white py-1.5 shadow-soft-xl opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                    <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Select Learner
                    </p>
                    {childrenQuery.data.map((c) => (
                      <Link
                        key={c.id}
                        to={`/children/${c.id}${location.pathname.includes('/planning') ? '/planning' : location.pathname.includes('/calendar') ? '/calendar' : location.pathname.includes('/review') ? '/review' : location.pathname.includes('/ai') ? '/ai' : ''}`}
                        className={`flex items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-slate-50 ${
                          c.id === childId ? 'font-bold text-purple-600' : 'text-slate-700'
                        }`}
                      >
                        <span>{c.name}</span>
                        {c.grade && <span className="text-[10px] text-slate-400">Gr {c.grade}</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate">
              Personalized Homeschool Learning Hub
            </p>
          </div>
        </div>

        {/* Quick Kids Mode Launcher Button */}
        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-end">
          <button
            onClick={() => setKidsModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-tl from-amber-500 to-orange-400 px-3.5 py-2 text-xs font-bold text-white shadow-soft-md transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Launch Kids Mode</span>
          </button>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex overflow-x-auto px-4 py-2.5 sm:px-6 no-scrollbar">
        <nav className="flex space-x-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isCurrent = tab.active || (activeTab && activeTab === tab.id);
            return (
              <Link
                key={tab.id}
                to={tab.to}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  isCurrent
                    ? 'bg-slate-900 text-white shadow-soft-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${isCurrent ? 'text-purple-300' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Kids Mode Modal */}
      {kidsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-soft-2xl">
            <button
              onClick={() => {
                setKidsModalOpen(false);
                setError(null);
                setPin('');
              }}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shadow-soft-sm">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Launch Kids Mode</h3>
                <p className="text-xs text-slate-500">For {activeChild?.name ?? 'Learner'}</p>
              </div>
            </div>

            <p className="mb-4 text-xs text-slate-600">
              Enter your parent PIN if configured to start the child-friendly learning player session.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                enterKidsMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700">Parent PIN (optional if not set)</label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="PIN or leave blank"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-soft-xs focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  autoFocus
                />
              </div>

              {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setKidsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enterKidsMutation.isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-4 py-2 text-xs font-bold text-white shadow-soft-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Start Learning</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
