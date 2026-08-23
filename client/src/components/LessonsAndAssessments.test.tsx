import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LessonsAndAssessmentsSection } from './LessonsAndAssessments';

afterEach(() => cleanup());

const mockLessons = [
  {
    id: 1,
    title: 'Intro to Quadratics',
    estimatedMinutes: 30,
    status: 'draft',
    source: 'ai_generated',
    sections: [{ id: 1, kind: 'introduction', content: 'Quadratics are fun.', sortOrder: 0 }],
  },
];

const mockAssessments = [
  {
    id: 5,
    title: 'Quadratics Quiz',
    source: 'ai_generated',
    questions: [{ id: 9, type: 'multiple_choice', prompt: 'Pick the right one', choices: ['A', 'B'], difficultyLevel: 'medium' }],
  },
];

const patch = vi.fn().mockResolvedValue({ data: {} });
const post = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/topics/23/lessons') return Promise.resolve({ data: { data: mockLessons } });
      if (url === '/topics/23/assessments') return Promise.resolve({ data: { data: mockAssessments } });
      return Promise.reject(new Error(`unmocked GET ${url}`));
    }),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
  apiErrorBody: () => null,
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('LessonsAndAssessmentsSection', () => {
  it('expands a lesson to show its sections and approves it', async () => {
    renderWithClient(<LessonsAndAssessmentsSection topicId={23} childId={1} />);

    const lessonToggle = await waitFor(() => screen.getByText('Intro to Quadratics').closest('button'));
    fireEvent.click(lessonToggle!);

    expect(await waitFor(() => screen.getByText('Quadratics are fun.'))).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/lessons/1/status', { status: 'approved' }));
  });

  it('takes a quiz end-to-end: starts an attempt, answers, and shows the score', async () => {
    post.mockImplementation((url: string) => {
      if (url === '/assessments/5/attempts') return Promise.resolve({ data: { data: { id: 100 } } });
      if (url === '/assessment-attempts/100/answers') return Promise.resolve({ data: { data: {} } });
      if (url === '/assessment-attempts/100/complete') return Promise.resolve({ data: { data: { score: 1 } } });
      return Promise.reject(new Error(`unmocked POST ${url}`));
    });

    renderWithClient(<LessonsAndAssessmentsSection topicId={23} childId={1} />);

    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: 'Take quiz' })));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/assessments/5/attempts', { childId: 1 }));

    fireEvent.click(await waitFor(() => screen.getByLabelText('A')));
    fireEvent.click(screen.getByRole('button', { name: 'Finish quiz' }));

    expect(await waitFor(() => screen.getByText('Score: 100%'))).toBeDefined();
    expect(post).toHaveBeenCalledWith('/assessment-attempts/100/answers', { questionId: 9, response: 'A' });
  });
});
