import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Sparkles,
  Brain,
  Award,
  Flame,
  CheckCircle2,
  Play,
  Volume2,
  VolumeX,
  Search,
  ChevronRight,
  FileText,
  HelpCircle,
  Star,
  Compass,
  Clock,
  ArrowRight,
  Check,
  Lock,
  X,
  Trophy,
  Book,
  FileCheck,
} from 'lucide-react';
import { api, apiErrorBody } from '../lib/api';
import { RichContent } from '../components/RichContent';
import { TutorChat } from '../components/TutorChat';

/* ======================================================================================= */
/* TYPE DEFINITIONS                                                                        */
/* ======================================================================================= */
interface KidsChild {
  id: number;
  name: string;
  grade: string | null;
  independenceLevel?: string;
  avatarUrl?: string | null;
}

interface GamificationState {
  totalPoints: number;
  level: number;
  currentStreakDays: number;
  longestStreakDays: number;
  gamificationEnabled: boolean;
}

interface Achievement {
  id: number;
  title: string;
  description: string;
  iconUrl?: string | null;
  badgeCategory: string;
  points: number;
  earnedAt?: string;
}

interface ChildAchievementItem {
  id: number;
  earnedAt: string;
  achievement: Achievement;
}

interface LessonSummary {
  id: number;
  title: string;
  status: string;
  estimatedMinutes: number | null;
  progress?: { completedAt: string | null; currentSectionIndex: number }[];
}

interface AssessmentSummary {
  id: number;
  title: string;
  questions?: { id: number }[];
  attempts?: { id: number; score: number | null; status: string; completedAt?: string }[];
}

interface TopicItem {
  id: number;
  title: string;
  learningContent: string | null;
  estimatedMinutes: number;
  sortOrder?: number;
  lessons: LessonSummary[];
  assessments: AssessmentSummary[];
  flashcards: { id: number }[];
  fileAssets?: { id: number; kind: string; label: string | null; originalName: string; url: string | null }[];
  masteries?: { state: string; accuracy: number | null }[];
}

interface UnitItem {
  id: number;
  name: string;
  description?: string | null;
  sortOrder?: number;
  topics: TopicItem[];
}

interface SubjectItem {
  id: number;
  name: string;
  color: string;
  units: UnitItem[];
}

interface KidsSession {
  id: number;
  status: string;
  scheduledDate?: string | null;
  scheduledStartTime?: string | null;
  lessonId: number | null;
  lesson?: { id: number; title: string; status: string } | null;
  topic: {
    id: number;
    title: string;
    estimatedMinutes: number;
    unit?: { name: string; subject?: { name: string; color: string } };
    lessons?: { id: number; title: string; status: string; estimatedMinutes: number | null }[];
    assessments?: { id: number; title: string }[];
  };
}

interface KidsOverviewData {
  child: KidsChild;
  gamification: GamificationState;
  achievements: ChildAchievementItem[];
  todaySessions: KidsSession[];
  reviewQueueCount: number;
  subjects: SubjectItem[];
}

interface KidsModeSettings {
  hasPinSetup: boolean;
  isLocked: boolean;
  lockedUntil: string | null;
}

type KidsHubTab = 'today' | 'subjects' | 'reading' | 'quizzes' | 'flashcards' | 'tutor' | 'badges';

