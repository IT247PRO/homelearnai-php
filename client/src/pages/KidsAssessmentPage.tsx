import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Volume2,
  VolumeX,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Star,
  Check,
  CheckCircle2,
  ListOrdered,
  Layers,
  BookOpen,
  Flame,
} from 'lucide-react';
import { api } from '../lib/api';
import { RichContent } from '../components/RichContent';
import { useReadAloud } from '../hooks/useReadAloud';

interface Question {
  id: number;
  type: string;
  prompt: string;
  choices: string[] | null;
  difficultyLevel: string;
}

interface AssessmentData {
  id: number;
  title: string;
  masteryThresholdPercent: number;
  questions: Question[];
}

interface ChildProfile {
  id: number;
  name: string;
  avatarUrl?: string;
}

interface GamificationState {
  totalPoints: number;
  level: number;
  currentStreakDays: number;
}

export default function KidsAssessmentPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const id = Number(assessmentId);
  const navigate = useNavigate();

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ score: number | null } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'step' | 'all'>('step');
  const [showExitDialog, setShowExitDialog] = useState(false);

  // Load Child Profile & Gamification for HUD
  const childQuery = useQuery({
    queryKey: ['kids-me'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ChildProfile }>('/kids/me');
      return data.data;
    },
  });

  const gamificationQuery = useQuery({
    queryKey: ['kids-gamification'],
    queryFn: async () => {
      const { data } = await api.get<{ data: { state: GamificationState } }>('/kids/gamification');
      return data.data.state;
    },
  });

  // Load Assessment Definition
  const assessmentQuery = useQuery({
    queryKey: ['kids-assessment', id],
    queryFn: async () => {
      const { data } = await api.get<{ data: AssessmentData }>(`/kids/assessments/${id}`);
      return data.data;
    },
  });

  // Start Attempt
  const start = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { id: number } }>(`/kids/assessments/${id}/attempts`, {});
      return data.data.id;
    },
    onSuccess: (newAttemptId) => {
      setAttemptId(newAttemptId);
    },
  });

  useEffect(() => {
    if (assessmentQuery.data && attemptId === null) {
      start.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentQuery.data]);

  // Finish Attempt
  const finish = useMutation({
    mutationFn: async () => {
      if (!attemptId || !assessmentQuery.data) throw new Error('No attempt in progress');
      for (const question of assessmentQuery.data.questions) {
        const response = responses[question.id];
        if (response === undefined) continue;
        await api.post(`/kids/assessment-attempts/${attemptId}/answers`, { questionId: question.id, response });
      }
      const { data } = await api.post<{ data: { score: number | null } }>(
        `/kids/assessment-attempts/${attemptId}/complete`
      );
      return data.data;
    },
    onSuccess: (data) => {
      setResult(data);
      stopSpeech();
    },
  });

  const questions = useMemo(() => assessmentQuery.data?.questions ?? [], [assessmentQuery.data?.questions]);
  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(responses).filter((k) => responses[Number(k)]?.trim()).length;
  const allAnswered = totalQuestions > 0 && answeredCount === totalQuestions;
  const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  // Text-To-Speech Speech Handler (shared hook — real pause/resume, cancels on unmount)
  const { status: speechStatus, speak, stop: stopSpeech } = useReadAloud({ rate: 0.95, pitch: 1.05 });
  const isSpeaking = speechStatus === 'speaking';
  const toggleSpeech = (text: string) => {
    if (isSpeaking) {
      stopSpeech();
      return;
    }
    speak(text);
  };

  // Retake assessment handler
  const handleRetake = () => {
    setResponses({});
    setResult(null);
    setCurrentIndex(0);
    setAttemptId(null);
    start.mutate();
  };

  const handleSelectChoice = (questionId: number, choice: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: choice }));
  };

  const handleTextChange = (questionId: number, val: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: val }));
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
      stopSpeech();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      stopSpeech();
    }
  };

  if (assessmentQuery.isLoading || !assessmentQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
          <p className="text-sm font-bold text-slate-600">Loading your knowledge quest…</p>
        </div>
      </div>
    );
  }

  // Result Screen View
  if (result) {
    return (
      <ResultScreen
        score={result.score}
        thresholdPercent={assessmentQuery.data.masteryThresholdPercent}
        title={assessmentQuery.data.title}
        questions={questions}
        responses={responses}
        onRetake={handleRetake}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-soft-xs">
        <div className="mx-auto max-w-4xl px-3 sm:px-4 py-3 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => {
                if (answeredCount > 0) {
                  setShowExitDialog(true);
                } else {
                  navigate('/kids');
                }
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Exit Quiz</span>
              <span className="sm:hidden">Exit</span>
            </button>

            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black text-slate-900 leading-tight flex items-center gap-1.5 truncate">
                <Sparkles className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-purple-600 shrink-0" />
                <span className="truncate max-w-[180px] sm:max-w-md">{assessmentQuery.data.title}</span>
              </h1>
              <p className="hidden sm:block text-[11px] font-semibold text-slate-500 truncate">
                {childQuery.data?.name ? `${childQuery.data.name} • ` : ''}
                {answeredCount} of {totalQuestions} answered ({Math.round(progressPercent)}%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* XP & Streak Gamification HUD */}
            <div className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-purple-50 px-2.5 sm:px-3 py-1 sm:py-1.5 border border-purple-200/60 shadow-soft-xs">
              <Star className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-amber-500 fill-amber-400" />
              <span className="text-[11px] sm:text-xs font-black text-purple-900">+15 XP</span>
            </div>

            {gamificationQuery.data?.currentStreakDays !== undefined && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 border border-orange-200/60">
                <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-400" />
                <span className="text-xs font-black text-orange-900">{gamificationQuery.data.currentStreakDays}d</span>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="hidden md:flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
              <button
                onClick={() => setViewMode('step')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'step' ? 'bg-white text-purple-700 shadow-soft-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Single question step-by-step"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Step</span>
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'all' ? 'bg-white text-purple-700 shadow-soft-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View all questions"
              >
                <ListOrdered className="h-3.5 w-3.5" />
                <span>All</span>
              </button>
            </div>
          </div>
        </div>

        {/* Segmented Progress Tracker */}
        <div className="mx-auto max-w-4xl px-4 pb-2">
          <div className="flex gap-1.5">
            {questions.map((q, idx) => {
              const isAnswered = Boolean(responses[q.id]?.trim());
              const isCurrent = idx === currentIndex && viewMode === 'step';
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setViewMode('step');
                  }}
                  className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                    isCurrent
                      ? 'bg-purple-600 ring-2 ring-purple-300 ring-offset-1'
                      : isAnswered
                        ? 'bg-emerald-500'
                        : 'bg-slate-200 hover:bg-slate-300'
                  }`}
                  title={`Question ${idx + 1}: ${isAnswered ? 'Answered' : 'Not answered'}`}
                />
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 flex flex-col justify-between">
        {viewMode === 'step' ? (
          /* STEP-BY-STEP SINGLE QUESTION MODE */
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-soft-md transition-all">
              {/* Question Header */}
              <div className="flex items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-xs font-black text-purple-700">
                    {currentIndex + 1}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Question {currentIndex + 1} of {totalQuestions}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Difficulty badge */}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      currentQuestion?.difficultyLevel === 'easy'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : currentQuestion?.difficultyLevel === 'hard'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}
                  >
                    {currentQuestion?.difficultyLevel ? currentQuestion.difficultyLevel.toUpperCase() : 'MEDIUM'}
                  </span>

                  {/* Audio Read-Aloud Button */}
                  <button
                    onClick={() => toggleSpeech(currentQuestion?.prompt ?? '')}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold transition-all ${
                      isSpeaking
                        ? 'border-purple-500 bg-purple-600 text-white animate-pulse'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                    title="Read Question Aloud"
                  >
                    {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
                  </button>
                </div>
              </div>

              {/* Question Prompt */}
              {currentQuestion && (
                <div className="mb-8">
                  <RichContent
                    content={currentQuestion.prompt}
                    className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed [&>p]:m-0"
                  />
                </div>
              )}

              {/* Interactive Answers Options */}
              {currentQuestion && (
                <div className="space-y-3">
                  {(currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'true_false') &&
                  currentQuestion.choices ? (
                    <div className="grid grid-cols-1 gap-3">
                      {currentQuestion.choices.map((choice, choiceIdx) => {
                        const letter = String.fromCharCode(65 + choiceIdx); // A, B, C, D
                        const isSelected = responses[currentQuestion.id] === choice;

                        return (
                          <button
                            key={choice}
                            onClick={() => handleSelectChoice(currentQuestion.id, choice)}
                            className={`group relative flex w-full items-center gap-3.5 rounded-2xl border-2 p-4 text-left font-semibold transition-all duration-200 ${
                              isSelected
                                ? 'border-purple-600 bg-purple-50/70 text-purple-950 shadow-soft-sm scale-[1.01]'
                                : 'border-slate-200 bg-white text-slate-800 hover:border-purple-300 hover:bg-slate-50/80 shadow-soft-xs'
                            }`}
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black transition-all ${
                                isSelected
                                  ? 'bg-purple-600 text-white shadow-soft-xs'
                                  : 'bg-slate-100 text-slate-600 group-hover:bg-purple-100 group-hover:text-purple-700'
                              }`}
                            >
                              {isSelected ? <Check className="h-4 w-4 stroke-[3]" /> : letter}
                            </span>
                            <span className="flex-1 text-base font-semibold">{choice}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Type your answer below:
                      </label>
                      <input
                        type="text"
                        value={responses[currentQuestion.id] ?? ''}
                        onChange={(e) => handleTextChange(currentQuestion.id, e.target.value)}
                        placeholder="Write your answer here…"
                        className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:outline-none focus:ring-4 focus:ring-purple-100 shadow-soft-xs transition-all"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step Navigation Controls */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none shadow-soft-xs transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>

              {/* Jump to Dot Index Bar */}
              <div className="hidden sm:flex items-center gap-2">
                {questions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      idx === currentIndex
                        ? 'bg-purple-600 text-white shadow-soft-xs'
                        : responses[q.id]?.trim()
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              {currentIndex < totalQuestions - 1 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 px-6 py-3 text-sm font-black text-white shadow-soft-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <span>Next Question</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => finish.mutate()}
                  disabled={!allAnswered || finish.isPending}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-tl from-emerald-600 to-teal-500 px-6 py-3 text-sm font-black text-white shadow-soft-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{finish.isPending ? 'Grading Answers…' : 'Submit Quiz 🌟'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ALL QUESTIONS LIST VIEW */
          <div className="space-y-6">
            <div className="space-y-6">
              {questions.map((q, qIndex) => {
                const isAnswered = Boolean(responses[q.id]?.trim());

                return (
                  <div
                    key={q.id}
                    className={`rounded-3xl border p-6 bg-white shadow-soft-sm transition-all ${
                      isAnswered ? 'border-purple-200' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                            isAnswered ? 'bg-emerald-500 text-white' : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {isAnswered ? <Check className="h-4 w-4" /> : qIndex + 1}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Question {qIndex + 1}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-400 capitalize">{q.difficultyLevel}</span>
                    </div>

                    <RichContent content={q.prompt} className="mb-4 text-base font-bold text-slate-900 [&>p]:m-0" />

                    {(q.type === 'multiple_choice' || q.type === 'true_false') && q.choices ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {q.choices.map((choice, choiceIdx) => {
                          const letter = String.fromCharCode(65 + choiceIdx);
                          const isSelected = responses[q.id] === choice;

                          return (
                            <button
                              key={choice}
                              onClick={() => handleSelectChoice(q.id, choice)}
                              className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left font-semibold transition-all ${
                                isSelected
                                  ? 'border-purple-600 bg-purple-50 text-purple-950 shadow-soft-xs'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-purple-200'
                              }`}
                            >
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                                  isSelected ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {letter}
                              </span>
                              <span className="text-sm">{choice}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={responses[q.id] ?? ''}
                        onChange={(e) => handleTextChange(q.id, e.target.value)}
                        placeholder="Write your answer here…"
                        className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 focus:border-purple-600 focus:outline-none shadow-soft-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-4 z-20 rounded-3xl border border-slate-200 bg-white/95 backdrop-blur p-4 shadow-soft-lg flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-700">
                  {answeredCount} of {totalQuestions} answered
                </p>
                <p className="text-[11px] text-slate-400">
                  {allAnswered ? 'All done! Ready to submit.' : 'Please answer all questions before submitting.'}
                </p>
              </div>

              <button
                onClick={() => finish.mutate()}
                disabled={!allAnswered || finish.isPending}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-tl from-emerald-600 to-teal-500 px-6 py-3 text-sm font-black text-white shadow-soft-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all"
              >
                <Sparkles className="h-4 w-4" />
                <span>{finish.isPending ? 'Grading Answers…' : 'Submit Quiz 🌟'}</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Exit Confirmation Dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-soft-xl border border-slate-100 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
              ⚠️
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-1">Leave this quiz?</h3>
            <p className="text-xs text-slate-600 mb-6">
              You have answered {answeredCount} question{answeredCount !== 1 ? 's' : ''}. If you leave now, your answers will not be saved.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitDialog(false)}
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Keep Going
              </button>
              <button
                onClick={() => navigate('/kids')}
                className="flex-1 rounded-2xl bg-red-600 py-3 text-xs font-bold text-white hover:bg-red-700 shadow-soft-xs"
              >
                Exit Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ResultScreenProps {
  score: number | null;
  thresholdPercent: number;
  title: string;
  questions: Question[];
  responses: Record<number, string>;
  onRetake: () => void;
}

function ResultScreen({ score, thresholdPercent, title, questions, responses, onRetake }: ResultScreenProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'review'>('overview');
  const percent = score !== null ? Math.round(score * 100) : null;
  const passed = score !== null && score >= thresholdPercent / 100;
  const isPerfect = percent === 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/50 via-slate-50 to-white px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Main Result Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-soft-lg relative overflow-hidden">
          {/* Confetti / Starburst background accents */}
          <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-purple-200/40 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-pink-200/40 blur-2xl pointer-events-none" />

          {/* Celebration Avatar Badge */}
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-purple-600 to-pink-500 text-4xl shadow-soft-md ring-8 ring-purple-100">
            {score === null ? '📝' : isPerfect ? '👑' : passed ? '🌟' : '💪'}
          </div>

          <div className="space-y-1 mb-6">
            <span className="inline-block rounded-full bg-purple-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-purple-700">
              Quiz Completed
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
          </div>

          {/* Score Display Circle */}
          {percent !== null ? (
            <div className="mb-6 rounded-3xl border border-slate-100 bg-slate-50/80 p-6 flex flex-col items-center justify-center">
              <div className="text-5xl font-black text-slate-900 tracking-tight flex items-baseline gap-1">
                <span className={passed ? 'text-purple-600' : 'text-slate-700'}>{percent}</span>
                <span className="text-2xl text-slate-400">%</span>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Mastery Goal: {thresholdPercent}% or higher
              </p>

              {/* XP Award Banner */}
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 border border-amber-200/80 shadow-soft-xs">
                <Star className="h-5 w-5 text-amber-500 fill-amber-400" />
                <span className="text-xs font-black text-amber-900">
                  {passed ? '+15 XP Mastery Reward Earned!' : '+5 XP Effort Reward Earned!'}
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-2xl bg-amber-50 p-4 border border-amber-200 text-amber-800 text-xs font-semibold">
              Some open-ended answers need parent review before a final score is calculated.
            </div>
          )}

          {/* Result Feedback Message */}
          <div className="mb-8">
            <h2 className="text-lg font-black text-slate-900 mb-1">
              {score === null
                ? 'Great Job Submitting!'
                : isPerfect
                  ? 'Flawless Victory! 🌟'
                  : passed
                    ? 'Topic Mastered! 🎉'
                    : 'Good Effort! Keep Growing! 🌱'}
            </h2>
            <p className="text-xs font-semibold text-slate-600 max-w-md mx-auto leading-relaxed">
              {score === null
                ? 'Your answers have been securely recorded. You can return to the Storybook to continue learning.'
                : isPerfect
                  ? 'You answered every question correctly on your first try. Outstanding mastery!'
                  : passed
                    ? `You passed above the ${thresholdPercent}% threshold and unlocked your next milestone!`
                    : `You scored ${percent}%. Review the topic concepts in your Storybook and try again to achieve full mastery.`}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to="/kids"
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 px-6 py-3.5 text-xs font-black text-white shadow-soft-md hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <BookOpen className="h-4 w-4" />
              <span>Back to Storybook</span>
            </Link>

            <button
              onClick={onRetake}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3.5 text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-[0.98] transition-all"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Try Again</span>
            </button>
          </div>
        </div>

        {/* Question Answers Review Section */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-soft-sm">
          <button
            onClick={() => setActiveTab((prev) => (prev === 'review' ? 'overview' : 'review'))}
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                Review Your Submitted Answers
              </span>
            </div>
            <span className="text-xs font-bold text-purple-600 hover:underline">
              {activeTab === 'review' ? 'Hide Answers ↑' : 'Show Answers ↓'}
            </span>
          </button>

          {activeTab === 'review' && (
            <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 animate-in fade-in">
              {questions.map((q, idx) => (
                <div key={q.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black text-purple-700 uppercase tracking-wider">
                      Question {idx + 1}
                    </span>
                  </div>
                  <RichContent content={q.prompt} className="text-xs font-bold text-slate-800 mb-2 [&>p]:m-0" />
                  <div className="rounded-xl bg-white border border-slate-200 p-2.5 text-xs font-semibold text-slate-700">
                    <span className="text-slate-400 font-normal">Your Answer: </span>
                    <span className="text-purple-950 font-bold">{responses[q.id] || '(No answer entered)'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

