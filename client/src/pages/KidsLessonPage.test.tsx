import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { AuthProvider } from '../hooks/useAuth';
import { I18nProvider } from '../i18n';

afterEach(() => cleanup());

// Mutable "server state" the mocked api reads/writes, so advancing through the lesson in the
// UI actually changes what the next GET returns — a lightweight stand-in for the real
// server's LessonProgress/LessonSectionResponse rows.
let serverIndex = 0;
let serverCompletedAt: string | null = null;
let section2Attempts: Array<{ isCorrect: boolean }> = [];

beforeEach(() => {
  serverIndex = 0;
  serverCompletedAt = null;
  section2Attempts = [];
});

const STATIC_SECTION = { id: 10, kind: 'instruction', content: 'A fraction has a numerator and a denominator.', sortOrder: 0, interactionType: null, choices: null };
const INTERACTIVE_SECTION_ID = 11;

function interactiveSectionPayload() {
  const attemptCount = section2Attempts.length;
  const latest = section2Attempts[attemptCount - 1];
  return {
    id: INTERACTIVE_SECTION_ID,
    kind: 'practice',
    content: 'In 3/4, which number is the denominator?',
    sortOrder: 1,
    interactionType: 'multiple_choice',
    choices: ['3', '4'],
    attemptCount,
    isCorrect: latest?.isCorrect ?? null,
    hint: attemptCount === 1 && latest?.isCorrect === false ? 'The denominator is on the bottom.' : undefined,
    revealAnswer: false,
  };
}

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/auth/me') return Promise.reject(new Error('unauthenticated'));
      if (url === '/kids/lessons/1') {
        return Promise.resolve({
          data: {
            data: {
              id: 1,
              title: 'Understanding Fractions',
              topicId: 5,
              currentSectionIndex: serverIndex,
              completedAt: serverCompletedAt,
              isLastLessonInTopic: false,
              topicAssessment: null,
              sections: [{ ...STATIC_SECTION, attemptCount: 0, isCorrect: null }, interactiveSectionPayload()],
            },
          },
        });
      }
      return Promise.reject(new Error(`unmocked GET ${url}`));
    }),
    post: vi.fn((url: string, body: unknown) => {
      if (url === `/kids/lessons/1/sections/${INTERACTIVE_SECTION_ID}/respond`) {
        const response = (body as { response: string }).response;
        const isCorrect = response === '4';
        section2Attempts.push({ isCorrect });
        return Promise.resolve({
          data: {
            data: {
              isCorrect,
              hint: !isCorrect ? 'The denominator is on the bottom.' : undefined,
              revealAnswer: false,
              canAdvance: isCorrect,
            },
          },
        });
      }
      if (url === '/kids/lessons/1/advance') {
        const newIndex = serverIndex + 1;
        const completed = newIndex >= 2;
        serverIndex = newIndex;
        if (completed) serverCompletedAt = new Date().toISOString();
        return Promise.resolve({ data: { data: { completed, currentSectionIndex: newIndex } } });
      }
      return Promise.reject(new Error(`unmocked POST ${url}`));
    }),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
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

describe('KidsLessonPage', () => {
  it('gates advancing on a wrong answer, accepts a retry, and completes the lesson', async () => {
    renderApp('/kids/lessons/1');

    // Static section first — free to advance immediately.
    await waitFor(() => screen.getByText(/numerator and a denominator/));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Interactive section: answering wrong should show a hint and keep "Finish lesson" disabled.
    await waitFor(() => screen.getByText(/which number is the denominator/i));
    fireEvent.click(screen.getByRole('radio', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: /check my answer/i }));
    await waitFor(() => screen.getByText(/denominator is on the bottom/i));
    expect((screen.getByRole('button', { name: /finish lesson/i }) as HTMLButtonElement).disabled).toBe(true);

    // Answer correctly — "Finish lesson" should become enabled and complete the lesson.
    fireEvent.click(screen.getByRole('radio', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect((screen.getByRole('button', { name: /finish lesson/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /finish lesson/i }));

    expect(await waitFor(() => screen.getByText(/lesson complete/i))).toBeDefined();
    expect(screen.getByText('Understanding Fractions')).toBeDefined();
  });
});
