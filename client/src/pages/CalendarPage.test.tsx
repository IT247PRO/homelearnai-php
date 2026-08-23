import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { AuthProvider } from '../hooks/useAuth';
import { I18nProvider } from '../i18n';

afterEach(() => cleanup());

const mockUser = { id: 1, name: 'Test Parent', email: 'test@example.com', locale: 'en', timezone: 'UTC', weekStart: 'sunday' };

const mockTimeBlocks = [
  { id: 5, label: 'Morning Study', dayOfWeek: 2, startTime: '09:00', endTime: '10:00', commitmentType: 'preferred', isImported: false },
];

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: { data: mockUser } });
      if (url === '/children/1/time-blocks') return Promise.resolve({ data: { data: mockTimeBlocks } });
      if (url === '/children/1/review-slots') return Promise.resolve({ data: { data: [] } });
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

describe('CalendarPage (authenticated)', () => {
  it('renders the weekly grid and existing time blocks without throwing', async () => {
    renderApp('/children/1/calendar');

    expect(await waitFor(() => screen.getByText('Morning Study'))).toBeDefined();
    expect(screen.getByText('Import a calendar (.ics file)')).toBeDefined();
    expect(screen.getAllByText('Tue').length).toBeGreaterThan(0);
  });
});