export default function KidsHomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Navigation State
  const [activeTab, setActiveTab] = useState<KidsHubTab>('today');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedTopicDetail, setSelectedTopicDetail] = useState<TopicItem | null>(null);
  const [readingTopic, setReadingTopic] = useState<{ id: number; title: string; content: string; subjectName?: string; subjectColor?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<number | 'all'>('all');

  // Exit PIN Flow
  const [exiting, setExiting] = useState(false);
  const [pin, setPin] = useState('');
  const [exitError, setExitError] = useState<string | null>(null);

  // Fetch Full Kids Overview Data (Single unified request for instant speed)
  const overviewQuery = useQuery({
    queryKey: ['kids-overview'],
    queryFn: async () => {
      const { data } = await api.get<{ data: KidsOverviewData }>('/kids/overview');
      return data.data;
    },
  });

  const settingsQuery = useQuery({
    queryKey: ['kids-mode-settings'],
    queryFn: async () => {
      const { data } = await api.get<{ data: KidsModeSettings }>('/kids-mode/settings');
      return data.data;
    },
    enabled: exiting,
  });

  const completeSession = useMutation({
    mutationFn: async (sessionId: number) => {
      await api.post(`/kids/sessions/${sessionId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kids-overview'] });
    },
  });

  const exitMutation = useMutation({
    mutationFn: async () => {
      await api.post('/kids-mode/exit', { pin });
    },
    onSuccess: () => navigate('/dashboard'),
    onError: (err) => {
      setExitError(apiErrorBody(err)?.error ?? 'Wrong PIN');
      setPin('');
      queryClient.invalidateQueries({ queryKey: ['kids-mode-settings'] });
    },
  });

  const overview = overviewQuery.data;
  const child = overview?.child;
  const gamification = overview?.gamification ?? { totalPoints: 0, level: 1, currentStreakDays: 0, longestStreakDays: 0, gamificationEnabled: true };
  const subjects = useMemo(() => overview?.subjects ?? [], [overview?.subjects]);
  const todaySessions = overview?.todaySessions ?? [];
  const reviewQueueCount = overview?.reviewQueueCount ?? 0;
  const achievements = overview?.achievements ?? [];

  // Flattened Topics with Reading Content
  const allReadingTopics = useMemo(() => {
    const list: {
      topic: TopicItem;
      unitName: string;
      subjectName: string;
      subjectColor: string;
    }[] = [];

    subjects.forEach((subj) => {
      subj.units.forEach((unit) => {
        unit.topics.forEach((topic) => {
          if (topic.learningContent && topic.learningContent.trim().length > 0) {
            list.push({
              topic,
              unitName: unit.name,
              subjectName: subj.name,
              subjectColor: subj.color || '#7928CA',
            });
          }
        });
      });
    });
    return list;
  }, [subjects]);

  // Flattened Assessments / Quizzes
  const allQuizzes = useMemo(() => {
    const list: {
      assessment: AssessmentSummary;
      topicTitle: string;
      subjectName: string;
      subjectColor: string;
    }[] = [];

    subjects.forEach((subj) => {
      subj.units.forEach((unit) => {
        unit.topics.forEach((topic) => {
          topic.assessments.forEach((assessment) => {
            list.push({
              assessment,
              topicTitle: topic.title,
              subjectName: subj.name,
              subjectColor: subj.color || '#7928CA',
            });
          });
        });
      });
    });
    return list;
  }, [subjects]);

  // Filtered reading items based on search & subject filter
  const filteredReading = useMemo(() => {
    return allReadingTopics.filter((item) => {
      const matchSubject = selectedSubjectFilter === 'all' || item.subjectName === subjects.find((s) => s.id === selectedSubjectFilter)?.name;
      const matchSearch = searchQuery === '' || item.topic.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.unitName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSubject && matchSearch;
    });
  }, [allReadingTopics, selectedSubjectFilter, searchQuery, subjects]);

  if (overviewQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-soft-xl max-w-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-4">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Kids Mode Inactive</h2>
          <p className="mb-6 mt-2 text-xs font-medium text-slate-500">
            Kids Mode isn't active or your child profile is not selected right now.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-5 py-2.5 text-xs font-bold text-white shadow-soft-xs hover:opacity-95"
          >
            <span>Go to Parent Dashboard</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 font-sans antialiased text-slate-800">
      {/* ========================================================================= */}
      {/* TOP KIDS BANNER & GAMIFICATION BAR                                        */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md shadow-soft-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex h-18 items-center justify-between gap-4">
            {/* Left: Avatar & Child Greeting */}
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-400 text-white font-extrabold text-lg shadow-soft-sm ring-2 ring-purple-100">
                {child?.name ? child.name.charAt(0).toUpperCase() : '🌟'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Hey, {child?.name || 'Explorer'}! 👋
                  </h1>
                  <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-extrabold text-purple-700 uppercase tracking-wider">
                    {child?.grade ? `${child.grade}` : 'Student'}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-400">
                  Ready to conquer today's learning quest?
                </p>
              </div>
            </div>

            {/* Middle: Gamification Badges & Streak Counters */}
            <div className="hidden md:flex items-center gap-3">
              {/* Level Badge */}
              <div className="flex items-center gap-2 rounded-2xl border border-purple-100 bg-purple-50/70 px-3.5 py-1.5 shadow-soft-xs">
                <Trophy className="h-4 w-4 text-purple-600" />
                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-purple-500">Level {gamification.level}</div>
                  <div className="text-xs font-black text-purple-900">{gamification.totalPoints} XP</div>
                </div>
              </div>

              {/* Streak Badge */}
              <div className="flex items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50/70 px-3.5 py-1.5 shadow-soft-xs">
                <Flame className="h-4 w-4 text-amber-500 fill-amber-400 animate-pulse" />
                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-amber-600">Streak</div>
                  <div className="text-xs font-black text-amber-900">{gamification.currentStreakDays} Days</div>
                </div>
              </div>

              {/* Flashcards Queue Badge */}
              <Link
                to="/kids/review"
                className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-1.5 shadow-soft-xs hover:bg-emerald-100/70 transition-colors"
                title="Review Flashcards"
              >
                <Brain className="h-4 w-4 text-emerald-600" />
                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600">Flashcards</div>
                  <div className="text-xs font-black text-emerald-900">{reviewQueueCount} Due</div>
                </div>
              </Link>
            </div>

            {/* Right: Parent Mode Exit Gate */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExiting(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-soft-xs"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Parent Exit</span>
              </button>
            </div>
          </div>

          {/* Hub Navigation Tabs Bar */}
          <nav className="flex items-center gap-1 overflow-x-auto py-2.5 border-t border-slate-100 no-scrollbar">
            <button
              onClick={() => setActiveTab('today')}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'today'
                  ? 'bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>Today's Quest</span>
              {todaySessions.filter((s) => s.status !== 'done').length > 0 && (
                <span className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${activeTab === 'today' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'}`}>
                  {todaySessions.filter((s) => s.status !== 'done').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('subjects')}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'subjects'
                  ? 'bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Courses & Subjects</span>
            </button>

            <button
              onClick={() => setActiveTab('reading')}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'reading'
                  ? 'bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Reading Studio</span>
              <span className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${activeTab === 'reading' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {allReadingTopics.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('quizzes')}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'quizzes'
                  ? 'bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileCheck className="h-4 w-4" />
              <span>Quizzes & Tests</span>
              <span className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${activeTab === 'quizzes' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {allQuizzes.length}
              </span>
            </button>

            <Link
              to="/kids/review"
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all text-slate-600 hover:bg-slate-100 hover:text-slate-900`}
            >
              <Brain className="h-4 w-4 text-emerald-600" />
              <span>Flashcard Practice</span>
            </Link>

            <button
              onClick={() => setActiveTab('tutor')}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'tutor'
                  ? 'bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <HelpCircle className="h-4 w-4" />
              <span>AI Study Buddy</span>
            </button>

            <button
              onClick={() => setActiveTab('badges')}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'badges'
                  ? 'bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Award className="h-4 w-4" />
              <span>Badges & Trophies</span>
              {achievements.length > 0 && (
                <span className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${activeTab === 'badges' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                  {achievements.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* PARENT EXIT PIN MODAL                                                     */}
      {/* ========================================================================= */}
      {exiting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 shadow-soft-2xl animate-in fade-in zoom-in-95">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-800">Exit Kids Mode</h3>
              </div>
              <button
                onClick={() => setExiting(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {settingsQuery.data?.hasPinSetup === false ? (
              <div className="space-y-4 text-xs font-medium text-slate-600">
                <p>A parent PIN hasn't been set up yet. You can return directly to the dashboard.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="flex-1 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 py-2.5 text-xs font-bold text-white shadow-soft-xs"
                  >
                    Go to Parent Dashboard
                  </button>
                  <button
                    onClick={() => setExiting(false)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : settingsQuery.data?.isLocked ? (
              <div className="space-y-4">
                <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  Too many incorrect attempts.{' '}
                  {settingsQuery.data.lockedUntil &&
                    `Try again after ${new Date(settingsQuery.data.lockedUntil).toLocaleTimeString()}.`}
                </p>
                <button
                  onClick={() => setExiting(false)}
                  className="w-full rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700"
                >
                  Back to Hub
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  exitMutation.mutate();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Enter Parent PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-center text-lg font-bold tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    autoFocus
                  />
                </div>
                {exitError && <p className="text-xs font-semibold text-red-600">{exitError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={exitMutation.isPending || !pin}
                    className="flex-1 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 py-2.5 text-xs font-bold text-white shadow-soft-xs disabled:opacity-50"
                  >
                    {exitMutation.isPending ? 'Verifying…' : 'Unlock & Exit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExiting(false)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN HUB WORKSPACE CONTAINER (End to End responsive layout)              */}
      {/* ========================================================================= */}
      <main className="w-full px-4 sm:px-6 lg:px-8 pt-6">
        {/* TAB 1: TODAY'S QUEST & MISSIONS */}
        {activeTab === 'today' && (
          <div className="space-y-6">
            {/* Quick Hero Banner */}
            <div className="rounded-3xl border border-purple-100 bg-gradient-to-r from-purple-700 via-indigo-600 to-pink-600 p-6 text-white shadow-soft-xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-xl">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold backdrop-blur-md">
                    <Sparkles className="h-3.5 w-3.5" /> Daily Mission Central
                  </span>
                  <h2 className="text-2xl font-black tracking-tight">Today's Learning Adventure</h2>
                  <p className="text-xs text-purple-100 leading-relaxed font-medium">
                    Complete your daily tasks below to earn XP, level up your badge collection, and keep your learning streak on fire! 🔥
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    to="/kids/review"
                    className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-purple-900 shadow-soft-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Brain className="h-4 w-4 text-purple-600" />
                    <span>Review Cards ({reviewQueueCount})</span>
                  </Link>
                  <button
                    onClick={() => setActiveTab('reading')}
                    className="flex items-center gap-2 rounded-2xl bg-white/10 border border-white/20 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md hover:bg-white/20 transition-all"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Explore Reading</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Today's Tasks Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-slate-800">Your Scheduled Missions</h3>
                  <p className="text-xs text-slate-400">
                    {todaySessions.length} {todaySessions.length === 1 ? 'activity' : 'activities'} planned for today
                  </p>
                </div>
              </div>

              {todaySessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-soft-xs">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 mb-3 shadow-soft-sm">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h4 className="font-bold text-base text-slate-800">All Caught Up for Today!</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    You've finished everything planned! You can explore subjects, read fun stories, or practice flashcards.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setActiveTab('subjects')}
                      className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-soft-xs hover:bg-purple-700"
                    >
                      Browse Subjects
                    </button>
                    <Link
                      to="/kids/review"
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      Practice Flashcards
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {todaySessions.map((session) => {
                    const isDone = session.status === 'done';
                    const subjectColor = session.topic.unit?.subject?.color || '#7928CA';
                    const subjectName = session.topic.unit?.subject?.name || 'General';

                    return (
                      <div
                        key={session.id}
                        className={`group relative rounded-3xl border p-5 transition-all ${
                          isDone
                            ? 'border-emerald-200 bg-emerald-50/30'
                            : 'border-slate-100 bg-white shadow-soft-sm hover:shadow-soft-md hover:border-purple-200'
                        }`}
                      >
                        {/* Subject Tag */}
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className="rounded-xl px-2.5 py-1 text-[10px] font-bold text-white shadow-soft-xs"
                            style={{ backgroundColor: subjectColor }}
                          >
                            {subjectName}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                            <Clock className="h-3 w-3" /> {session.topic.estimatedMinutes} min
                          </span>
                        </div>

                        {/* Title & Unit */}
                        <div className="mb-4">
                          <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{session.topic.title}</h4>
                          {session.topic.unit && (
                            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                              Unit: {session.topic.unit.name}
                            </p>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          {isDone ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                              <CheckCircle2 className="h-4 w-4" /> Completed! (+10 XP)
                            </span>
                          ) : (
                            <div className="flex items-center gap-2 w-full">
                              {session.lessonId ? (
                                <Link
                                  to={`/kids/lessons/${session.lessonId}`}
                                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 py-2 text-xs font-bold text-white shadow-soft-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                  <Play className="h-3.5 w-3.5 fill-current" />
                                  <span>Start Lesson</span>
                                </Link>
                              ) : (
                                <button
                                  onClick={() => completeSession.mutate(session.id)}
                                  disabled={completeSession.isPending}
                                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-soft-xs hover:bg-emerald-700 transition-all"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Mark Done</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  // Open reading if available
                                  const foundTopic = subjects
                                    .flatMap((s) => s.units)
                                    .flatMap((u) => u.topics)
                                    .find((t) => t.id === session.topic.id);
                                  if (foundTopic) setSelectedTopicDetail(foundTopic);
                                }}
                                className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                                title="Inspect Details"
                              >
                                <Compass className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: COURSES & SUBJECTS HIERARCHY */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">Your Learning Courses</h3>
                <p className="text-xs text-slate-400">
                  Explore curriculum units, lessons, quizzes, and practice materials for every subject.
                </p>
              </div>

              {/* Subject Tabs Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setSelectedSubjectId(null)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    selectedSubjectId === null
                      ? 'bg-slate-900 text-white shadow-soft-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All Subjects ({subjects.length})
                </button>
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSubjectId(s.id)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                      selectedSubjectId === s.id
                        ? 'text-white shadow-soft-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    style={selectedSubjectId === s.id ? { backgroundColor: s.color || '#7928CA' } : {}}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color || '#7928CA' }} />
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Subjects Grid & Detailed Units */}
            <div className="space-y-8">
              {subjects
                .filter((s) => selectedSubjectId === null || s.id === selectedSubjectId)
                .map((subject) => (
                  <div
                    key={subject.id}
                    className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft-sm"
                  >
                    {/* Subject Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-2xl text-white font-black text-base shadow-soft-xs"
                          style={{ backgroundColor: subject.color || '#7928CA' }}
                        >
                          <Book className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-base text-slate-900">{subject.name}</h4>
                          <p className="text-xs text-slate-400">
                            {subject.units.length} {subject.units.length === 1 ? 'Unit' : 'Units'} •{' '}
                            {subject.units.reduce((acc, u) => acc + u.topics.length, 0)} Topics
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Units Accordion */}
                    <div className="space-y-4">
                      {subject.units.map((unit, uIdx) => (
                        <div
                          key={unit.id}
                          className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100 text-[11px] font-bold text-purple-700">
                                {uIdx + 1}
                              </span>
                              <h5 className="font-bold text-xs text-slate-800">{unit.name}</h5>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-400">
                              {unit.topics.length} topics
                            </span>
                          </div>

                          {/* Topics List within Unit */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {unit.topics.map((topic) => {
                              const hasLesson = topic.lessons.length > 0;
                              const hasQuiz = topic.assessments.length > 0;
                              const hasReading = Boolean(topic.learningContent && topic.learningContent.length > 0);

                              return (
                                <div
                                  key={topic.id}
                                  onClick={() => setSelectedTopicDetail(topic)}
                                  className="group rounded-xl border border-slate-200/80 bg-white p-3.5 cursor-pointer shadow-soft-xs hover:border-purple-300 hover:shadow-soft-md transition-all"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <h6 className="font-bold text-xs text-slate-800 group-hover:text-purple-700 transition-colors line-clamp-1">
                                      {topic.title}
                                    </h6>
                                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-purple-600 transition-colors shrink-0" />
                                  </div>

                                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                    {hasReading && (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                        <FileText className="h-2.5 w-2.5" /> Reading
                                      </span>
                                    )}
                                    {hasLesson && (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                                        <Play className="h-2.5 w-2.5" /> Lesson
                                      </span>
                                    )}
                                    {hasQuiz && (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-pink-50 px-2 py-0.5 text-[10px] font-bold text-pink-700">
                                        <FileCheck className="h-2.5 w-2.5" /> Quiz
                                      </span>
                                    )}
                                    {topic.flashcards.length > 0 && (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                        <Brain className="h-2.5 w-2.5" /> {topic.flashcards.length} Cards
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 3: READING STUDIO & LIBRARY */}
        {activeTab === 'reading' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">Reading Studio & Library 📖</h3>
                <p className="text-xs text-slate-400">
                  Read illustrated topic guides, stories, and background notes to boost your knowledge.
                </p>
              </div>

              {/* Search & Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search reading topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  aria-label="Filter reading materials by subject"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
                >
                  <option value="all">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredReading.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-soft-xs">
                <p className="text-xs font-bold text-slate-600">No reading materials found matching your search</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredReading.map(({ topic, unitName, subjectName, subjectColor }) => (
                  <div
                    key={topic.id}
                    className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-soft-sm hover:shadow-soft-md hover:border-purple-200 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className="rounded-lg px-2 py-0.5 text-[10px] font-extrabold text-white"
                          style={{ backgroundColor: subjectColor }}
                        >
                          {subjectName}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">Unit: {unitName}</span>
                      </div>

                      <h4 className="font-extrabold text-sm text-slate-900 mb-2 group-hover:text-purple-700 transition-colors">
                        {topic.title}
                      </h4>

                      <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed font-normal">
                        {topic.learningContent?.replace(/<[^>]*>?/gm, '').slice(0, 150)}...
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400">~{topic.estimatedMinutes} min read</span>
                      <button
                        onClick={() =>
                          setReadingTopic({
                            id: topic.id,
                            title: topic.title,
                            content: topic.learningContent || '',
                            subjectName,
                            subjectColor,
                          })
                        }
                        className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:bg-purple-700 transition-all"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Read Now</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: QUIZZES & TESTS */}
        {activeTab === 'quizzes' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">Quizzes & Knowledge Checks 🎯</h3>
              <p className="text-xs text-slate-400">
                Test what you've learned and earn badges and high scores!
              </p>
            </div>

            {allQuizzes.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-soft-xs">
                <p className="text-xs font-bold text-slate-600">No quizzes available yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {allQuizzes.map(({ assessment, topicTitle, subjectName, subjectColor }) => {
                  const latestAttempt = assessment.attempts?.[0];
                  const scorePercent = latestAttempt?.score !== null && latestAttempt?.score !== undefined ? Math.round(latestAttempt.score * 100) : null;

                  return (
                    <div
                      key={assessment.id}
                      className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft-sm hover:shadow-soft-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className="rounded-lg px-2 py-0.5 text-[10px] font-extrabold text-white"
                            style={{ backgroundColor: subjectColor }}
                          >
                            {subjectName}
                          </span>
                          {scorePercent !== null && (
                            <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-100">
                              <Star className="h-3 w-3 fill-emerald-500" /> {scorePercent}%
                            </span>
                          )}
                        </div>

                        <h4 className="font-extrabold text-sm text-slate-900 mb-1">{assessment.title}</h4>
                        <p className="text-xs text-slate-400">Topic: {topicTitle}</p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">
                          {assessment.questions?.length ?? 5} Questions
                        </span>
                        <Link
                          to={`/kids/assessments/${assessment.id}`}
                          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-4 py-2 text-xs font-bold text-white shadow-soft-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>{latestAttempt ? 'Retake Quiz' : 'Take Quiz'}</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: AI STUDY BUDDY & TUTOR */}
        {activeTab === 'tutor' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-soft-xl">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white shadow-soft-md">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">AI Study Buddy & Friendly Tutor 🤖</h3>
                  <p className="text-xs text-slate-400">
                    Ask any question, get simple explanations, practice puzzles, or ask for help with your homework.
                  </p>
                </div>
              </div>

              {/* Suggested prompt starter chips */}
              <div className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Explain gravity like I am 8 years old',
                    'Give me a fun science riddle',
                    'How do plants make their own food?',
                    'Can you quiz me on solar system facts?',
                    'Help me understand fractions with pizza slices',
                  ].map((prompt, pIdx) => (
                    <button
                      key={pIdx}
                      className="rounded-xl border border-purple-200/80 bg-purple-50/50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-colors"
                      onClick={() => {
                        const inputEl = document.querySelector('textarea, input[placeholder*="Ask"]') as HTMLInputElement;
                        if (inputEl) {
                          inputEl.value = prompt;
                          inputEl.focus();
                        }
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tutor Chat Integration */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-2">
                {subjects.length > 0 && subjects[0].units.length > 0 && subjects[0].units[0].topics.length > 0 ? (
                  <TutorChat
                    kidsStyle
                    messagesUrl={`/kids/topics/${subjects[0].units[0].topics[0].id}/tutor/messages`}
                  />
                ) : (
                  <p className="p-8 text-center text-xs text-slate-400">Select a course to chat with the AI tutor.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: BADGES & ACHIEVEMENTS */}
        {activeTab === 'badges' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-amber-100 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 p-6 text-white shadow-soft-xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold backdrop-blur-md">
                    <Trophy className="h-3.5 w-3.5" /> Hall of Achievements
                  </span>
                  <h2 className="text-2xl font-black">Your Trophy Case</h2>
                  <p className="text-xs text-amber-100 font-medium">
                    You have unlocked {achievements.length} achievements so far! Keep completing lessons and reviews to unlock more.
                  </p>
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-2 backdrop-blur-md">
                  <Star className="h-5 w-5 text-amber-200 fill-amber-200" />
                  <div>
                    <div className="text-[10px] font-bold uppercase text-amber-100">Total Points</div>
                    <div className="text-base font-black">{gamification.totalPoints} XP</div>
                  </div>
                </div>
              </div>
            </div>

            {achievements.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-soft-xs">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-3">
                  <Award className="h-7 w-7" />
                </div>
                <h4 className="font-bold text-base text-slate-800">Your First Badge Awaits!</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Complete your first lesson, finish a quiz, or review 5 flashcards to unlock your first shiny badge!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {achievements.map(({ id, earnedAt, achievement }) => (
                  <div
                    key={id}
                    className="rounded-3xl border border-slate-100 bg-white p-5 text-center shadow-soft-sm hover:shadow-soft-md hover:scale-[1.02] transition-all"
                  >
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-400 via-orange-400 to-pink-500 text-white shadow-soft-md mb-3">
                      <Award className="h-8 w-8" />
                    </div>
                    <h5 className="font-extrabold text-sm text-slate-900">{achievement.title}</h5>
                    <p className="text-xs text-slate-400 mt-1">{achievement.description}</p>
                    <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/60">
                      +{achievement.points} XP • {new Date(earnedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* TOPIC DETAIL MODAL / DRAWER                                               */}
      {/* ========================================================================= */}
      {selectedTopicDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 shadow-soft-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                  Topic Activities
                </span>
                <h3 className="font-extrabold text-lg text-slate-900 mt-1">{selectedTopicDetail.title}</h3>
              </div>
              <button
                onClick={() => setSelectedTopicDetail(null)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Reading Passage preview */}
              {selectedTopicDetail.learningContent && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                      <FileText className="h-4 w-4 text-blue-600" /> Reading Passage
                    </span>
                    <button
                      onClick={() => {
                        setReadingTopic({
                          id: selectedTopicDetail.id,
                          title: selectedTopicDetail.title,
                          content: selectedTopicDetail.learningContent || '',
                        });
                        setSelectedTopicDetail(null);
                      }}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Open Full Screen Reader →
                    </button>
                  </div>
                  <div className="text-xs text-slate-600 line-clamp-3 leading-relaxed font-medium">
                    {selectedTopicDetail.learningContent.replace(/<[^>]*>?/gm, '')}
                  </div>
                </div>
              )}

              {/* Lessons Available */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Lessons ({selectedTopicDetail.lessons.length})
                </h4>
                {selectedTopicDetail.lessons.length === 0 ? (
                  <p className="text-xs text-slate-400">No lessons built for this topic yet.</p>
                ) : (
                  selectedTopicDetail.lessons.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
                    >
                      <div>
                        <span className="font-bold text-xs text-slate-800">{l.title}</span>
                        <p className="text-[10px] text-slate-400">~{l.estimatedMinutes || 15} mins</p>
                      </div>
                      <Link
                        to={`/kids/lessons/${l.id}`}
                        className="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:bg-purple-700"
                      >
                        Play Lesson →
                      </Link>
                    </div>
                  ))
                )}
              </div>

              {/* Quizzes Available */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Quizzes ({selectedTopicDetail.assessments.length})
                </h4>
                {selectedTopicDetail.assessments.length === 0 ? (
                  <p className="text-xs text-slate-400">No quizzes built for this topic yet.</p>
                ) : (
                  selectedTopicDetail.assessments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
                    >
                      <div>
                        <span className="font-bold text-xs text-slate-800">{a.title}</span>
                        <p className="text-[10px] text-slate-400">
                          {a.questions?.length ?? 5} questions
                        </p>
                      </div>
                      <Link
                        to={`/kids/assessments/${a.id}`}
                        className="rounded-xl bg-pink-600 px-3 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:bg-pink-700"
                      >
                        Take Quiz →
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IMMERSIVE FOCUS READING MODAL                                             */}
      {/* ========================================================================= */}
      {readingTopic && (
        <FocusReadingModal
          topic={readingTopic}
          onClose={() => setReadingTopic(null)}
          onFinish={() => {
            queryClient.invalidateQueries({ queryKey: ['kids-overview'] });
            setReadingTopic(null);
          }}
        />
      )}
    </div>
  );
}

/* ======================================================================================= */
/* FOCUS READING MODAL WITH TTS (READ ALOUD) & ZOOM                                       */
/* ======================================================================================= */
function FocusReadingModal({
  topic,
  onClose,
  onFinish,
}: {
  topic: { id: number; title: string; content: string; subjectName?: string; subjectColor?: string };
  onClose: () => void;
  onFinish: () => void;
}) {
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'huge'>('large');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const toggleSpeech = () => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const textToRead = topic.content.replace(/<[^>]*>?/gm, '');
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.rate = 0.9;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-100 bg-white shadow-soft-2xl animate-in fade-in zoom-in-95 overflow-hidden">
        {/* Reader Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            {topic.subjectName && (
              <span
                className="rounded-lg px-2.5 py-0.5 text-[10px] font-bold text-white shadow-soft-xs"
                style={{ backgroundColor: topic.subjectColor || '#7928CA' }}
              >
                {topic.subjectName}
              </span>
            )}
            <h3 className="font-extrabold text-sm text-slate-800 truncate max-w-md">{topic.title}</h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Text to speech toggle */}
            {'speechSynthesis' in window && (
              <button
                onClick={toggleSpeech}
                className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  isSpeaking ? 'bg-purple-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title="Read Aloud Narration"
              >
                {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                <span>{isSpeaking ? 'Stop Audio' : 'Read Aloud'}</span>
              </button>
            )}

            {/* Font size zoom */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-bold">
              <button
                onClick={() => setFontSize('normal')}
                className={`px-2 py-1 rounded-lg ${fontSize === 'normal' ? 'bg-slate-200 text-slate-800' : 'text-slate-500'}`}
              >
                A
              </button>
              <button
                onClick={() => setFontSize('large')}
                className={`px-2 py-1 rounded-lg ${fontSize === 'large' ? 'bg-slate-200 text-slate-800' : 'text-slate-500'}`}
              >
                A+
              </button>
              <button
                onClick={() => setFontSize('huge')}
                className={`px-2 py-1 rounded-lg ${fontSize === 'huge' ? 'bg-slate-200 text-slate-800' : 'text-slate-500'}`}
              >
                A++
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Reader Body Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div
            className={`prose prose-slate max-w-none leading-relaxed font-normal ${
              fontSize === 'huge' ? 'text-xl' : fontSize === 'large' ? 'text-base' : 'text-sm'
            }`}
          >
            <RichContent content={topic.content} />
          </div>
        </div>

        {/* Reader Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          <span className="text-xs font-bold text-slate-500">🌟 Great reading makes you smarter!</span>
          <button
            onClick={onFinish}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-5 py-2 text-xs font-bold text-white shadow-soft-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Finish Reading (+10 XP)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
