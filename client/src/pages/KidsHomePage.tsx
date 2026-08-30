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
  GraduationCap,
  Menu,
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

type MainViewMode = 'book' | 'lessons' | 'quizzes' | 'study-guides' | 'today' | 'trophies';

export default function KidsHomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Top view mode: 'book' (Storybook & Chapter Hub), 'lessons', 'quizzes', 'study-guides', 'today', 'trophies'
  const [viewMode, setViewMode] = useState<MainViewMode>('book');

  // Book Reader Navigation State
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [tocSearch, setTocSearch] = useState('');
  const [expandedUnits, setExpandedUnits] = useState<Record<number, boolean>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCompanionOpen, setIsCompanionOpen] = useState(false);
  const [isMobileTocOpen, setIsMobileTocOpen] = useState(false);

  // Read-aloud speed
  const [speechRate, setSpeechRate] = useState<number>(1.0);

  // Interactive Inline Flashcard Deck State
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Search filter for course-wide views
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<number | null>(null);

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

  // Flattened lists of all lessons, assessments, and topics
  const allLessonsList = useMemo(() => {
    const list: {
      lesson: LessonSummary;
      topic: TopicItem;
      unit: UnitItem;
      subject: SubjectItem;
    }[] = [];
    subjects.forEach((subj) => {
      subj.units.forEach((unit) => {
        unit.topics.forEach((topic) => {
          topic.lessons?.forEach((lesson) => {
            list.push({ lesson, topic, unit, subject: subj });
          });
        });
      });
    });
    return list;
  }, [subjects]);

  const allAssessmentsList = useMemo(() => {
    const list: {
      assessment: AssessmentSummary;
      topic: TopicItem;
      unit: UnitItem;
      subject: SubjectItem;
    }[] = [];
    subjects.forEach((subj) => {
      subj.units.forEach((unit) => {
        unit.topics.forEach((topic) => {
          topic.assessments?.forEach((assessment) => {
            list.push({ assessment, topic, unit, subject: subj });
          });
        });
      });
    });
    return list;
  }, [subjects]);

  // Set default active topic when subjects load
  useEffect(() => {
    if (allBookChapters.length > 0 && selectedTopicId === null) {
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

  // Previous and Next chapter pointers for sequential reading
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
    setIsMobileTocOpen(false);
    if (viewMode !== 'book') {
      setViewMode('book');
    }
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
        <div className="w-full px-3 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-2 sm:gap-4">
            {/* Left: Child Identity & Mobile Chapter Toggle */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => setIsMobileTocOpen(true)}
                className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 shrink-0"
                title="Open Table of Contents"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-400 text-white font-black text-sm sm:text-base shadow-soft-xs ring-2 ring-purple-100 shrink-0">
                {child?.name ? child.name.charAt(0).toUpperCase() : '🌟'}
              </div>

              <div className="hidden md:block min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-black text-slate-900 tracking-tight truncate">
                    {child?.name ? `${child.name}'s Learning Hub` : "Explorer's Hub"}
                  </h1>
                  {child?.grade && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold text-purple-700 uppercase shrink-0">
                      Grade {child.grade}
                    </span>
                  )}
                </div>
              </div>

              {/* View Selector Tabs */}
              <div className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1 overflow-x-auto no-scrollbar max-w-[280px] sm:max-w-none">
                <button
                  onClick={() => setViewMode('book')}
                  className={`shrink-0 flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all ${
                    viewMode === 'book'
                      ? 'bg-white text-purple-700 shadow-soft-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Storybook</span>
                </button>

                <button
                  onClick={() => setViewMode('lessons')}
                  className={`shrink-0 flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all ${
                    viewMode === 'lessons'
                      ? 'bg-white text-purple-700 shadow-soft-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>Lessons</span>
                  {allLessonsList.length > 0 && (
                    <span className="rounded-full bg-purple-100 px-1.5 text-[9px] font-black text-purple-700">
                      {allLessonsList.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setViewMode('quizzes')}
                  className={`shrink-0 flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all ${
                    viewMode === 'quizzes'
                      ? 'bg-white text-purple-700 shadow-soft-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Quizzes</span>
                  {allAssessmentsList.length > 0 && (
                    <span className="rounded-full bg-pink-100 px-1.5 text-[9px] font-black text-pink-700">
                      {allAssessmentsList.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setViewMode('study-guides')}
                  className={`shrink-0 flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all ${
                    viewMode === 'study-guides'
                      ? 'bg-white text-purple-700 shadow-soft-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Book className="h-3.5 w-3.5" />
                  <span>Study Guides</span>
                </button>

                <button
                  onClick={() => setViewMode('today')}
                  className={`shrink-0 flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all ${
                    viewMode === 'today'
                      ? 'bg-white text-purple-700 shadow-soft-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Today's Quests</span>
                  {todaySessions.filter((s) => s.status !== 'done').length > 0 && (
                    <span className="rounded-full bg-purple-600 px-1.5 text-[9px] font-black text-white">
                      {todaySessions.filter((s) => s.status !== 'done').length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setViewMode('trophies')}
                  className={`shrink-0 flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all ${
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

            {/* Middle & Right: Live Gamification HUD & Parent Mode Exit */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Level & XP */}
              <div className="hidden xl:flex items-center gap-2 rounded-2xl border border-purple-100 bg-purple-50/70 px-3 py-1 shadow-soft-xs">
                <Trophy className="h-4 w-4 text-purple-600" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-extrabold text-purple-600">Level {gamification.level}</span>
                  <span className="text-xs font-black text-purple-900">{gamification.totalPoints} XP</span>
                </div>
              </div>

              {/* Streak */}
              <div className="hidden sm:flex items-center gap-1.5 rounded-2xl border border-amber-100 bg-amber-50/70 px-2.5 py-1 shadow-soft-xs">
                <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                <span className="text-xs font-black text-amber-900">{gamification.currentStreakDays}d</span>
              </div>

              {/* Flashcards Review Link */}
              <Link
                to="/kids/review"
                className="hidden sm:flex items-center gap-1.5 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-2.5 py-1 shadow-soft-xs hover:bg-emerald-100 transition-colors"
                title="Practice Due Flashcards"
              >
                <Brain className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-black text-emerald-900">{reviewQueueCount} Due</span>
              </Link>

              {viewMode === 'book' && (
                <>
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`hidden lg:flex rounded-xl border p-2 text-xs font-bold transition-all ${
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
                    title="Toggle AI Study Buddy"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                </>
              )}

              <button
                onClick={() => setExiting(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <Lock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Exit</span>
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
      {/* MOBILE TABLE OF CONTENTS DRAWER                                           */}
      {/* ========================================================================= */}
      {isMobileTocOpen && (
        <div className="fixed inset-0 z-50 flex bg-slate-900/60 backdrop-blur-sm lg:hidden animate-in fade-in">
          <div className="relative w-4/5 max-w-sm bg-white h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Book className="h-4 w-4 text-purple-600" />
                <h3 className="font-extrabold text-sm text-slate-900">Chapters & Concepts</h3>
              </div>
              <button
                onClick={() => setIsMobileTocOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search chapters..."
                  value={tocSearch}
                  onChange={(e) => setTocSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
              {subjects.map((subject) => {
                const subjectChapters = allBookChapters.filter((c) => c.subject.id === subject.id);
                if (subjectChapters.length === 0) return null;

                return (
                  <div key={subject.id} className="space-y-1">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: subject.color || '#7928CA' }}
                      />
                      <span className="text-xs font-black text-slate-800 truncate">{subject.name}</span>
                    </div>

                    <div className="pl-2 space-y-1">
                      {subject.units.map((unit) => (
                        <div key={unit.id} className="space-y-0.5">
                          <div className="px-2 py-1 text-[11px] font-bold text-slate-600 truncate">{unit.name}</div>
                          <div className="pl-2 space-y-0.5 border-l-2 border-slate-100 ml-2">
                            {unit.topics.map((topic) => {
                              const isSelected = selectedTopicId === topic.id;
                              return (
                                <button
                                  key={topic.id}
                                  onClick={() => handleSelectChapter(topic.id, unit.id)}
                                  className={`w-full flex items-start gap-2 px-2.5 py-2 text-left rounded-xl transition-all ${
                                    isSelected
                                      ? 'bg-purple-600 text-white font-bold shadow-soft-xs'
                                      : 'text-slate-600 hover:bg-purple-50 font-medium'
                                  }`}
                                >
                                  <BookOpen className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs truncate">{topic.title}</div>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[9px]">
                                      <span>{topic.estimatedMinutes}m</span>
                                      {topic.lessons.length > 0 && <span>• {topic.lessons.length} lessons</span>}
                                      {topic.assessments.length > 0 && <span>• Quiz</span>}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex-1" onClick={() => setIsMobileTocOpen(false)} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: INTERACTIVE STORYBOOK & CHAPTER CANVAS                            */}
      {/* ========================================================================= */}
      {viewMode === 'book' && (
        <div className="flex-1 flex overflow-hidden">
          {/* --------------------------------------------------------------------- */}
          {/* LEFT COLUMN: Table of Contents & Chapter Navigator                     */}
          {/* --------------------------------------------------------------------- */}
          {isSidebarOpen && (
            <aside className="hidden lg:flex w-80 shrink-0 border-r border-slate-200/80 bg-white flex-col h-[calc(100vh-4rem)] sticky top-16 z-20">
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
                                    const hasLessons = topic.lessons.length > 0;

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
                                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                            <span
                                              className={`text-[9px] ${
                                                isSelected ? 'text-purple-200' : 'text-slate-400'
                                              }`}
                                            >
                                              {topic.estimatedMinutes}m read
                                            </span>
                                            {hasLessons && (
                                              <span
                                                className={`rounded px-1 text-[8px] font-extrabold ${
                                                  isSelected
                                                    ? 'bg-white/20 text-white'
                                                    : 'bg-purple-100 text-purple-700'
                                                }`}
                                              >
                                                {topic.lessons.length} Lesson{topic.lessons.length > 1 ? 's' : ''}
                                              </span>
                                            )}
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
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 h-[calc(100vh-4rem)]">
            {currentChapter ? (
              <TextSizeProvider>
                <div className="max-w-4xl mx-auto space-y-6 pb-20">
                  {/* 1. Breadcrumb & Chapter Hierarchy */}
                  <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <span
                      className="font-bold uppercase tracking-wider"
                      style={{ color: currentChapter.subject.color || '#7928CA' }}
                    >
                      {currentChapter.subject.name}
                    </span>
                    <span>/</span>
                    <span className="text-slate-500 truncate max-w-[140px] sm:max-w-none">{currentChapter.unit.name}</span>
                    <span>/</span>
                    <span className="text-slate-800 font-bold">Chapter {currentChapter.chapterIndex}</span>
                  </nav>

                  {/* 2. Storybook Chapter Hero Title Card */}
                  <div className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-7 shadow-soft-sm relative overflow-hidden">
                    <div
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: currentChapter.subject.color || '#7928CA' }}
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-0.5 text-xs font-bold text-purple-800">
                            <Sparkles className="h-3.5 w-3.5 text-purple-600" /> Chapter {currentChapter.chapterIndex} of{' '}
                            {allBookChapters.length}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
                            <Clock className="h-3.5 w-3.5" /> ~{currentChapter.topic.estimatedMinutes} min read
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
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
                      <div className="flex flex-wrap items-center gap-2">
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

                    {/* Quick Section Anchors for Fast Jumping */}
                    <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-100 overflow-x-auto no-scrollbar">
                      <a
                        href="#chapter-story"
                        className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-purple-100 hover:text-purple-800 transition-colors"
                      >
                        <BookOpen className="h-3 w-3" />
                        <span>Story</span>
                      </a>
                      <a
                        href="#chapter-lessons"
                        className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors"
                      >
                        <GraduationCap className="h-3 w-3" />
                        <span>Lessons ({currentChapter.topic.lessons.length})</span>
                      </a>
                      <a
                        href="#chapter-quizzes"
                        className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-pink-50 px-2.5 py-1 text-xs font-bold text-pink-700 hover:bg-pink-100 transition-colors"
                      >
                        <FileText className="h-3 w-3" />
                        <span>Quizzes ({currentChapter.topic.assessments.length})</span>
                      </a>
                      <a
                        href="#chapter-study-guide"
                        className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                      >
                        <Book className="h-3 w-3" />
                        <span>Study Guide</span>
                      </a>
                      {currentChapter.topic.flashcards.length > 0 && (
                        <a
                          href="#chapter-flashcards"
                          className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          <Brain className="h-3 w-3" />
                          <span>Flashcards ({currentChapter.topic.flashcards.length})</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* 3. Main Story & Concept Reading Content (Illustrated & Formatted) */}
                  <article id="chapter-story" className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-8 shadow-soft-sm leading-relaxed">
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

                  {/* 4. CHAPTER LESSONS SECTION (Interactive Lessons) */}
                  <section id="chapter-lessons" className="rounded-3xl border border-purple-100 bg-white p-5 sm:p-7 shadow-soft-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-slate-900">Interactive Lessons</h3>
                          <p className="text-xs text-slate-400">Step-by-step interactive learning sessions</p>
                        </div>
                      </div>

                      <button
                        onClick={() => setViewMode('lessons')}
                        className="text-xs font-bold text-purple-600 hover:text-purple-700"
                      >
                        All Lessons →
                      </button>
                    </div>

                    {currentChapter.topic.lessons && currentChapter.topic.lessons.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentChapter.topic.lessons.map((lesson) => {
                          const isCompleted = lesson.progress?.some((p) => p.completedAt !== null);
                          const isInProgress = !isCompleted && lesson.progress?.some((p) => p.currentSectionIndex > 0);

                          return (
                            <div
                              key={lesson.id}
                              className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 flex flex-col justify-between gap-3 hover:border-purple-200 hover:bg-white transition-all shadow-soft-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                    <Clock className="h-3 w-3" /> {lesson.estimatedMinutes ?? 15} min
                                  </span>
                                  {isCompleted ? (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                                      Completed ⭐
                                    </span>
                                  ) : isInProgress ? (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                                      In Progress 🚀
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold text-purple-700">
                                      Ready 🎮
                                    </span>
                                  )}
                                </div>
                                <h4 className="font-bold text-sm text-slate-900 line-clamp-2">{lesson.title}</h4>
                              </div>

                              <Link
                                to={`/kids/lessons/${lesson.id}`}
                                className="flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-soft-xs hover:bg-purple-700 transition-all"
                              >
                                <Play className="h-3.5 w-3.5 fill-current" />
                                <span>{isCompleted ? 'Review Lesson' : isInProgress ? 'Continue Lesson' : 'Start Lesson'}</span>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-slate-500">
                        <GraduationCap className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-xs">Interactive lessons are being generated for this chapter.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Read through the storybook above or study the guide below!</p>
                      </div>
                    )}
                  </section>

                  {/* 5. CHAPTER QUIZZES & ASSESSMENTS SECTION */}
                  <section id="chapter-quizzes" className="rounded-3xl border border-pink-100 bg-white p-5 sm:p-7 shadow-soft-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-100 text-pink-700">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-slate-900">Chapter Quizzes & Challenges</h3>
                          <p className="text-xs text-slate-400">Test your mastery and earn XP badges</p>
                        </div>
                      </div>

                      <button
                        onClick={() => setViewMode('quizzes')}
                        className="text-xs font-bold text-pink-600 hover:text-pink-700"
                      >
                        All Quizzes →
                      </button>
                    </div>

                    {currentChapter.topic.assessments && currentChapter.topic.assessments.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentChapter.topic.assessments.map((assessment) => {
                          const bestAttempt = assessment.attempts?.reduce((max, curr) => {
                            if (curr.score === null) return max;
                            return (max === null || curr.score > max) ? curr.score : max;
                          }, null as number | null);

                          return (
                            <div
                              key={assessment.id}
                              className="rounded-2xl border border-slate-100 bg-gradient-to-r from-pink-50/50 to-purple-50/50 p-4 flex flex-col justify-between gap-3 shadow-soft-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-pink-700 bg-pink-100/80 px-2 py-0.5 rounded-full">
                                    {assessment.questions?.length ?? 5} Questions
                                  </span>
                                  {bestAttempt !== null && bestAttempt !== undefined && (
                                    <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                                      Best: {bestAttempt}% ⭐
                                    </span>
                                  )}
                                </div>
                                <h4 className="font-bold text-sm text-slate-900 line-clamp-2">{assessment.title}</h4>
                              </div>

                              <Link
                                to={`/kids/assessments/${assessment.id}`}
                                className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-4 py-2 text-xs font-bold text-white shadow-soft-xs hover:scale-[1.01] active:scale-[0.99] transition-all"
                              >
                                <Play className="h-3.5 w-3.5 fill-current" />
                                <span>{bestAttempt !== null && bestAttempt !== undefined ? 'Retake Quiz' : 'Take Quiz'}</span>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-slate-500">
                        <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-xs">Chapter quiz will be available soon.</p>
                      </div>
                    )}
                  </section>

                  {/* 6. COMPREHENSIVE STUDY GUIDE SECTION */}
                  <section id="chapter-study-guide" className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-white p-5 sm:p-7 shadow-soft-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shrink-0 shadow-soft-xs">
                        <Book className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-black text-base text-slate-900">
                          📘 {currentChapter.topic.title} Study Guide
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed max-w-lg">
                          Comprehensive concept breakdown with visual formulas, vocabulary definitions, step-by-step examples, and AI tutor support.
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/kids/topics/${currentChapter.topic.id}/study-guide`}
                      className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-soft-md hover:bg-indigo-700 transition-all shrink-0 w-full sm:w-auto justify-center"
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Open Complete Study Guide</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </section>

                  {/* 7. INLINE INTERACTIVE CHECKPOINT: Flashcard Practice */}
                  {currentChapter.topic.flashcards && currentChapter.topic.flashcards.length > 0 && (
                    <section id="chapter-flashcards" className="rounded-3xl border border-emerald-100 bg-white p-5 sm:p-7 shadow-soft-sm space-y-4">
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
                        <div className="flex items-center gap-3 mt-4">
                          <button
                            onClick={() => {
                              setIsCardFlipped(false);
                              setActiveCardIndex((prev) =>
                                prev > 0 ? prev - 1 : currentChapter.topic.flashcards.length - 1
                              );
                            }}
                            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-soft-xs"
                          >
                            <ChevronLeft className="h-4 w-4" /> Prev
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

                  {/* 8. BOTTOM CHAPTER NAVIGATION (Sequential Book Flow) */}
                  <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {prevChapter ? (
                      <button
                        onClick={() => handleSelectChapter(prevChapter.topic.id, prevChapter.unit.id)}
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
                        onClick={() => handleSelectChapter(nextChapter.topic.id, nextChapter.unit.id)}
                        className="flex items-center justify-end gap-2 rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 px-5 py-2.5 text-xs font-black text-white shadow-soft-md hover:scale-[1.01] active:scale-[0.99] transition-all ml-auto"
                      >
                        <div className="text-right">
                          <div className="text-[10px] text-purple-200 uppercase font-semibold">
                            Next Chapter
                          </div>
                          <div className="font-extrabold truncate max-w-[180px]">
                            {nextChapter.topic.title} →
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-800 text-center">
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
                    <p className="text-[10px] text-slate-400">Grounded on this chapter</p>
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
                {currentChapter && (
                  <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-3 text-xs">
                    <span className="font-extrabold text-purple-900">Current Chapter:</span>
                    <p className="font-medium text-slate-700 truncate">{currentChapter.topic.title}</p>
                  </div>
                )}

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
      {/* VIEW: ALL LESSONS HUB                                                     */}
      {/* ========================================================================= */}
      {viewMode === 'lessons' && (
        <main className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto space-y-6 flex-1">
          <div className="rounded-3xl border border-purple-100 bg-gradient-to-r from-purple-700 via-indigo-600 to-pink-600 p-6 sm:p-8 text-white shadow-soft-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold backdrop-blur-md">
                  <GraduationCap className="h-3.5 w-3.5" /> Interactive Lessons Hub
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">All Interactive Lessons</h2>
                <p className="text-xs sm:text-sm text-purple-100 font-medium">
                  Practice concepts step-by-step with interactive checkpoints and quizzes.
                </p>
              </div>

              <button
                onClick={() => setViewMode('book')}
                className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-purple-900 shadow-soft-md hover:scale-[1.01] transition-all"
              >
                <BookOpen className="h-4 w-4 text-purple-600" />
                <span>Return to Storybook</span>
              </button>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedSubjectFilter(null)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  selectedSubjectFilter === null
                    ? 'bg-purple-600 text-white shadow-soft-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                All Subjects ({allLessonsList.length})
              </button>
              {subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSubjectFilter(s.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    selectedSubjectFilter === s.id
                      ? 'bg-purple-600 text-white shadow-soft-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search lessons..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Lessons Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allLessonsList
              .filter(
                (item) =>
                  (selectedSubjectFilter === null || item.subject.id === selectedSubjectFilter) &&
                  (courseSearch === '' ||
                    item.lesson.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
                    item.topic.title.toLowerCase().includes(courseSearch.toLowerCase()))
              )
              .map(({ lesson, topic, subject }) => {
                const isCompleted = lesson.progress?.some((p) => p.completedAt !== null);

                return (
                  <div
                    key={lesson.id}
                    className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft-sm hover:shadow-soft-md transition-all flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className="rounded-lg px-2 py-0.5 text-[10px] font-bold text-white shadow-soft-xs"
                          style={{ backgroundColor: subject.color || '#7928CA' }}
                        >
                          {subject.name}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                          <Clock className="h-3 w-3" /> {lesson.estimatedMinutes ?? 15} min
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-slate-900 mb-1">{lesson.title}</h4>
                        <p className="text-[11px] text-slate-400 truncate">Chapter: {topic.title}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {isCompleted ? (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-400">Ready to play</span>
                      )}

                      <Link
                        to={`/kids/lessons/${lesson.id}`}
                        className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:bg-purple-700 transition-all"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        <span>{isCompleted ? 'Review' : 'Play'}</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* VIEW: ALL QUIZZES & ASSESSMENTS HUB                                       */}
      {/* ========================================================================= */}
      {viewMode === 'quizzes' && (
        <main className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto space-y-6 flex-1">
          <div className="rounded-3xl border border-pink-100 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 p-6 sm:p-8 text-white shadow-soft-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold backdrop-blur-md">
                  <FileText className="h-3.5 w-3.5" /> Chapter Quizzes & Mastery Checks
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">All Chapter Quizzes</h2>
                <p className="text-xs sm:text-sm text-pink-100 font-medium">
                  Test your comprehension on all chapters and collect Explorer Badges!
                </p>
              </div>

              <button
                onClick={() => setViewMode('book')}
                className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-purple-900 shadow-soft-md hover:scale-[1.01] transition-all"
              >
                <BookOpen className="h-4 w-4 text-purple-600" />
                <span>Return to Storybook</span>
              </button>
            </div>
          </div>

          {/* Quizzes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allAssessmentsList.map(({ assessment, topic, subject }) => {
              const bestAttempt = assessment.attempts?.reduce((max, curr) => {
                if (curr.score === null) return max;
                return (max === null || curr.score > max) ? curr.score : max;
              }, null as number | null);

              return (
                <div
                  key={assessment.id}
                  className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft-sm hover:shadow-soft-md transition-all flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className="rounded-lg px-2 py-0.5 text-[10px] font-bold text-white shadow-soft-xs"
                        style={{ backgroundColor: subject.color || '#7928CA' }}
                      >
                        {subject.name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {assessment.questions?.length ?? 5} Questions
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-slate-900 mb-1">{assessment.title}</h4>
                      <p className="text-[11px] text-slate-400 truncate">Chapter: {topic.title}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {bestAttempt !== null && bestAttempt !== undefined ? (
                      <span className="text-xs font-black text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        Best: {bestAttempt}% ⭐
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">Not taken yet</span>
                    )}

                    <Link
                      to={`/kids/assessments/${assessment.id}`}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:scale-[1.01] transition-all"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>{bestAttempt !== null ? 'Retake' : 'Start'}</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* VIEW: ALL STUDY GUIDES HUB                                                */}
      {/* ========================================================================= */}
      {viewMode === 'study-guides' && (
        <main className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto space-y-6 flex-1">
          <div className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-700 via-purple-600 to-pink-600 p-6 sm:p-8 text-white shadow-soft-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold backdrop-blur-md">
                  <Book className="h-3.5 w-3.5" /> Study Guides & Concept Outlines
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Chapter Study Guides</h2>
                <p className="text-xs sm:text-sm text-indigo-100 font-medium">
                  Review full chapter outlines, vocabulary flashcards, and step-by-step key ideas.
                </p>
              </div>

              <button
                onClick={() => setViewMode('book')}
                className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-purple-900 shadow-soft-md hover:scale-[1.01] transition-all"
              >
                <BookOpen className="h-4 w-4 text-purple-600" />
                <span>Return to Storybook</span>
              </button>
            </div>
          </div>

          {/* Study Guides Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allBookChapters.map(({ topic, unit, subject, chapterIndex }) => (
              <div
                key={topic.id}
                className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft-sm hover:shadow-soft-md transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className="rounded-lg px-2 py-0.5 text-[10px] font-bold text-white shadow-soft-xs"
                      style={{ backgroundColor: subject.color || '#7928CA' }}
                    >
                      {subject.name}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Chapter {chapterIndex}</span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">{topic.title}</h4>
                    <p className="text-[11px] text-slate-400 truncate">Unit: {unit.name}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleSelectChapter(topic.id, unit.id)}
                    className="text-xs font-bold text-slate-600 hover:text-purple-600"
                  >
                    Read Chapter
                  </button>

                  <Link
                    to={`/kids/topics/${topic.id}/study-guide`}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:bg-indigo-700 transition-all"
                  >
                    <BookOpen className="h-3 w-3" />
                    <span>Open Guide</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* VIEW: TODAY'S QUEST & MISSIONS CENTRAL                                    */}
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
      {/* VIEW: TROPHY ROOM & BADGES                                                */}
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
                <p className="font-bold text-xs">Keep reading chapters and completing quizzes to unlock your first trophy!</p>
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
