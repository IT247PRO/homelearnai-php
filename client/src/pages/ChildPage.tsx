import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Sparkles,
  Brain,
  Layers,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  FileText,
  FileCode,
  Link as LinkIcon,
  Upload,
  Eye,
  ChevronRight,
  ChevronDown,
  Search,
  Printer,
  Compass,
  GraduationCap,
  Maximize2,
  Minimize2,
  Columns,
  LayoutGrid,
} from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { ChildNavHeader } from '../components/ChildNavHeader';
import { RichContent } from '../components/RichContent';
import { LessonsAndAssessmentsSection } from '../components/LessonsAndAssessments';
import { StudyGuideSection } from '../components/StudyGuideSection';
import { MasterySection } from '../components/MasterySection';
import { LearningProfileSection } from '../components/LearningProfileSection';
import { InsightsSection } from '../components/InsightsSection';
import { TutorChat } from '../components/TutorChat';
import { WorksheetModal } from '../components/WorksheetModal';
import { api } from '../lib/api';

interface Subject {
  id: number;
  name: string;
  color: string;
}

interface Unit {
  id: number;
  name: string;
  sortOrder?: number;
}

interface Topic {
  id: number;
  title: string;
  estimatedMinutes: number;
  sortOrder?: number;
}

interface Flashcard {
  id: number;
  cardType: string;
  question: string;
  answer: string;
  choices: string[] | null;
  correctChoices: string[] | null;
  clozeText: string | null;
  clozeAnswers: string[] | null;
  questionImageUrl: string | null;
}

interface FileAssetItem {
  id: number;
  kind: string;
  originalName: string;
  url: string | null;
  label: string | null;
}

interface CatchUp {
  id: number;
  priority: number;
  status: string;
  missedDate: string;
  reason: string | null;
  topic: { title: string };
}

interface ReviewSlot {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotType: string;
  isActive: boolean;
}

