import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StudyGuideSection } from './StudyGuideSection';

// Renders with a real DOM (jsdom) so a render-time error (bad optional chaining, a `0 && <div>`
// footgun, a missing null check) actually surfaces — a clean tsc/vite build would not catch this.
const mockGet = vi.fn();
vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
  apiErrorBody: () => null,
}));

const fullGuide = {
  id: 1,
  currentVersionId: 10,
  versions: [
    {
      id: 10,
      versionNumber: 1,
      status: 'draft',
      reason: null,
      createdAt: '2026-08-23T00:00:00.000Z',
      content: {
        overview: 'An overview of the topic.',
        learningObjectives: ['Objective one.'],
        concepts: [
          {
            title: 'Concept One',
            simpleExplanation: 'Simple.',
            detailedExplanation: 'Detailed.',
            example: 'An example.',
            realWorldApplication: 'A real-world use.',
            commonMisconceptions: ['A common mistake.'],
          },
        ],
        vocabulary: [{ term: 'Term', definition: 'Definition.' }],
        practiceQuestions: [{ question: 'Q1?', answer: 'A1.' }],
        reviewQuestions: [{ question: 'Q2?', answer: 'A2.' }],
      },
    },
  ],
};

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <StudyGuideSection topicId={3} />
    </QueryClientProvider>
  );
}

describe('StudyGuideSection', () => {
  it('renders the empty state without throwing when no guide exists yet', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: null } });
    renderSection();
    await waitFor(() => expect(screen.getByText(/no study guide generated yet/i)).toBeDefined());
  });

  it('renders a full guide — overview, concepts, vocabulary, and questions — without throwing', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: fullGuide } });
    renderSection();
    await waitFor(() => expect(screen.getByText('An overview of the topic.')).toBeDefined());
    expect(screen.getByText('Objective one.')).toBeDefined();
    expect(screen.getByText('Concept One')).toBeDefined();
    expect(screen.getByText('Term')).toBeDefined();
    expect(screen.getByText('Q1?')).toBeDefined();

    // Expanding a concept renders its example/misconception branches without crashing.
    fireEvent.click(screen.getByText('Concept One'));
    await waitFor(() => expect(screen.getByText('A common mistake.')).toBeDefined());
  });
});
