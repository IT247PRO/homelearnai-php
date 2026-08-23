import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { AuthProvider } from '../hooks/useAuth';
import { I18nProvider } from '../i18n';

afterEach(() => cleanup());

const mockUser = { id: 1, name: 'Test Parent', email: 'test@example.com', locale: 'en', timezone: 'UTC' };

function makeCurriculum(overrides: { id: number; status: string; lessonPlanStatus: string; lessons?: unknown[]; assessment?: unknown }) {
  return {
    id: overrides.id,
    title: '7th Grade Science',
    subjectArea: 'Science',
    gradeLevel: '7th',
    schoolYear: '2026-2027',
    status: overrides.status,
    masteryThresholdPercent: 70,
    sourceType: 'school',
    sourceName: null,
    sourceUrl: null,
    units: [
      {
        id: 1,
        title: 'Scientific Investigation',
        description: null,
        confidence: 'explicit',
        sortOrder: 0,
        topics: [
          {
            id: 10,
            title: 'Scientific Method',
            description: null,
            confidence: 'inferred',
            sourceExcerpt: null,
            estimatedLessonCount: 3,
            lessonPlanStatus: overrides.lessonPlanStatus,
            sortOrder: 0,
            skills: [],
            objectives: [{ id: 100, description: 'Identify the steps of the scientific method.', curriculumSkillId: null }],
            prerequisites: [],
            lessons: overrides.lessons ?? [],
            assessment: overrides.assessment ?? null,
          },
        ],
      },
    ],
  };
}

const outlineGeneratedCurriculum = makeCurriculum({ id: 1, status: 'outline_generated', lessonPlanStatus: 'pending' });
const readyCurriculum = makeCurriculum({
  id: 2,
  status: 'ready',
  lessonPlanStatus: 'generated',
  lessons: [{ id: 200, title: 'What Is a Hypothesis?', lessonType: 'introduction', estimatedMinutes: 20, sequenceNumber: 1, sections: [] }],
  assessment: { id: 300, title: 'Scientific Method Check', questions: [] },
});

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: { data: mockUser } });
      if (url === '/curricula/1') return Promise.resolve({ data: { data: outlineGeneratedCurriculum } });
      if (url === '/curricula/1/quality-check') return Promise.resolve({ data: { data: { warnings: [] } } });
      if (url === '/curricula/2') return Promise.resolve({ data: { data: readyCurriculum } });
      if (url === '/curricula/2/quality-check') return Promise.resolve({ data: { data: { warnings: [] } } });
      if (url === '/children') return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`unmocked GET ${url}`));
    }),
    post: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    patch: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
  apiErrorBody: () => null,
}));

function renderApp(initialRoute: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <I18nProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CurriculumOutlinePage (authenticated)', () => {
  it('shows the outline tree and gates lesson generation behind Approve Outline while status is outline_generated', async () => {
    renderApp('/curricula/1/outline');

    expect(await waitFor(() => screen.getByText('Scientific Method'))).toBeDefined();
    expect(screen.getByText('AI-inferred')).toBeDefined();
    expect(screen.getByText('From source')).toBeDefined();
    expect(screen.getByText('Approve Outline')).toBeDefined();
    expect(screen.queryByText('Build Learning Plan')).toBeNull();
    expect(screen.queryByText('Schedule for a child')).toBeNull();
  });

  it('shows generated lessons and the schedule-for-a-child section once every topic is generated', async () => {
    renderApp('/curricula/2/outline');

    expect(await waitFor(() => screen.getByText(/Every topic has a generated lesson sequence/))).toBeDefined();
    expect(screen.getByText('Schedule for a child')).toBeDefined();
    expect(screen.queryByText('Approve Outline')).toBeNull();
  });
});
