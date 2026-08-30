import { useState, useMemo, useEffect } from 'react';
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
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  FileText,
  Star,
  Clock,
  ArrowRight,
  Check,
  Lock,
  X,
  Trophy,
  Book,
  RotateCcw,
  MessageCircle,
  Lightbulb,
  ListTree,
} from 'lucide-react';
import { api, apiErrorBody } from '../lib/api';
import { RichContent } from '../components/RichContent';
import { TutorChat } from '../components/TutorChat';
import { ReadAloudControls } from '../components/ReadAloudControls';
import { TextSizeControls } from '../components/TextSizeControls';
import { TextSizeProvider } from '../contexts/TextSizeContext';

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
  flashcards: { id: number; front?: string; back?: string }[];
  fileAssets?: { id: number; kind: string; label: string | null; originalName: string; url: string | null }[];
  masteries?: { state: string; accuracy: number | null }[];
  studyGuide?: { versions: { id: number }[] } | null;
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

type MainViewMode = 'book' | 'today' | 'trophies';

export default function KidsHomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Top view mode: 'book' (Interactive Storybook & Knowledge Doc), 'today' (Daily Mission Central), 'trophies' (Achievements)
  const [viewMode, setViewMode] = useState<MainViewMode>('book');

  // Book Reader Navigation State
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [tocSearch, setTocSearch] = useState('');
  const [expandedUnits, setExpandedUnits] = useState<Record<number, boolean>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCompanionOpen, setIsCompanionOpen] = useState(true);

  // Read-aloud speed (shared control below hands the actual speech control to useReadAloud)
  const [speechRate, setSpeechRate] = useState<number>(1.0);

  // Interactive Inline Flashcard Deck State
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Exit PIN Flow
  const [exiting, setExiting] = useState(false);
  const [pin, setPin] = useState('');
  const [exitError, setExitError] = useState<string | null>(null);

  // Fetch unified overview
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
  const gamification = overview?.gamification ?? {
    totalPoints: 0,
    level: 1,
    currentStreakDays: 0,
    longestStreakDays: 0,
    gamificationEnabled: true,
  };
  const subjects = useMemo(() => overview?.subjects ?? [], [overview?.subjects]);
  const todaySessions = useMemo(() => overview?.todaySessions ?? [], [overview?.todaySessions]);
  const reviewQueueCount = overview?.reviewQueueCount ?? 0;
  const achievements = overview?.achievements ?? [];

  // Linear list of all chapters (topics) across all subjects and units for sequential book flow
  const allBookChapters = useMemo(() => {
    const chapters: {
      topic: TopicItem;
      unit: UnitItem;
      subject: SubjectItem;
      chapterIndex: number;
    }[] = [];

    let idx = 1;
    subjects.forEach((subj) => {
      subj.units.forEach((unit) => {
        unit.topics.forEach((topic) => {
          chapters.push({
            topic,
            unit,
            subject: subj,
            chapterIndex: idx++,
          });
        });
      });
    });
    return chapters;
  }, [subjects]);

  // Set default active topic when subjects load
  useEffect(() => {
    if (allBookChapters.length > 0 && selectedTopicId === null) {
      // Prioritize today's first incomplete scheduled session topic if present
      const scheduledTopicId = todaySessions.find((s) => s.status !== 'done')?.topic.id;
      if (scheduledTopicId) {
        setSelectedTopicId(scheduledTopicId);
        const match = allBookChapters.find((c) => c.topic.id === scheduledTopicId);
        if (match) {
          setExpandedUnits((prev) => ({ ...prev, [match.unit.id]: true }));
        }
      } else {
        setSelectedTopicId(allBookChapters[0].topic.id);
        setExpandedUnits((prev) => ({ ...prev, [allBookChapters[0].unit.id]: true }));
      }
    }
  }, [allBookChapters, selectedTopicId, todaySessions]);

  // Active current topic, unit, and subject in the book reader
  const currentChapter = useMemo(() => {
    return allBookChapters.find((c) => c.topic.id === selectedTopicId) || allBookChapters[0] || null;
  }, [allBookChapters, selectedTopicId]);

  // Previous and Next chapter pointers for seamless, flowing reading
  const { prevChapter, nextChapter } = useMemo(() => {
    if (!currentChapter) return { prevChapter: null, nextChapter: null };
    const currentIndex = allBookChapters.findIndex((c) => c.topic.id === currentChapter.topic.id);
    return {
      prevChapter: currentIndex > 0 ? allBookChapters[currentIndex - 1] : null,
      nextChapter: currentIndex < allBookChapters.length - 1 ? allBookChapters[currentIndex + 1] : null,
    };
  }, [allBookChapters, currentChapter]);

  // Reset flashcard state when topic changes
  useEffect(() => {
    setActiveCardIndex(0);
    setIsCardFlipped(false);
    // Read Aloud narration is stopped on topic change via ReadAloudControls being remounted
    // (keyed on the topic id below), which triggers useReadAloud's unmount cleanup.
  }, [selectedTopicId]);

  const toggleUnitAccordion = (unitId: number) => {
    setExpandedUnits((prev) => ({
      ...prev,
      [unitId]: !prev[unitId],
    }));
  };

  const handleSelectChapter = (topicId: number, unitId: number) => {
    setSelectedTopicId(topicId);
    setExpandedUnits((prev) => ({ ...prev, [unitId]: true }));
    // Auto scroll reader to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    <div className="min-h-screen bg-slate-50/60 font-sans antialiased text-slate-800 flex flex-col">
      {/* ========================================================================= */}
      {/* TOP UNIFIED KIDS APP BAR & GAMIFICATION HUD                               */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-soft-xs">
        <div className="w-full px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Left: Child Identity & Mode Switcher */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-400 text-white font-black text-base shadow-soft-xs ring-2 ring-purple-100">
                {child?.name ? child.name.charAt(0).toUpperCase() : '🌟'}
              </div>

              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-black text-slate-900 tracking-tight">
                    {child?.name ? `${child.name}'s Learning Book` : "Explorer's Hub"}
                  </h1>
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold text-purple-700 uppercase">
                    {child?.grade || 'Grade Student'}
                  </span>
                </div>
              </div>

              {/* View Selector Tabs */}
              <div className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1 ml-2">
                <button
                  onClick={() => setViewMode('book')}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    viewMode === 'book'
                      ? 'bg-white text-purple-700 shadow-soft-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Storybook</span>
                </button>

                <button
                  onClick={() => setViewMode('today')}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    viewMode === 'today'
                      ? 'bg-white text-purple-700 shadow-soft-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Today's Quests</span>
                  {todaySessions.filter((s) => s.status !== 'done').length > 0 && (
                    <span className="rounded-full bg-purple-600 px-1.5 py-0.2 text-[9px] font-black text-white">
                      {todaySessions.filter((s) => s.status !== 'done').length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setViewMode('trophies')}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    viewMode === 'trophies'
                      ? 'bg-white text-purple-700 shadow-soft-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Trophy className="h-3.5 w-3.5" />
                  <span>Trophies</span>
                </button>
              </div>
            </div>

            {/* Middle: Live Gamification HUD */}
            <div className="hidden lg:flex items-center gap-3">
              {/* Level & XP */}
              <div className="flex items-center gap-2 rounded-2xl border border-purple-100 bg-purple-50/70 px-3 py-1 shadow-soft-xs">
                <Trophy className="h-4 w-4 text-purple-600" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-extrabold text-purple-600">Level {gamification.level}</span>
                  <span className="text-xs font-black text-purple-900">{gamification.totalPoints} XP</span>
                </div>
              </div>

              {/* Streak */}
              <div className="flex items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-1 shadow-soft-xs">
                <Flame className="h-4 w-4 text-amber-500 fill-amber-400" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-extrabold text-amber-600">Streak</span>
                  <span className="text-xs font-black text-amber-900">{gamification.currentStreakDays} Days</span>
                </div>
              </div>

              {/* Flashcards Link */}
              <Link
                to="/kids/review"
                className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-1 shadow-soft-xs hover:bg-emerald-100 transition-colors"
                title="Practice Flashcards"
              >
                <Brain className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-black text-emerald-900">{reviewQueueCount} Due</span>
              </Link>
            </div>

            {/* Right: Layout Toggles & Parent Mode Exit */}
            <div className="flex items-center gap-2">
              {viewMode === 'book' && (
                <>
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`rounded-xl border p-2 text-xs font-bold transition-all ${
                      isSidebarOpen
                        ? 'border-purple-200 bg-purple-50 text-purple-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    title="Toggle Chapter Outline"
                  >
                    <ListTree className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => setIsCompanionOpen(!isCompanionOpen)}
                    className={`rounded-xl border p-2 text-xs font-bold transition-all ${
                      isCompanionOpen
                        ? 'border-purple-200 bg-purple-50 text-purple-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    title="Toggle AI Study Buddy & Notes"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                </>
              )}

              <button
                onClick={() => setExiting(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <Lock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Parent Exit</span>
              </button>
            </div>
          </div>
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
      {/* VIEW 1: INTERACTIVE STORYBOOK & KNOWLEDGE CANVAS (Microsoft Learn Model)   */}
      {/* ========================================================================= */}
      {viewMode === 'book' && (
        <div className="flex-1 flex overflow-hidden">
          {/* --------------------------------------------------------------------- */}
          {/* LEFT COLUMN: Table of Contents & Chapter Navigator                     */}
          {/* --------------------------------------------------------------------- */}
          {isSidebarOpen && (
            <aside className="w-80 shrink-0 border-r border-slate-200/80 bg-white flex flex-col h-[calc(100vh-4rem)] sticky top-16 z-20">
              {/* Header & Search */}
              <div className="p-4 border-b border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Book className="h-4 w-4 text-purple-600" />
                    <span className="font-extrabold text-xs uppercase tracking-wider text-slate-500">
                      Table of Contents
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                    {allBookChapters.length} Chapters
                  </span>
                </div>

                {/* Search in TOC */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search chapters & concepts..."
                    value={tocSearch}
                    onChange={(e) => setTocSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>

              {/* Subjects & Units List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
                {subjects.map((subject) => {
                  const subjectChapters = allBookChapters.filter((c) => c.subject.id === subject.id);
                  if (subjectChapters.length === 0) return null;

                  return (
                    <div key={subject.id} className="space-y-1">
                      {/* Subject Pill */}
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: subject.color || '#7928CA' }}
                        />
                        <span className="text-xs font-black text-slate-800 truncate">{subject.name}</span>
                        <span className="ml-auto text-[10px] font-bold text-slate-400">
                          {subjectChapters.length}
                        </span>
                      </div>

                      {/* Units under Subject */}
                      <div className="pl-2 space-y-1">
                        {subject.units.map((unit) => {
                          const isExpanded = expandedUnits[unit.id] ?? true;
                          const filteredTopics = unit.topics.filter(
                            (t) =>
                              tocSearch === '' ||
                              t.title.toLowerCase().includes(tocSearch.toLowerCase()) ||
                              unit.name.toLowerCase().includes(tocSearch.toLowerCase())
                          );

                          if (filteredTopics.length === 0) return null;

                          return (
                            <div key={unit.id} className="space-y-0.5">
                              {/* Unit Accordion Header */}
                              <button
                                onClick={() => toggleUnitAccordion(unit.id)}
                                className="w-full flex items-center justify-between px-2 py-1 text-left rounded-lg hover:bg-slate-100/70 transition-colors group"
                              >
                                <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-900 truncate">
                                  {unit.name}
                                </span>
                                <ChevronDown
                                  className={`h-3 w-3 text-slate-400 transition-transform ${
                                    isExpanded ? '' : '-rotate-90'
                                  }`}
                                />
                              </button>

                              {/* Topics / Chapters list */}
                              {isExpanded && (
                                <div className="pl-2 space-y-0.5 border-l-2 border-slate-100 ml-2">
                                  {filteredTopics.map((topic) => {
                                    const isSelected = selectedTopicId === topic.id;
                                    const hasReading = Boolean(
                                      topic.learningContent && topic.learningContent.length > 0
                                    );
                                    const hasQuiz = topic.assessments.length > 0;

                                    return (
                                      <button
                                        key={topic.id}
                                        onClick={() => handleSelectChapter(topic.id, unit.id)}
                                        className={`w-full flex items-start gap-2 px-2.5 py-2 text-left rounded-xl transition-all ${
                                          isSelected
                                            ? 'bg-purple-600 text-white font-bold shadow-soft-xs'
                                            : 'text-slate-600 hover:bg-purple-50 hover:text-purple-700 font-medium'
                                        }`}
                                      >
                                        <div className="mt-0.5">
                                          {hasReading ? (
                                            <FileText className="h-3.5 w-3.5 shrink-0" />
                                          ) : (
                                            <BookOpen className="h-3.5 w-3.5 shrink-0" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs truncate">{topic.title}</div>
                                          <div className="flex items-center gap-1.5 mt-0.5">
                                            <span
                                              className={`text-[9px] ${
                                                isSelected ? 'text-purple-200' : 'text-slate-400'
                                              }`}
                                            >
                                              {topic.estimatedMinutes}m read
                                            </span>
                                            {hasQuiz && (
                                              <span
                                                className={`rounded px-1 text-[8px] font-extrabold ${
                                                  isSelected
                                                    ? 'bg-white/20 text-white'
                                                    : 'bg-pink-100 text-pink-700'
                                                }`}
                                              >
                                                Quiz
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>
          )}

          {/* --------------------------------------------------------------------- */}
          {/* CENTER CANVAS: Flowing Interactive Reading & Concept Canvas             */}
          {/* --------------------------------------------------------------------- */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10 h-[calc(100vh-4rem)]">
            {currentChapter ? (
              <TextSizeProvider>
              <div className="max-w-4xl mx-auto space-y-8 pb-20">
                {/* 1. Breadcrumb & Chapter Hierarchy */}
                <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <span
                    className="font-bold uppercase tracking-wider"
                    style={{ color: currentChapter.subject.color || '#7928CA' }}
                  >
                    {currentChapter.subject.name}
                  </span>
                  <span>/</span>
                  <span className="text-slate-500">{currentChapter.unit.name}</span>
                  <span>/</span>
                  <span className="text-slate-800 font-bold">Chapter {currentChapter.chapterIndex}</span>
                </nav>

                {/* 2. Storybook Chapter Hero Title Card */}
                <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-soft-sm relative overflow-hidden">
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: currentChapter.subject.color || '#7928CA' }}
                  />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-0.5 text-xs font-bold text-purple-800">
                          <Sparkles className="h-3.5 w-3.5 text-purple-600" /> Chapter {currentChapter.chapterIndex} of{' '}
                          {allBookChapters.length}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
                          <Clock className="h-3.5 w-3.5" /> ~{currentChapter.topic.estimatedMinutes} min read
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {currentChapter.topic.title}
                      </h2>
                    </div>

                    {/* Quick XP Reward & Audio Bar */}
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <div className="flex items-center gap-1.5 rounded-2xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-black text-amber-800">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                        <span>+25 XP Upon Completion</span>
                      </div>
                    </div>
                  </div>

                  {/* Audio Read-Aloud Narration Toolbar */}
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <ReadAloudControls
                        key={currentChapter.topic.id}
                        text={`${currentChapter.topic.title}. ${currentChapter.topic.learningContent ?? ''}`}
                        rate={speechRate}
                      />

                      {/* Speed selector */}
                      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-0.5">
                        {[0.8, 1.0, 1.2].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => setSpeechRate(rate)}
                            className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-all ${
                              speechRate === rate
                                ? 'bg-white text-purple-700 shadow-soft-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <TextSizeControls />
                  </div>
                </div>

                {/* 3. Main Story & Concept Reading Content (Illustrated & Formatted) */}
                <article className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-10 shadow-soft-sm leading-relaxed">
                  {currentChapter.topic.learningContent ? (
                    <div className="prose prose-purple max-w-none text-slate-800 space-y-6">
                      <RichContent content={currentChapter.topic.learningContent} scalable />
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400 space-y-2">
                      <BookOpen className="h-10 w-10 mx-auto text-slate-300" />
                      <p className="text-sm font-semibold">Reading story is being crafted for this topic.</p>
                    </div>
                  )}

                  {/* Big Idea / Key Takeaway Callout Box */}
                  <div className="mt-8 rounded-2xl border border-purple-100 bg-purple-50/60 p-5 flex items-start gap-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white shrink-0 shadow-soft-xs">
                      <Lightbulb className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-purple-950">💡 Big Idea in this Concept</h4>
                      <p className="text-xs text-purple-800 mt-1 leading-relaxed">
                        Understanding <strong>{currentChapter.topic.title}</strong> helps you unlock deeper mastery
                        in {currentChapter.subject.name}. Ask your AI Study Buddy if you want a fun story or riddle!
                      </p>
                    </div>
                  </div>
                </article>

                {Boolean(currentChapter.topic.studyGuide?.versions.length) && (
                  <Link
                    to={`/kids/topics/${currentChapter.topic.id}/study-guide`}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-all"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>📘 Open Study Guide</span>
                  </Link>
                )}

                {/* 4. INLINE INTERACTIVE CHECKPOINT: Flashcard Practice (No Modals!) */}
                {currentChapter.topic.flashcards && currentChapter.topic.flashcards.length > 0 && (
                  <section className="rounded-3xl border border-emerald-100 bg-white p-6 sm:p-8 shadow-soft-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                          <Brain className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-slate-900">
                            Interactive Concept Check: Flip Flashcards
                          </h3>
                          <p className="text-xs text-slate-400">
                            Card {activeCardIndex + 1} of {currentChapter.topic.flashcards.length}
                          </p>
                        </div>
                      </div>

                      <Link
                        to="/kids/review"
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline"
                      >
                        Full Deck Mode →
                      </Link>
                    </div>

                    {/* The Flip Card Stage */}
                    <div className="flex flex-col items-center justify-center py-4">
                      <div
                        onClick={() => setIsCardFlipped(!isCardFlipped)}
                        className={`w-full max-w-md min-h-[160px] rounded-2xl border p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-soft-sm ${
                          isCardFlipped
                            ? 'border-purple-300 bg-gradient-to-tr from-purple-50 to-pink-50'
                            : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                          {isCardFlipped ? 'Answer / Concept' : 'Question (Click to flip)'}
                        </span>
                        <p className="font-bold text-base text-slate-800">
                          {isCardFlipped
                            ? currentChapter.topic.flashcards[activeCardIndex]?.back || 'Concept explanation'
                            : currentChapter.topic.flashcards[activeCardIndex]?.front || 'Question prompt'}
                        </p>
                      </div>

                      {/* Card Carousel Controls */}
                      <div className="flex items-center gap-4 mt-4">
                        <button
                          onClick={() => {
                            setIsCardFlipped(false);
                            setActiveCardIndex((prev) =>
                              prev > 0 ? prev - 1 : currentChapter.topic.flashcards.length - 1
                            );
                          }}
                          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-soft-xs"
                        >
                          <ChevronLeft className="h-4 w-4" /> Previous
                        </button>

                        <button
                          onClick={() => setIsCardFlipped(!isCardFlipped)}
                          className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:bg-purple-700"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Flip Card
                        </button>

                        <button
                          onClick={() => {
                            setIsCardFlipped(false);
                            setActiveCardIndex((prev) =>
                              prev < currentChapter.topic.flashcards.length - 1 ? prev + 1 : 0
                            );
                          }}
                          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-soft-xs"
                        >
                          Next <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {/* 5. INLINE KNOWLEDGE CHECK: Topic Quiz or Lesson Action */}
                {currentChapter.topic.assessments && currentChapter.topic.assessments.length > 0 && (
                  <section className="rounded-3xl border border-pink-100 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-indigo-500/10 p-6 sm:p-8 shadow-soft-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-600 text-white font-black text-xs">
                          📝
                        </span>
                        <h3 className="font-extrabold text-base text-slate-900">
                          {currentChapter.topic.assessments[0].title}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500">
                        Ready to test what you just read? Score 80%+ to earn the Explorer Star badge!
                      </p>
                    </div>

                    <Link
                      to={`/kids/assessments/${currentChapter.topic.assessments[0].id}`}
                      className="flex items-center gap-2 rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 px-5 py-2.5 text-xs font-black text-white shadow-soft-md hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>Take Chapter Quiz</span>
                    </Link>
                  </section>
                )}

                {/* 6. BOTTOM CHAPTER NAVIGATION (Sequential Book Flow) */}
                <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {prevChapter ? (
                    <button
                      onClick={() =>
                        handleSelectChapter(
                          prevChapter.topic.id,
                          prevChapter.unit.id
                        )
                      }
                      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-soft-xs transition-all"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <div className="text-left">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Previous Chapter</div>
                        <div className="font-bold text-slate-900 truncate max-w-[160px]">
                          {prevChapter.topic.title}
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div />
                  )}

                  {nextChapter ? (
                    <button
                      onClick={() =>
                        handleSelectChapter(
                          nextChapter.topic.id,
                          nextChapter.unit.id
                        )
                      }
                      className="flex items-center gap-2 rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 px-6 py-3 text-xs font-black text-white shadow-soft-md hover:scale-[1.02] active:scale-[0.98] transition-all ml-auto"
                    >
                      <div className="text-right">
                        <div className="text-[10px] text-purple-200 uppercase font-semibold">
                          Complete & Next Chapter
                        </div>
                        <div className="font-extrabold truncate max-w-[200px]">
                          {nextChapter.topic.title} →
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-800">
                      🎉 You reached the end of the curriculum!
                    </div>
                  )}
                </div>
              </div>
              </TextSizeProvider>
            ) : (
              <div className="py-20 text-center text-slate-400">
                <BookOpen className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                <h3 className="font-bold text-base text-slate-700">No chapters found</h3>
              </div>
            )}
          </main>

          {/* --------------------------------------------------------------------- */}
          {/* RIGHT COLUMN: Docked AI Study Buddy & Topic Notes                      */}
          {/* --------------------------------------------------------------------- */}
          {isCompanionOpen && (
            <aside className="w-88 shrink-0 border-l border-slate-200/80 bg-white flex flex-col h-[calc(100vh-4rem)] sticky top-16 z-20">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800">AI Study Buddy</h4>
                    <p className="text-[10px] text-slate-400">Grounded on this topic</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsCompanionOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                  title="Close Companion"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Chat Canvas inside Sidebar */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {/* Topic context pill */}
                {currentChapter && (
                  <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-3 text-xs">
                    <span className="font-extrabold text-purple-900">Current Chapter:</span>
                    <p className="font-medium text-slate-700 truncate">{currentChapter.topic.title}</p>
                  </div>
                )}

                {/* Tutor Chat Engine */}
                {child && (
                  <TutorChat
                    messagesUrl="/kids/tutor/messages"
                    kidsStyle
                    lessonId={currentChapter?.topic.lessons[0]?.id}
                  />
                )}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: TODAY'S QUEST & MISSIONS CENTRAL                                  */}
      {/* ========================================================================= */}
      {viewMode === 'today' && (
        <main className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto space-y-8 flex-1">
          {/* Hero Banner */}
          <div className="rounded-3xl border border-purple-100 bg-gradient-to-r from-purple-700 via-indigo-600 to-pink-600 p-6 sm:p-8 text-white shadow-soft-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-2 max-w-xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold backdrop-blur-md">
                  <Sparkles className="h-3.5 w-3.5" /> Daily Mission HQ
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Today's Learning Quests</h2>
                <p className="text-xs sm:text-sm text-purple-100 leading-relaxed font-medium">
                  Complete your scheduled activities to keep your {gamification.currentStreakDays}-day streak burning
                  and level up your XP! 🔥
                </p>
              </div>

              <button
                onClick={() => setViewMode('book')}
                className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-black text-purple-900 shadow-soft-md hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <BookOpen className="h-4 w-4 text-purple-600" />
                <span>Open Storybook Reader</span>
              </button>
            </div>
          </div>

          {/* Today's Missions List */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-lg text-slate-800">Scheduled Activities</h3>

            {todaySessions.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-soft-xs">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mx-auto mb-3">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h4 className="font-bold text-base text-slate-800">All Done for Today!</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  You have completed all scheduled tasks. Open the Storybook to explore any chapter you like!
                </p>
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
                      className={`rounded-3xl border p-5 transition-all ${
                        isDone
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : 'border-slate-100 bg-white shadow-soft-sm hover:shadow-soft-md'
                      }`}
                    >
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

                      <h4 className="font-bold text-sm text-slate-900 mb-1">{session.topic.title}</h4>
                      {session.topic.unit && (
                        <p className="text-[11px] font-medium text-slate-400 mb-4">Unit: {session.topic.unit.name}</p>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        {isDone ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" /> Completed (+10 XP)
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 w-full">
                            <button
                              onClick={() => {
                                setSelectedTopicId(session.topic.id);
                                setViewMode('book');
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 py-2 text-xs font-bold text-white shadow-soft-xs hover:bg-purple-700"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              <span>Read Chapter</span>
                            </button>

                            <button
                              onClick={() => completeSession.mutate(session.id)}
                              disabled={completeSession.isPending}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100"
                              title="Mark Done"
                            >
                              <Check className="h-4 w-4" />
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
        </main>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: TROPHY ROOM & BADGES                                              */}
      {/* ========================================================================= */}
      {viewMode === 'trophies' && (
        <main className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto space-y-8 flex-1">
          <div>
            <h3 className="font-black text-2xl text-slate-900">Hall of Achievements 🏆</h3>
            <p className="text-xs text-slate-500 mt-1">
              Every completed chapter, quiz, and study streak unlocks new badges!
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {achievements.length === 0 ? (
              <div className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">
                <Trophy className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-xs">Keep reading chapters to unlock your first trophy!</p>
              </div>
            ) : (
              achievements.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-purple-100 bg-white p-5 shadow-soft-sm hover:shadow-soft-md transition-all text-center space-y-3"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-100 to-amber-200 text-amber-600 mx-auto shadow-soft-xs">
                    <Award className="h-7 w-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{item.achievement.title}</h4>
                    <p className="text-xs text-slate-500 mt-1">{item.achievement.description}</p>
                  </div>
                  <span className="inline-block rounded-full bg-amber-50 border border-amber-200 px-3 py-0.5 text-[10px] font-black text-amber-800">
                    +{item.achievement.points} XP
                  </span>
                </div>
              ))
            )}
          </div>
        </main>
      )}
    </div>
  );
}
