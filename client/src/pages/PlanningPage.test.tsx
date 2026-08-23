import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { AuthProvider } from '../hooks/useAuth';
import { I18nProvider } from '../i18n';

afterEach(() => cleanup());

const mockUser = { id: 1, name: 'Test Parent', email: 'test@example.com', locale: 'en', timezone: 'UTC' };

const mockSessions = [
  { id: 10, estimatedMinutes: 30, status: 'backlog', commitmentType: 'preferred', scheduledDayOfWeek: null, scheduledStartTime: null, scheduledEndTime: null, topic: { title: 'Fractions' } },
  { id: 11, estimatedMinutes: 45, status: 'scheduled', commitmentType: 'fixed', scheduledDayOfWeek: 2, scheduledStartTime: '09:00', scheduledEndTime: '09:45', topic: { title: 'Cursive' } },
];

const mockCapacity = Array.from({ length: 7 }, (_, i) => ({
  day: i + 1,
  dayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i],
  availableMinutes: 0,
  scheduledMinutes: 0,
  remainingMinutes: 0,
  utilizationPercent: 0,
  status: 'green' as const,
  timeBlocksCount: 0,
  sessionsCount: 0,
}));

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: { data: mockUser } });
      if (url === '/children/1/learning-sessions') return Promise.resolve({ data: { data: mockSessions } });
      if (url === '/children/1/catch-up-sessions') return Promise.resolve({ data: { data: [] } });
      if (url === '/children/1/planning/capacity') return Promise.resolve({ data: { data: mockCapacity } });
      if (url === '/children/1/planning/quality-analysis')
        return Promise.resolve({ data: { data: { ageGroup: '9-12', maxDailyMinutes: 180, daysExceedingAgeLimit: 0, recommendations: [] } } });
      return Promise.reject(new Error(`unmocked GET ${url}`));
    }),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
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

describe('PlanningPage (authenticated)', () => {
  it('renders the board columns and session cards without throwing', async () => {
    renderApp('/children/1/planning');

    expect(await waitFor(() => screen.getByText('Fractions'))).toBeDefined();
    expect(screen.getByText('Cursive')).toBeDefined();
    expect(screen.getByText('Backlog')).toBeDefined();
    expect(screen.getByText('Planned')).toBeDefined();
    expect(screen.getByText('Scheduled')).toBeDefined();
    expect(screen.getByText('Done')).toBeDefined();
    expect(screen.getByText('Catch-Up')).toBeDefined();
  });
});
