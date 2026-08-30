import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Printer,
  Sparkles,
  X,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Calculator,
} from 'lucide-react';
import { api, apiErrorBody } from '../lib/api';
import { RichContent } from './RichContent';

export interface WorksheetProblem {
  problemNumber: number;
  question: string;
  type: 'calculation' | 'word_problem' | 'step_by_step' | 'fill_blank' | 'multiple_choice' | 'conceptual';
  workspaceSize: 'small' | 'medium' | 'large';
  choices?: string[];
  hint?: string;
  solution: string;
  answer: string;
}

export interface WorksheetData {
  title: string;
  subtitle?: string;
  gradeLevel?: string;
  subject?: string;
  instructions: string;
  estimatedMinutes?: number;
  problems: WorksheetProblem[];
  parentTeacherNotes?: string;
}

interface WorksheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId?: number;
  lessonId?: number;
  childId?: number;
  defaultTitle?: string;
  defaultChildName?: string;
}

export function WorksheetModal({
  isOpen,
  onClose,
  topicId,
  lessonId,
  childId,
  defaultTitle,
  defaultChildName,
}: WorksheetModalProps) {
  const [problemCount, setProblemCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<'foundation' | 'standard' | 'challenge'>('standard');
  const [practiceType, setPracticeType] = useState<'mixed' | 'step_by_step' | 'drill' | 'word_problems' | 'conceptual'>('mixed');
  const [includeAnswerKey, setIncludeAnswerKey] = useState<boolean>(true);
  const [childName, setChildName] = useState<string>(defaultChildName ?? '');
  const [customInstructions, setCustomInstructions] = useState<string>('');

  const [worksheet, setWorksheet] = useState<WorksheetData | null>(null);
  const [interactiveAnswers, setInteractiveAnswers] = useState<Record<number, string>>({});
  const [checkedAnswers, setCheckedAnswers] = useState<Record<number, boolean>>({});
  const [showHints, setShowHints] = useState<Record<number, boolean>>({});
  const [showAnswerKeyInView, setShowAnswerKeyInView] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'config' | 'preview' | 'interactive'>('config');
  const [error, setError] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      let endpoint = '/worksheets/generate';
      if (topicId) {
        endpoint = `/topics/${topicId}/worksheets/generate`;
      } else if (lessonId) {
        endpoint = `/lessons/${lessonId}/worksheets/generate`;
      }

      const { data } = await api.post<{ data: WorksheetData }>(endpoint, {
        problemCount,
        difficulty,
        practiceType,
        includeAnswerKey,
        childName: childName || undefined,
        customInstructions: customInstructions || undefined,
        topicId,
        lessonId,
        childId,
      });
      return data.data;
    },
    onSuccess: (data) => {
      setWorksheet(data);
      setViewMode('preview');
      setError(null);
      setInteractiveAnswers({});
      setCheckedAnswers({});
      setShowHints({});
    },
    onError: (err) => {
      setError(apiErrorBody(err)?.message ?? apiErrorBody(err)?.error ?? 'Failed to generate worksheet. Please retry.');
    },
  });

  if (!isOpen) return null;

  const handlePrint = () => {
    // Toggled class drives the @media print rule in index.css that hides everything outside
    // #worksheet-modal-container — the modal's own print:hidden/print:* Tailwind variants only
    // reach elements inside it, not the rest of the page sitting behind this overlay.
    document.body.classList.add('printing-worksheet');
    const cleanup = () => {
      document.body.classList.remove('printing-worksheet');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const handleCheckInteractive = (problemNumber: number, correctAnswer: string) => {
    const studentAns = (interactiveAnswers[problemNumber] ?? '').trim().toLowerCase();
    const cleanCorrect = correctAnswer.replace(/[$]/g, '').trim().toLowerCase();
    const isMatch = studentAns === cleanCorrect || studentAns.includes(cleanCorrect) || cleanCorrect.includes(studentAns);
    setCheckedAnswers((prev) => ({ ...prev, [problemNumber]: isMatch }));
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 sm:p-6 backdrop-blur-sm print:static print:p-0 print:bg-white">
      {/* Modal Container */}
      <div
        id="worksheet-modal-container"
        className="relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-3xl border border-slate-200 bg-white shadow-soft-2xl overflow-hidden print:border-none print:shadow-none print:max-h-none print:max-w-none"
      >
        {/* Header - Screen only */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-purple-50 via-white to-sky-50 px-4 sm:px-6 py-3.5 sm:py-4 print:hidden">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-sm">
              <Calculator className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-800 flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span>Printable Practice Worksheet Studio</span>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-purple-700">
                  LaTeX Math Preserved
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {defaultTitle ? `Topic: ${defaultTitle}` : 'Custom Problem Generator'} • Math equations &amp; step-by-step solutions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap shrink-0">
            {worksheet && (
              <>
                <div className="flex rounded-xl bg-slate-100 p-0.5 sm:p-1 text-[11px] sm:text-xs font-bold text-slate-600">
                  <button
                    onClick={() => setViewMode('preview')}
                    className={`rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 transition-all ${
                      viewMode === 'preview' ? 'bg-white text-purple-700 shadow-soft-xs' : 'hover:text-slate-900'
                    }`}
                  >
                    Print Preview
                  </button>
                  <button
                    onClick={() => setViewMode('interactive')}
                    className={`rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 transition-all ${
                      viewMode === 'interactive' ? 'bg-white text-purple-700 shadow-soft-xs' : 'hover:text-slate-900'
                    }`}
                  >
                    Solve Online
                  </button>
                  <button
                    onClick={() => setViewMode('config')}
                    className={`rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 transition-all ${
                      viewMode === 'config' ? 'bg-white text-purple-700 shadow-soft-xs' : 'hover:text-slate-900'
                    }`}
                  >
                    Customize
                  </button>
                </div>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-white shadow-soft-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                  title="Print worksheet or save to PDF"
                >
                  <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Print / Save PDF</span>
                  <span className="sm:hidden">Print</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-slate-50 p-1.5 sm:p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:p-0 print:overflow-visible">
          {/* Configuration View */}
          {viewMode === 'config' && (
            <div className="max-w-2xl mx-auto space-y-6 py-2">
              <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-5">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-sm mb-1">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span>Custom Practice Specifications</span>
                </div>
                <p className="text-xs text-purple-700/80">
                  Configure how many problems to generate, practice difficulty, and worksheet layout.
                </p>
              </div>

              {/* 1. Problem Count Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  How many practice problems should it create?
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {[5, 10, 15, 20, 25].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setProblemCount(count)}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        problemCount === count
                          ? 'bg-purple-600 text-white shadow-soft-sm scale-105'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-purple-300 hover:bg-purple-50/30'
                      }`}
                    >
                      {count} Problems
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-xs text-slate-400 font-medium">Custom:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={problemCount}
                      onChange={(e) => setProblemCount(Math.min(50, Math.max(1, Number(e.target.value))))}
                      className="w-16 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Practice Type */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Practice Focus &amp; Problem Style
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(
                    [
                      { id: 'step_by_step', label: 'Step-by-Step Guided Workspace', desc: 'Broken down with guided prompts and structured space' },
                      { id: 'drill', label: 'Calculation & Fluency Drill', desc: 'High repetition computational practice for speed and accuracy' },
                      { id: 'word_problems', label: 'Real-World Word Problems', desc: 'Applied story problems reinforcing situational math' },
                      { id: 'conceptual', label: 'Conceptual & Visual Reasoning', desc: 'Fractions equivalence, models, and mathematical logic' },
                    ] as const
                  ).map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setPracticeType(style.id)}
                      className={`text-left p-3 rounded-2xl border transition-all ${
                        practiceType === style.id
                          ? 'border-purple-500 bg-purple-50/60 shadow-soft-xs ring-1 ring-purple-500'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-800">{style.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{style.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Difficulty */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Difficulty Level
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'foundation', label: 'Foundation Steps', desc: 'Gentle progression' },
                      { id: 'standard', label: 'Grade Standard', desc: 'Core mastery' },
                      { id: 'challenge', label: 'Challenge & Multi-Step', desc: 'Deeper extension' },
                    ] as const
                  ).map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setDifficulty(lvl.id)}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        difficulty === lvl.id
                          ? 'border-purple-600 bg-purple-600 text-white font-bold shadow-soft-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{lvl.label}</div>
                      <div className={`text-[10px] mt-0.5 ${difficulty === lvl.id ? 'text-purple-100' : 'text-slate-400'}`}>
                        {lvl.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Child Name & Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Student Name Header</label>
                  <input
                    type="text"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="e.g. Ethan / Maya"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeAnswerKey}
                      onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span>Include Step-by-Step Answer Key</span>
                  </label>
                </div>
              </div>

              {/* 5. Custom Focus Prompt */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Specific Learning Objectives / Topics to Emphasize (optional)
                </label>
                <textarea
                  rows={2}
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g. Include 3 questions simplifying fractions to lowest terms, and 2 visual word problems with recipes."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-6 py-2.5 text-xs font-bold text-white shadow-soft-sm hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{generateMutation.isPending ? 'Generating Worksheet…' : `Generate ${problemCount} Problem Worksheet`}</span>
                </button>
              </div>
            </div>
          )}

          {/* Worksheet Preview & Interactive Solving */}
          {worksheet && viewMode !== 'config' && (
            <div className="space-y-6">
              {/* PRINTABLE WORKSHEET CONTAINER */}
              <div className="print:m-0 print:p-0">
                {/* Print Sheet Visual Page */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-soft-sm print:border-none print:p-0 print:shadow-none font-sans">
                  {/* Worksheet Header Box */}
                  <div className="border-b-2 border-slate-900 pb-4 mb-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-purple-700 print:text-black">
                          {worksheet.subject ?? 'MATHEMATICS'} • {worksheet.gradeLevel ?? 'GRADE 4'}
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                          {worksheet.title}
                        </h1>
                        {worksheet.subtitle && (
                          <p className="text-xs font-semibold text-slate-600 mt-0.5 print:text-black">
                            {worksheet.subtitle}
                          </p>
                        )}
                      </div>

                      {/* Student Info Lines */}
                      <div className="space-y-1.5 text-xs font-bold text-slate-800 min-w-[220px]">
                        <div className="flex items-center justify-between border-b border-slate-300 pb-0.5">
                          <span className="text-slate-500 print:text-black">Name:</span>
                          <span className="font-semibold">{childName || '____________________'}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-300 pb-0.5">
                          <span className="text-slate-500 print:text-black">Date:</span>
                          <span>____________________</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-300 pb-0.5">
                          <span className="text-slate-500 print:text-black">Score:</span>
                          <span>______ / {worksheet.problems.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* Instructions Banner */}
                    <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 print:bg-transparent print:border-slate-400">
                      <span className="font-bold text-slate-900">Instructions: </span>
                      {worksheet.instructions}
                    </div>
                  </div>

                  {/* Problems Grid / List */}
                  <div className="space-y-6">
                    {worksheet.problems.map((prob) => {
                      const isCorrect = checkedAnswers[prob.problemNumber];
                      const hasChecked = isCorrect !== undefined;
                      const hintVisible = showHints[prob.problemNumber];

                      return (
                        <div
                          key={prob.problemNumber}
                          className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 print:border-slate-300 print:p-3 print:break-inside-avoid"
                        >
                          {/* Problem Header & Question */}
                          <div className="flex items-start gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white print:bg-black print:text-white">
                              {prob.problemNumber}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-900 print:text-black">
                                <RichContent content={prob.question} />
                              </div>

                              {/* Multiple Choice Options (if present) */}
                              {prob.choices && prob.choices.length > 0 && (
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {prob.choices.map((choice, cIdx) => (
                                    <div
                                      key={cIdx}
                                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-800 print:bg-transparent"
                                    >
                                      <span className="font-bold text-slate-500">
                                        {String.fromCharCode(65 + cIdx)}.
                                      </span>
                                      <RichContent content={choice} className="inline-block" />
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Printable Workspace Box */}
                              <div
                                className={`mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/40 p-2.5 print:bg-transparent print:border-slate-400 ${
                                  prob.workspaceSize === 'large'
                                    ? 'min-h-[140px]'
                                    : prob.workspaceSize === 'small'
                                      ? 'min-h-[60px]'
                                      : 'min-h-[90px]'
                                }`}
                              >
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-500">
                                  Show your work / Workspace:
                                </span>
                              </div>

                              {/* Final Answer Line */}
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 print:border-slate-300">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-800 print:text-black">Answer:</span>
                                  {viewMode === 'interactive' ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={interactiveAnswers[prob.problemNumber] ?? ''}
                                        onChange={(e) =>
                                          setInteractiveAnswers((prev) => ({
                                            ...prev,
                                            [prob.problemNumber]: e.target.value,
                                          }))
                                        }
                                        placeholder="Type answer…"
                                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleCheckInteractive(prob.problemNumber, prob.answer)}
                                        className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-700"
                                      >
                                        Check
                                      </button>
                                      {hasChecked && (
                                        <span
                                          className={`flex items-center gap-1 text-xs font-bold ${
                                            isCorrect ? 'text-emerald-600' : 'text-amber-600'
                                          }`}
                                        >
                                          {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                          {isCorrect ? 'Correct!' : 'Check again'}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400 font-semibold print:text-black">
                                      _______________________________
                                    </span>
                                  )}
                                </div>

                                {/* Hints (Interactive or Screen Mode) */}
                                {prob.hint && viewMode !== 'preview' && (
                                  <div className="print:hidden">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setShowHints((prev) => ({
                                          ...prev,
                                          [prob.problemNumber]: !prev[prob.problemNumber],
                                        }))
                                      }
                                      className="flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700"
                                    >
                                      <HelpCircle className="h-3 w-3" />
                                      <span>{hintVisible ? 'Hide Hint' : 'Need a hint?'}</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Hint Content if open */}
                              {hintVisible && prob.hint && (
                                <div className="mt-2 rounded-lg bg-purple-50/70 p-2 text-xs text-purple-900 border border-purple-100 print:hidden">
                                  <span className="font-bold">💡 Hint: </span>
                                  <RichContent content={prob.hint} className="inline-block" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ANSWER KEY SECTION (Page-break on print) */}
                  {includeAnswerKey && (
                    <div className="mt-12 pt-6 border-t-2 border-dashed border-slate-300 print:break-before-page">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700 print:text-black">
                            TEACHER &amp; PARENT REFERENCE
                          </div>
                          <h2 className="text-lg font-black text-slate-900">
                            Answer Key &amp; Step-by-Step Solutions
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAnswerKeyInView(!showAnswerKeyInView)}
                          className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 print:hidden"
                        >
                          {showAnswerKeyInView ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          <span>{showAnswerKeyInView ? 'Hide in Preview' : 'Show in Preview'}</span>
                        </button>
                      </div>

                      {/* Answer Key Grid / Solutions */}
                      <div className={`space-y-4 ${showAnswerKeyInView ? 'block' : 'hidden print:block'}`}>
                        {/* Quick Answer Summary Table */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 print:bg-transparent">
                          <p className="text-xs font-bold text-slate-700 mb-2">Quick Grading Guide:</p>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                            {worksheet.problems.map((prob) => (
                              <div
                                key={prob.problemNumber}
                                className="rounded-lg border border-slate-200 bg-white p-2 text-center"
                              >
                                <span className="font-bold text-slate-500">#{prob.problemNumber}: </span>
                                <div className="font-bold text-slate-900">
                                  <RichContent content={prob.answer} className="inline-block" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Step-by-Step Worked Solutions */}
                        <div className="space-y-3 pt-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Detailed Worked Solutions:
                          </p>
                          {worksheet.problems.map((prob) => (
                            <div
                              key={prob.problemNumber}
                              className="rounded-xl border border-emerald-100 bg-emerald-50/20 p-3.5 text-xs text-slate-800 print:border-slate-300 print:bg-transparent"
                            >
                              <div className="flex items-center gap-2 font-bold text-slate-900 mb-1">
                                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-600 text-[11px] text-white">
                                  {prob.problemNumber}
                                </span>
                                <span className="text-emerald-800">Final Answer:</span>
                                <RichContent content={prob.answer} className="inline-block font-black" />
                              </div>
                              <div className="mt-1.5 border-t border-emerald-100/60 pt-1.5 text-slate-700">
                                <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Solution Steps:</p>
                                <RichContent content={prob.solution} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Toolbar - Screen only */}
        {worksheet && viewMode !== 'config' && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3.5 print:hidden">
            <button
              onClick={() => setViewMode('config')}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Change Problem Count / Settings</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-5 py-2 text-xs font-bold text-white shadow-soft-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Printer className="h-4 w-4" />
                <span>Print Worksheet Now</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
