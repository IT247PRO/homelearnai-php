import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MasterySection } from './MasterySection';

afterEach(() => cleanup());

const mockRows = [
  {
    id: 1,
    topicId: 23,
    state: 'introduced',
    accuracy: 0.5,
    attemptsCount: 2,
    topic: { title: 'Quadratics', unit: { name: 'Algebra', subject: { name: 'Math', color: '#3b82f6' } } },
  },
  {
    id: 2,
    topicId: 24,
    state: 'mastered',
    accuracy: 0.95,
    attemptsCount: 10,
    topic: { title: 'Fractions', unit: { name: 'Algebra', subject: { name: 'Math', color: '#3b82f6' } } },
  },
];

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/children/1/mastery') return Promise.resolve({ data: { data: mockRows } });
      if (url === '/children/2/mastery') return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`unmocked GET ${url}`));
    }),
  },
  apiErrorBody: () => null,
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('MasterySection', () => {
  it('groups mastery rows by subject and unit, showing state and topic title', async () => {
    renderWithClient(<MasterySection childId={1} />);

    expect(await waitFor(() => screen.getByText('Math'))).toBeDefined();
    expect(screen.getByText('Algebra')).toBeDefined();
    expect(screen.getByText('Quadratics · Introduced')).toBeDefined();
    expect(screen.getByText('Fractions · Mastered')).toBeDefined();
  });

  it('shows an empty state when nothing has been tracked yet', async () => {
    renderWithClient(<MasterySection childId={2} />);
    expect(await waitFor(() => screen.getByText(/No activity recorded yet/))).toBeDefined();
  });
});