const SUBJECT_COLORS = ['#7928CA', '#2152ff', '#17c1e8', '#82d616', '#ea0606', '#fbcf33', '#cb0c9f', '#6c757d'];
const DAY_NAMES_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ChildPage() {
  const { childId } = useParams<{ childId: string }>();
  const id = Number(childId);

  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [topicSearch, setTopicSearch] = useState('');

  // Layout mode: 'standard' (3 cols) | 'expanded' (Left + Wide Middle) | 'focus' (Full Width Studio)
  const [layoutMode, setLayoutMode] = useState<'standard' | 'expanded' | 'focus'>('standard');

  // Middle tab selection: 'materials' | 'lessons' | 'flashcards' | 'study-guide'
  const [middleTab, setMiddleTab] = useState<'materials' | 'lessons' | 'flashcards' | 'study-guide'>('materials');

  // Right sidebar tab: 'tutor' | 'profile_insights' | 'mastery_ops'
  const [rightTab, setRightTab] = useState<'tutor' | 'profile_insights' | 'mastery_ops'>('tutor');

  // Fetch subjects for this child
  const subjectsQuery = useQuery({
    queryKey: ['children', id, 'subjects'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Subject[] }>(`/children/${id}/subjects`);
      return data.data;
    },
  });

  // Auto-select first subject if none selected
  useEffect(() => {
    if (!selectedSubjectId && subjectsQuery.data && subjectsQuery.data.length > 0) {
      setSelectedSubjectId(subjectsQuery.data[0].id);
    }
  }, [subjectsQuery.data, selectedSubjectId]);

  const activeSubject = subjectsQuery.data?.find((s) => s.id === selectedSubjectId);

  return (
    <AppLayout>
      <ChildNavHeader childId={id} activeTab="curriculum" />

      {/* Quick Layout Mode Switcher Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-2.5 shadow-soft-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Workspace Layout:</span>
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setLayoutMode('standard')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                layoutMode === 'standard'
                  ? 'bg-white text-purple-700 shadow-soft-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="3-Column Balanced Layout"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>3-Column Studio</span>
            </button>
            <button
              onClick={() => setLayoutMode('expanded')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                layoutMode === 'expanded'
                  ? 'bg-white text-purple-700 shadow-soft-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Expanded Reading & Lessons Studio"
            >
              <Columns className="h-3.5 w-3.5" />
              <span>Expanded Studio</span>
            </button>
            <button
              onClick={() => setLayoutMode('focus')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                layoutMode === 'focus'
                  ? 'bg-white text-purple-700 shadow-soft-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Full-Width Focus Reader"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Full Screen Focus</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {layoutMode === 'focus' && (
            <button
              onClick={() => setLayoutMode('standard')}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span>Show Sidebars</span>
            </button>
          )}
        </div>
      </div>

      {/* 3-Column Interactive Learning Studio */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Course & Curriculum Hierarchy (Subjects, Units, Topics)       */}
        {/* ========================================================================= */}
        {layoutMode !== 'focus' && (
          <div
            className={`space-y-4 ${
              layoutMode === 'expanded' ? 'lg:col-span-4 xl:col-span-3' : 'lg:col-span-4 xl:col-span-3'
            }`}
          >
            <LeftCurriculumNavigator
              childId={id}
              subjects={subjectsQuery.data ?? []}
              activeSubjectId={selectedSubjectId}
              onSelectSubject={(subjectId) => {
                setSelectedSubjectId(subjectId);
                setSelectedUnitId(null);
                setSelectedTopicId(null);
              }}
              selectedUnitId={selectedUnitId}
              onSelectUnit={setSelectedUnitId}
              selectedTopicId={selectedTopicId}
              onSelectTopic={(topicId, unitId) => {
                setSelectedTopicId(topicId);
                if (unitId) setSelectedUnitId(unitId);
              }}
              searchQuery={topicSearch}
              onSearchChange={setTopicSearch}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* MIDDLE COLUMN: Active Topic Learning Studio (Materials, Lessons, Cards)   */}
        {/* ========================================================================= */}
        <div
          className={`space-y-4 ${
            layoutMode === 'focus'
              ? 'col-span-12'
              : layoutMode === 'expanded'
              ? 'lg:col-span-8 xl:col-span-9'
              : 'lg:col-span-8 xl:col-span-5'
          }`}
        >
          <MiddleTopicStudio
            childId={id}
            selectedTopicId={selectedTopicId}
            activeSubject={activeSubject}
            activeTab={middleTab}
            onChangeTab={setMiddleTab}
            onSelectTopic={setSelectedTopicId}
            layoutMode={layoutMode}
            onToggleExpand={() =>
              setLayoutMode(layoutMode === 'expanded' ? 'standard' : 'expanded')
            }
            onToggleFocus={() =>
              setLayoutMode(layoutMode === 'focus' ? 'standard' : 'focus')
            }
          />
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: AI Co-Pilot, Tutor, Insights & Mastery Operations           */}
        {/* ========================================================================= */}
        {layoutMode === 'standard' && (
          <div className="space-y-4 lg:col-span-12 xl:col-span-4">
            <RightAICompanionHub
              childId={id}
              selectedTopicId={selectedTopicId}
              activeTab={rightTab}
              onChangeTab={setRightTab}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

/* ======================================================================================= */
/* LEFT COLUMN: Curriculum Navigator Component                                             */
/* ======================================================================================= */
interface LeftCurriculumNavigatorProps {
  childId: number;
  subjects: Subject[];
  activeSubjectId: number | null;
  onSelectSubject: (id: number) => void;
  selectedUnitId: number | null;
  onSelectUnit: (id: number | null) => void;
  selectedTopicId: number | null;
  onSelectTopic: (topicId: number, unitId?: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

function LeftCurriculumNavigator({
  childId,
  subjects,
  activeSubjectId,
  onSelectSubject,
  selectedUnitId,
  onSelectUnit,
  selectedTopicId,
  onSelectTopic,
  searchQuery,
  onSearchChange,
}: LeftCurriculumNavigatorProps) {
  const queryClient = useQueryClient();
  const [newSubjectName, setNewSubjectName] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);
  const [newSubjectColor, setNewSubjectColor] = useState(SUBJECT_COLORS[0]);

  const createSubject = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: Subject }>(`/children/${childId}/subjects`, {
        name: newSubjectName,
        color: newSubjectColor,
      });
      return data.data;
    },
    onSuccess: (data) => {
      setNewSubjectName('');
      setAddingSubject(false);
      queryClient.invalidateQueries({ queryKey: ['children', childId, 'subjects'] });
      onSelectSubject(data.id);
    },
  });

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-xl">
      {/* Header with Search and New Subject */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-xs">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Curriculum</h2>
            <p className="text-[10px] text-slate-400">Courses & Topics</p>
          </div>
        </div>
        <button
          onClick={() => setAddingSubject(!addingSubject)}
          className="flex h-7 items-center gap-1 rounded-lg bg-slate-50 px-2 text-[11px] font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
          title="Add New Subject"
        >
          <Plus className="h-3 w-3" />
          <span>Subject</span>
        </button>
      </div>

      {/* Subject Creation Form */}
      {addingSubject && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createSubject.mutate();
          }}
          className="mb-4 space-y-2.5 rounded-xl border border-purple-100 bg-purple-50/50 p-3"
        >
          <input
            required
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            placeholder="Subject name (e.g. Science)"
            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {SUBJECT_COLORS.slice(0, 5).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewSubjectColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-5 w-5 rounded-full ${newSubjectColor === c ? 'ring-2 ring-purple-600 ring-offset-1' : ''}`}
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setAddingSubject(false)}
                className="rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-200/60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createSubject.isPending}
                className="rounded-lg bg-purple-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-purple-700"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Subject Filter Pills */}
      <div className="mb-3 flex flex-wrap gap-1.5 pb-2 border-b border-slate-100">
        {subjects.map((sub) => {
          const isActive = sub.id === activeSubjectId;
          return (
            <button
              key={sub.id}
              onClick={() => onSelectSubject(sub.id)}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                isActive
                  ? 'bg-slate-800 text-white shadow-soft-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: sub.color || '#7928CA' }}
              />
              <span>{sub.name}</span>
            </button>
          );
        })}
        {subjects.length === 0 && (
          <p className="text-xs text-slate-400 py-1">No subjects created yet.</p>
        )}
      </div>

      {/* Quick Search */}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter units or topics…"
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        />
      </div>

      {/* Units & Topics List for Active Subject */}
      {activeSubjectId && (
        <UnitsNavigator
          subjectId={activeSubjectId}
          childId={childId}
          selectedUnitId={selectedUnitId}
          onSelectUnit={onSelectUnit}
          selectedTopicId={selectedTopicId}
          onSelectTopic={onSelectTopic}
          searchQuery={searchQuery}
        />
      )}
    </div>
  );
}

/* ======================================================================================= */
/* UNITS & TOPICS TREE NAVIGATOR                                                           */
/* ======================================================================================= */
interface UnitsNavigatorProps {
  subjectId: number;
  childId: number;
  selectedUnitId: number | null;
  onSelectUnit: (id: number | null) => void;
  selectedTopicId: number | null;
  onSelectTopic: (topicId: number, unitId?: number) => void;
  searchQuery: string;
}

function UnitsNavigator({
  subjectId,
  selectedUnitId,
  onSelectUnit,
  selectedTopicId,
  onSelectTopic,
  searchQuery,
}: UnitsNavigatorProps) {
  const queryClient = useQueryClient();
  const [newUnitName, setNewUnitName] = useState('');
  const [addingUnit, setAddingUnit] = useState(false);

  const unitsQuery = useQuery({
    queryKey: ['subjects', subjectId, 'units'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Unit[] }>(`/subjects/${subjectId}/units`);
      return data.data;
    },
  });

  const invalidateUnits = () => queryClient.invalidateQueries({ queryKey: ['subjects', subjectId, 'units'] });

  const createUnit = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: Unit }>(`/subjects/${subjectId}/units`, { name: newUnitName });
      return data.data;
    },
    onSuccess: (unit) => {
      setNewUnitName('');
      setAddingUnit(false);
      invalidateUnits();
      onSelectUnit(unit.id);
    },
  });

  const deleteUnit = useMutation({
    mutationFn: async (unitId: number) => {
      await api.delete(`/units/${unitId}`);
    },
    onSuccess: invalidateUnits,
  });

  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);

  // Auto-select first topic of first unit if none selected
  useEffect(() => {
    if (!selectedUnitId && units.length > 0) {
      onSelectUnit(units[0].id);
    }
  }, [units, selectedUnitId, onSelectUnit]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
        <span>Units & Chapters</span>
        <button
          onClick={() => setAddingUnit(!addingUnit)}
          className="text-purple-600 hover:text-purple-700 flex items-center gap-0.5 lowercase font-semibold"
        >
          <Plus className="h-3 w-3" /> unit
        </button>
      </div>

      {addingUnit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createUnit.mutate();
          }}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2"
        >
          <input
            required
            value={newUnitName}
            onChange={(e) => setNewUnitName(e.target.value)}
            placeholder="Unit title…"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={createUnit.isPending}
            className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-bold text-white hover:bg-slate-900"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAddingUnit(false)}
            className="text-slate-400 hover:text-slate-600 px-1 text-xs"
          >
            &times;
          </button>
        </form>
      )}

      {units.length === 0 && !addingUnit && (
        <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
          <Layers className="mx-auto h-5 w-5 text-slate-300 mb-1" />
          <p className="text-xs text-slate-500 font-semibold">No units in this course yet</p>
          <button
            onClick={() => setAddingUnit(true)}
            className="mt-2 text-xs font-bold text-purple-600 hover:underline"
          >
            + Create First Unit
          </button>
        </div>
      )}

      {units.map((unit) => {
        const isExpanded = selectedUnitId === unit.id;

        return (
          <div
            key={unit.id}
            className={`overflow-hidden rounded-xl border transition-all ${
              isExpanded ? 'border-purple-200 bg-purple-50/20' : 'border-slate-100 bg-white hover:border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <button
                onClick={() => onSelectUnit(isExpanded ? null : unit.id)}
                className="flex flex-1 items-center gap-2 text-left font-bold text-xs text-slate-800"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                )}
                <span className="line-clamp-1">{unit.name}</span>
              </button>

              <div className="flex items-center gap-1 opacity-60 hover:opacity-100">
                <button
                  onClick={() => {
                    if (confirm(`Delete unit "${unit.name}"?`)) deleteUnit.mutate(unit.id);
                  }}
                  className="rounded p-1 text-slate-400 hover:text-red-600"
                  title="Delete unit"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-purple-100/60 bg-white px-2 py-2">
                <UnitTopicsList
                  unitId={unit.id}
                  selectedTopicId={selectedTopicId}
                  onSelectTopic={onSelectTopic}
                  searchQuery={searchQuery}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ======================================================================================= */
/* TOPICS LIST INSIDE A UNIT                                                               */
/* ======================================================================================= */
interface UnitTopicsListProps {
  unitId: number;
  selectedTopicId: number | null;
  onSelectTopic: (topicId: number, unitId?: number) => void;
  searchQuery: string;
}

function UnitTopicsList({
  unitId,
  selectedTopicId,
  onSelectTopic,
  searchQuery,
}: UnitTopicsListProps) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [addingTopic, setAddingTopic] = useState(false);

  const topicsQuery = useQuery({
    queryKey: ['units', unitId, 'topics'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Topic[] }>(`/units/${unitId}/topics`);
      return data.data;
    },
  });

  const invalidateTopics = () => queryClient.invalidateQueries({ queryKey: ['units', unitId, 'topics'] });

  const createTopic = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: Topic }>(`/units/${unitId}/topics`, {
        title: newTitle,
        estimatedMinutes: 30,
      });
      return data.data;
    },
    onSuccess: (topic) => {
      setNewTitle('');
      setAddingTopic(false);
      invalidateTopics();
      onSelectTopic(topic.id, unitId);
    },
  });

  const topics = useMemo(() => topicsQuery.data ?? [], [topicsQuery.data]);
  const filteredTopics = useMemo(() => {
    if (!searchQuery) return topics;
    return topics.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [topics, searchQuery]);

  // Auto select first topic if no topic is currently active
  useEffect(() => {
    if (!selectedTopicId && topics.length > 0) {
      onSelectTopic(topics[0].id, unitId);
    }
  }, [topics, selectedTopicId, onSelectTopic, unitId]);

  return (
    <div className="space-y-1">
      {filteredTopics.map((topic) => {
        const isSelected = selectedTopicId === topic.id;

        return (
          <button
            key={topic.id}
            onClick={() => onSelectTopic(topic.id, unitId)}
            className={`group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-all ${
              isSelected
                ? 'bg-gradient-to-tl from-purple-700 to-pink-500 text-white font-bold shadow-soft-sm'
                : 'text-slate-700 hover:bg-purple-50/60 font-medium'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  isSelected ? 'bg-white' : 'bg-purple-400'
                }`}
              />
              <span className="truncate">{topic.title}</span>
            </div>
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] ${
                isSelected
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-500 group-hover:bg-purple-100 group-hover:text-purple-700'
              }`}
            >
              {topic.estimatedMinutes}m
            </span>
          </button>
        );
      })}

      {addingTopic ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTopic.mutate();
          }}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1.5"
        >
          <input
            required
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Topic title…"
            className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={createTopic.isPending}
            className="rounded bg-purple-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-purple-700"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setAddingTopic(false)}
            className="text-slate-400 hover:text-slate-600 px-1 text-xs"
          >
            &times;
          </button>
        </form>
      ) : (
        <button
          onClick={() => setAddingTopic(true)}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 py-1.5 text-[11px] font-bold text-purple-600 hover:border-purple-300 hover:bg-purple-50/40 transition-colors"
        >
          <Plus className="h-3 w-3" />
          <span>Add Topic</span>
        </button>
      )}
    </div>
  );
}

/* ======================================================================================= */
/* MIDDLE COLUMN: Active Topic Studio (Reading, Lessons, Assessments, Flashcards)          */
/* ======================================================================================= */
interface MiddleTopicStudioProps {
  childId: number;
  selectedTopicId: number | null;
  activeSubject?: Subject;
  activeTab: 'materials' | 'lessons' | 'flashcards' | 'study-guide';
  onChangeTab: (tab: 'materials' | 'lessons' | 'flashcards' | 'study-guide') => void;
  onSelectTopic: (id: number | null) => void;
  layoutMode?: 'standard' | 'expanded' | 'focus';
  onToggleExpand?: () => void;
  onToggleFocus?: () => void;
}

function MiddleTopicStudio({
  childId,
  selectedTopicId,
  activeSubject,
  activeTab,
  onChangeTab,
  onSelectTopic,
  layoutMode = 'standard',
  onToggleExpand,
  onToggleFocus,
}: MiddleTopicStudioProps) {
  const queryClient = useQueryClient();
  const [scheduleDate, setScheduleDate] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editMinutes, setEditMinutes] = useState(30);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);
  const [showWorksheetModal, setShowWorksheetModal] = useState(false);

  // Fetch topic details if selected
  const topicQuery = useQuery({
    queryKey: ['topics', selectedTopicId, 'details'],
    enabled: !!selectedTopicId,
    queryFn: async () => {
      const { data } = await api.get<{ data: Topic }>(`/topics/${selectedTopicId}`);
      return data.data;
    },
  });

  const topic = topicQuery.data;

  useEffect(() => {
    if (topic) {
      setEditTitle(topic.title);
      setEditMinutes(topic.estimatedMinutes);
    }
  }, [topic]);

  const updateTopic = useMutation({
    mutationFn: async () => {
      if (!selectedTopicId) return;
      await api.patch(`/topics/${selectedTopicId}`, {
        title: editTitle,
        estimatedMinutes: editMinutes,
      });
    },
    onSuccess: () => {
      setIsEditingTitle(false);
      queryClient.invalidateQueries({ queryKey: ['topics', selectedTopicId, 'details'] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
    },
  });

  const deleteTopic = useMutation({
    mutationFn: async () => {
      if (!selectedTopicId) return;
      await api.delete(`/topics/${selectedTopicId}`);
    },
    onSuccess: () => {
      onSelectTopic(null);
      queryClient.invalidateQueries({ queryKey: ['units'] });
    },
  });

  const addToSchedule = useMutation({
    mutationFn: async () => {
      if (!selectedTopicId) return;
      const { data: session } = await api.post<{ data: { id: number } }>(`/children/${childId}/learning-sessions`, {
        topicId: selectedTopicId,
      });
      if (scheduleDate) {
        await api.patch(`/learning-sessions/${session.data.id}/schedule`, {
          scheduledDate: new Date(scheduleDate).toISOString(),
        });
      }
    },
    onSuccess: () => {
      setScheduleSuccess(true);
      setTimeout(() => setScheduleSuccess(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['children', childId, 'learning-sessions'] });
    },
  });

  if (!selectedTopicId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-soft-xl min-h-[460px]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-md mb-4">
          <Compass className="h-7 w-7" />
        </div>
        <h2 className="text-base font-bold text-slate-800">Select a Topic from the Left Panel</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Browse through course units on the left to review reading materials, generate interactive AI lessons, and practice spaced flashcards.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Topic Top Banner Card */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              {activeSubject && (
                <span
                  className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: activeSubject.color || '#7928CA' }}
                >
                  {activeSubject.name}
                </span>
              )}
              <span className="flex items-center gap-1 font-semibold text-slate-500">
                <Clock className="h-3 w-3" /> {topic?.estimatedMinutes ?? 30} min session
              </span>
            </div>

            {isEditingTitle ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateTopic.mutate();
                }}
                className="flex items-center gap-2 mt-1"
              >
                <input
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 p-1.5 text-sm font-bold text-slate-800 focus:outline-none"
                />
                <input
                  type="number"
                  min={5}
                  max={240}
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(Number(e.target.value))}
                  className="w-16 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-800"
                />
                <button
                  type="submit"
                  disabled={updateTopic.isPending}
                  className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(false)}
                  className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-800 truncate">{topic?.title}</h1>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                  title="Rename Topic"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete topic "${topic?.title}"?`)) deleteTopic.mutate();
                  }}
                  className="text-slate-400 hover:text-red-600 p-1"
                  title="Delete Topic"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions and Layout Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowWorksheetModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/80 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 hover:border-purple-300 shadow-soft-xs transition-all"
              title="Generate printable practice worksheet with math preservation"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Worksheet</span>
            </button>

            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
            />
            <button
              onClick={() => addToSchedule.mutate()}
              disabled={addToSchedule.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-soft-xs hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>{scheduleSuccess ? 'Scheduled ✓' : 'Add to Plan'}</span>
            </button>

            {onToggleExpand && (
              <button
                onClick={onToggleExpand}
                className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                title={layoutMode === 'expanded' ? 'Collapse to 3 columns' : 'Expand studio width'}
              >
                {layoutMode === 'expanded' ? <Minimize2 className="h-4 w-4" /> : <Columns className="h-4 w-4" />}
              </button>
            )}

            {onToggleFocus && (
              <button
                onClick={onToggleFocus}
                className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                title={layoutMode === 'focus' ? 'Exit full screen' : 'Full width reading focus'}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
          <button
            onClick={() => onChangeTab('materials')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'materials'
                ? 'bg-slate-800 text-white shadow-soft-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Reading & Notes</span>
          </button>
          <button
            onClick={() => onChangeTab('lessons')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'lessons'
                ? 'bg-slate-800 text-white shadow-soft-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            <span>Lessons & Quizzes</span>
          </button>
          <button
            onClick={() => onChangeTab('flashcards')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'flashcards'
                ? 'bg-slate-800 text-white shadow-soft-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            <span>Flashcards</span>
          </button>
          <button
            onClick={() => onChangeTab('study-guide')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'study-guide'
                ? 'bg-slate-800 text-white shadow-soft-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Study Guide</span>
          </button>
        </div>
      </div>

      {/* Dynamic Tab Content */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft-xl">
        {activeTab === 'materials' && <MiddleMaterialsTab topicId={selectedTopicId} />}
        {activeTab === 'lessons' && (
          <LessonsAndAssessmentsSection topicId={selectedTopicId} childId={childId} />
        )}
        {activeTab === 'flashcards' && <MiddleFlashcardsTab topicId={selectedTopicId} />}
        {activeTab === 'study-guide' && <StudyGuideSection topicId={selectedTopicId} />}
      </div>

      {/* Quick Worksheet Modal */}
      {showWorksheetModal && (
        <WorksheetModal
          isOpen={true}
          onClose={() => setShowWorksheetModal(false)}
          topicId={selectedTopicId}
          childId={childId}
          defaultTitle={topic?.title}
        />
      )}
    </div>
  );
}

/* ======================================================================================= */
/* MIDDLE TAB: Reading & Materials Studio                                                  */
/* ======================================================================================= */
function MiddleMaterialsTab({ topicId }: { topicId: number }) {
  const queryClient = useQueryClient();
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [addingLink, setAddingLink] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['topics', topicId, 'materials'] });

  const materialsQuery = useQuery({
    queryKey: ['topics', topicId, 'materials'],
    queryFn: async () => {
      const { data } = await api.get<{ data: FileAssetItem[] }>(`/topics/${topicId}/materials`);
      return data.data;
    },
  });

  const previewQuery = useQuery({
    queryKey: ['topics', topicId, 'content', 'preview'],
    queryFn: async () => {
      const { data } = await api.get<{ data: { markdown: string } }>(`/topics/${topicId}/content/preview`);
      return data.data.markdown;
    },
  });

  const addLink = useMutation({
    mutationFn: async () => {
      await api.post(`/topics/${topicId}/materials/link`, { url: linkUrl, label: linkLabel || undefined });
    },
    onSuccess: () => {
      setLinkUrl('');
      setLinkLabel('');
      setAddingLink(false);
      invalidate();
    },
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const isImage = file.type.startsWith('image/');
      await api.post(`/topics/${topicId}/materials/upload${isImage ? '?type=image' : ''}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: invalidate,
  });

  const uploadMarkdown = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/topics/${topicId}/materials/markdown-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['topics', topicId, 'content', 'preview'] });
    },
  });

  const deleteMaterial = useMutation({
    mutationFn: async (assetId: number) => {
      await api.delete(`/file-assets/${assetId}`);
    },
    onSuccess: invalidate,
  });

  const rawMarkdown = previewQuery.data;

  return (
    <div className="space-y-5">
      {/* Markdown Notes & Reading Section */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Study Guide & Reading Notes
            </h3>
          </div>
          <label className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100 transition-colors">
            <Upload className="h-3 w-3" />
            <span>Upload Notes (.md)</span>
            <input
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMarkdown.mutate(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        {rawMarkdown ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-slate-800 leading-relaxed shadow-soft-inner">
            <RichContent content={rawMarkdown} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/30 p-6 text-center text-xs text-slate-400">
            No study guide notes written yet. Upload a Markdown syllabus or generate an AI lesson.
          </div>
        )}
      </div>

      {/* Attached Media & Web Links */}
      <div className="border-t border-slate-100 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Attached Learning Resources ({materialsQuery.data?.length ?? 0})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddingLink(!addingLink)}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
            >
              <Plus className="h-3 w-3" />
              <span>Link</span>
            </button>
            <label className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100">
              <Upload className="h-3 w-3" />
              <span>File</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile.mutate(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        {addingLink && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addLink.mutate();
            }}
            className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="url"
                required
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:outline-none"
              />
              <input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="Title or description (optional)"
                className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setAddingLink(false)}
                className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addLink.isPending}
                className="rounded-lg bg-purple-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-purple-700"
              >
                Attach Link
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {materialsQuery.data?.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs shadow-soft-xs"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-soft-xs text-purple-600 shrink-0">
                  {asset.kind === 'video_link' ? (
                    <LinkIcon className="h-3.5 w-3.5" />
                  ) : (
                    <FileCode className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="truncate">
                  {asset.url ? (
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-slate-800 hover:text-purple-600 truncate block"
                    >
                      {asset.label || asset.originalName}
                    </a>
                  ) : (
                    <span className="font-bold text-slate-800 truncate block">
                      {asset.label || asset.originalName}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">{asset.kind}</span>
                </div>
              </div>
              <button
                onClick={() => deleteMaterial.mutate(asset.id)}
                className="rounded p-1 text-slate-400 hover:text-red-600 transition-colors"
                title="Remove material"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {materialsQuery.data?.length === 0 && (
            <div className="sm:col-span-2 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
              No links or attached media files yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================================================================================= */
/* MIDDLE TAB: Flashcards Studio                                                           */
/* ======================================================================================= */
function MiddleFlashcardsTab({ topicId }: { topicId: number }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [cardType, setCardType] = useState('basic');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [choices] = useState(['', '']);
  const [correctChoices] = useState<string[]>([]);
  const [clozeText, setClozeText] = useState('');
  const [clozeAnswers, setClozeAnswers] = useState('');

  const flashcardsQuery = useQuery({
    queryKey: ['topics', topicId, 'flashcards', search],
    queryFn: async () => {
      const { data } = await api.get<{ data: Flashcard[] }>(`/topics/${topicId}/flashcards`, {
        params: search ? { q: search } : undefined,
      });
      return data.data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['topics', topicId, 'flashcards'] });

  const createCard = useMutation({
    mutationFn: async () => {
      let finalAnswer = answer;
      if (cardType === 'multiple_choice') finalAnswer = correctChoices.join(', ') || choices[0];
      if (cardType === 'true_false') finalAnswer = correctChoices[0] || 'True';
      if (cardType === 'cloze') finalAnswer = clozeAnswers;

      await api.post(`/topics/${topicId}/flashcards`, {
        cardType,
        question: cardType === 'cloze' ? clozeText : question,
        answer: finalAnswer,
        choices: cardType === 'multiple_choice' ? choices.filter(Boolean) : undefined,
        correctChoices: correctChoices.length > 0 ? correctChoices : undefined,
        clozeText: cardType === 'cloze' ? clozeText : undefined,
        clozeAnswers: cardType === 'cloze' ? clozeAnswers.split(',').map((s) => s.trim()) : undefined,
      });
    },
    onSuccess: () => {
      setCreating(false);
      setQuestion('');
      setAnswer('');
      setClozeText('');
      setClozeAnswers('');
      invalidate();
    },
  });

  const deleteCard = useMutation({
    mutationFn: async (cardId: number) => {
      await api.delete(`/flashcards/${cardId}`);
    },
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Spaced Flashcards ({flashcardsQuery.data?.length ?? 0})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/topics/${topicId}/flashcards/preview`}
            className="flex items-center gap-1 rounded-xl bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            <Eye className="h-3 w-3" />
            <span>Preview</span>
          </Link>
          <Link
            to={`/topics/${topicId}/flashcards/print`}
            className="flex items-center gap-1 rounded-xl bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            <Printer className="h-3 w-3" />
            <span>Print</span>
          </Link>
          <button
            onClick={() => setCreating(!creating)}
            className="flex items-center gap-1 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-3 py-1 text-xs font-bold text-white shadow-soft-xs hover:scale-[1.02]"
          >
            <Plus className="h-3 w-3" />
            <span>New Card</span>
          </button>
        </div>
      </div>

      {/* Filter search bar */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter flashcards by question or answer…"
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        />
      </div>

      {/* Flashcard Creator Form */}
      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createCard.mutate();
          }}
          className="space-y-3 rounded-xl border border-purple-100 bg-purple-50/40 p-4"
        >
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">Card Format</label>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
            >
              <option value="basic">Basic (Question & Answer)</option>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="true_false">True / False</option>
              <option value="cloze">Cloze Deletion (Fill Blanks)</option>
            </select>
          </div>

          {cardType !== 'cloze' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Question / Prompt</label>
              <input
                required
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. What is the powerhouse of the cell?"
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:outline-none"
              />
            </div>
          )}

          {cardType === 'basic' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Answer</label>
              <input
                required
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="e.g. Mitochondria"
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:outline-none"
              />
            </div>
          )}

          {cardType === 'cloze' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sentence with blanks</label>
                <textarea
                  required
                  rows={2}
                  value={clozeText}
                  onChange={(e) => setClozeText(e.target.value)}
                  placeholder="e.g. The capital of France is ___."
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Answers (comma-separated)</label>
                <input
                  required
                  value={clozeAnswers}
                  onChange={(e) => setClozeAnswers(e.target.value)}
                  placeholder="Paris"
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-purple-100">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createCard.isPending}
              className="rounded-lg bg-gradient-to-tl from-purple-700 to-pink-500 px-4 py-1.5 text-xs font-bold text-white shadow-soft-xs"
            >
              {createCard.isPending ? 'Saving…' : 'Save Flashcard'}
            </button>
          </div>
        </form>
      )}

      {/* Cards List */}
      <div className="space-y-2">
        {flashcardsQuery.data?.map((card) => (
          <div
            key={card.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 shadow-soft-xs"
          >
            <div className="flex-1 space-y-1">
              <span className="inline-block rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                {card.cardType.replace('_', ' ')}
              </span>
              <div className="font-bold text-xs text-slate-800">
                <RichContent content={card.question} />
              </div>
              <div className="text-xs text-slate-500">
                <RichContent content={card.answer} />
              </div>
            </div>
            <button
              onClick={() => deleteCard.mutate(card.id)}
              className="rounded p-1 text-slate-400 hover:text-red-600 transition-colors"
              title="Delete Flashcard"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {flashcardsQuery.data?.length === 0 && !creating && (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            No flashcards created for this topic yet.
          </div>
        )}
      </div>
    </div>
  );
}

/* ======================================================================================= */
/* RIGHT COLUMN: AI Co-Pilot & Child Performance Hub                                      */
/* ======================================================================================= */
interface RightAICompanionHubProps {
  childId: number;
  selectedTopicId: number | null;
  activeTab: 'tutor' | 'profile_insights' | 'mastery_ops';
  onChangeTab: (tab: 'tutor' | 'profile_insights' | 'mastery_ops') => void;
}

function RightAICompanionHub({
  childId,
  selectedTopicId,
  activeTab,
  onChangeTab,
}: RightAICompanionHubProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-soft-xl">
      {/* Top Tab Bar */}
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChangeTab('tutor')}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'tutor'
                ? 'bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Tutor</span>
          </button>
          <button
            onClick={() => onChangeTab('profile_insights')}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'profile_insights'
                ? 'bg-gradient-to-tl from-blue-600 to-cyan-400 text-white shadow-soft-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            <span>Profile & AI</span>
          </button>
          <button
            onClick={() => onChangeTab('mastery_ops')}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'mastery_ops'
                ? 'bg-gradient-to-tl from-emerald-600 to-teal-400 text-white shadow-soft-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Mastery</span>
          </button>
        </div>
      </div>

      {/* Tab 1: AI Tutor */}
      {activeTab === 'tutor' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-purple-50/60 p-3 border border-purple-100">
            <p className="text-[11px] font-bold text-purple-900">Interactive Topic Tutor</p>
            <p className="text-[11px] text-purple-700 mt-0.5">
              {selectedTopicId
                ? 'Ask questions or request simpler explanations for the current topic.'
                : 'Select a topic from the left to ground the tutor in specific material.'}
            </p>
          </div>

          {selectedTopicId ? (
            <TutorChat messagesUrl={`/topics/${selectedTopicId}/tutor/messages`} />
          ) : (
            <div className="p-4 text-center text-xs text-slate-400">
              Please select a topic to begin AI tutoring.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Profile & Insights */}
      {activeTab === 'profile_insights' && (
        <div className="space-y-6">
          <LearningProfileSection childId={childId} />
          <InsightsSection childId={childId} />
        </div>
      )}

      {/* Tab 3: Mastery & Schedule Operations */}
      {activeTab === 'mastery_ops' && (
        <div className="space-y-6">
          <MasterySection childId={childId} />
          <ScheduleSection childId={childId} />
          <CatchUpSection childId={childId} />
          <ReviewSlotsSection childId={childId} />
        </div>
      )}
    </div>
  );
}

/* ======================================================================================= */
/* HELPER SECTIONS: Schedule, Catch-Up, Review Slots                                       */
/* ======================================================================================= */
interface TimeBlockItem {
  id: number;
  label: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  commitmentType: string;
  isImported: boolean;
}

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function ScheduleSection({ childId }: { childId: number }) {
  const timeBlocksQuery = useQuery({
    queryKey: ['children', childId, 'time-blocks'],
    queryFn: async () => {
      const { data } = await api.get<{ data: TimeBlockItem[] }>(`/children/${childId}/time-blocks`);
      return data.data;
    },
  });

  return (
    <section className="mt-4 pt-4 border-t border-slate-100">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Weekly Schedule</h3>
        <Link
          to={`/children/${childId}/calendar`}
          className="text-[11px] font-bold text-purple-600 hover:underline"
        >
          Calendar →
        </Link>
      </div>

      <div className="space-y-1.5">
        {timeBlocksQuery.data?.slice(0, 4).map((tb) => (
          <div
            key={tb.id}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-xs"
          >
            <span className="font-semibold text-slate-700 truncate">
              {tb.label} · {DAY_NAMES[tb.dayOfWeek]} {tb.startTime}-{tb.endTime}
            </span>
            <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] uppercase font-bold text-slate-600">
              {tb.commitmentType}
            </span>
          </div>
        ))}
        {timeBlocksQuery.data?.length === 0 && (
          <p className="text-xs text-slate-400">No time blocks configured.</p>
        )}
      </div>
    </section>
  );
}

function CatchUpSection({ childId }: { childId: number }) {
  const queryClient = useQueryClient();

  const catchUpsQuery = useQuery({
    queryKey: ['children', childId, 'catch-up-sessions'],
    queryFn: async () => {
      const { data } = await api.get<{ data: CatchUp[] }>(`/children/${childId}/catch-up-sessions`);
      return data.data;
    },
  });

  const redistributeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/children/${childId}/catch-up-sessions/redistribute`);
      return data.data as { reassigned: number; stillPending: number };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['children', childId, 'catch-up-sessions'] }),
  });

  const pending = catchUpsQuery.data?.filter((c) => c.status === 'pending') ?? [];

  return (
    <section className="mt-4 pt-4 border-t border-slate-100">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Missed Sessions Queue</h3>
        {pending.length > 0 && (
          <button
            onClick={() => redistributeMutation.mutate()}
            disabled={redistributeMutation.isPending}
            className="rounded-lg bg-amber-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-600"
          >
            Redistribute ({pending.length})
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {catchUpsQuery.data?.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-xs"
          >
            <span className="font-semibold text-slate-700 truncate">{c.topic.title}</span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
              {c.status}
            </span>
          </div>
        ))}
        {catchUpsQuery.data?.length === 0 && (
          <p className="text-xs text-slate-400">All caught up! No missed sessions.</p>
        )}
      </div>
    </section>
  );
}

function ReviewSlotsSection({ childId }: { childId: number }) {
  const queryClient = useQueryClient();

  const slotsQuery = useQuery({
    queryKey: ['children', childId, 'review-slots'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ReviewSlot[] }>(`/children/${childId}/review-slots`);
      return data.data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['children', childId, 'review-slots'] });

  const createDefaults = useMutation({
    mutationFn: async () => {
      await api.post(`/children/${childId}/review-slots/create-defaults`);
    },
    onSuccess: invalidate,
  });

  const toggleSlot = useMutation({
    mutationFn: async (slotId: number) => {
      await api.patch(`/review-slots/${slotId}/toggle`);
    },
    onSuccess: invalidate,
  });

  return (
    <section className="mt-4 pt-4 border-t border-slate-100">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Spaced Review Slots</h3>
        {slotsQuery.data?.length === 0 && (
          <button
            onClick={() => createDefaults.mutate()}
            disabled={createDefaults.isPending}
            className="rounded-lg bg-purple-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-purple-700"
          >
            + Auto 2/day
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {slotsQuery.data?.slice(0, 4).map((slot) => (
          <div
            key={slot.id}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-1.5 text-xs"
          >
            <span className={slot.isActive ? 'font-semibold text-slate-700' : 'text-slate-400 line-through'}>
              {DAY_NAMES_SHORT[slot.dayOfWeek]} {slot.startTime}-{slot.endTime}
            </span>
            <button
              onClick={() => toggleSlot.mutate(slot.id)}
              className="text-[11px] font-bold text-purple-600 hover:underline"
            >
              {slot.isActive ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
        {slotsQuery.data?.length === 0 && (
          <p className="text-xs text-slate-400">No review slots configured.</p>
        )}
      </div>
    </section>
  );
}
