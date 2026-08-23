import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import KidsStudyGuidePage from './KidsStudyGuidePage';

const mockGet = vi.fn();
vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: vi.fn().mockResolvedValue({ data: { data: { conversationId: 1, reply: 'ok' } } }),
  },
  apiErrorBody: () => null,
}));

const version = {
  id: 10,
  versionNumber: 1,
  content: {
    overview: 'What you will learn.',
    learningObjectives: ['Learn a thing.'],
    concepts: [
      { title: 'First Concept', simpleExplanation: 'Simple.', detailedExplanation: 'Detailed.' },
      { title: 'Second Concept', simpleExplanation: 'Simple 2.', detailedExplanation: 'Detailed 2.' },
    ],
    vocabulary: [{ term: 'Word', definition: 'Meaning', childFriendlyExplanation: 'Kid meaning' }],
    practiceQuestions: [{ question: 'Ready?', answer: 'Yes.' }],
  },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/kids/topics/3/study-guide']}>
        <Routes>
          <Route path="/kids/topics/:topicId/study-guide" element={<KidsStudyGuidePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('KidsStudyGuidePage', () => {
  it('renders a "not available" state without throwing when no guide is published', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: null } });
    renderPage();
    await waitFor(() => expect(screen.getByText(/no study guide is available/i)).toBeDefined());
  });

  it('renders the concept stepper, vocabulary, and practice questions without throwing', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: version } });
    renderPage();
    await waitFor(() => expect(screen.getByText('First Concept')).toBeDefined());
    expect(screen.getByText('What you will learn.')).toBeDefined();
    expect(screen.getByText('Word')).toBeDefined();
    expect(screen.getByText('Ready?')).toBeDefined();

    // Stepping to the next concept exercises the Prev/Next state transition without crashing.
    fireEvent.click(screen.getByText('Next →'));
    await waitFor(() => expect(screen.getByText('Second Concept')).toBeDefined());

    // Flipping a vocabulary card exercises the child-friendly-explanation branch.
    fireEvent.click(screen.getByText('Word'));
    await waitFor(() => expect(screen.getByText('Kid meaning')).toBeDefined());
  });
});
