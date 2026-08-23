import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { AuthProvider } from '../hooks/useAuth';
import { I18nProvider } from '../i18n';

afterEach(() => cleanup());

const mockUser = { id: 1, name: 'Test Parent', email: 'test@example.com', locale: 'en', timezone: 'UTC' };
const mockDashboard = {
  children: [
    { child: { id: 1, name: 'Ava', grade: '3rd' }, todaySessionCount: 2, pendingCatchUps: 1, currentStreakDays: 3, totalPoints: 45 },
  ],
};

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: { data: mockUser } });
      if (url === '/dashboard') return Promise.resolve({ data: { data: mockDashboard } });
      return Promise.reject(new Error(`unmocked GET ${url}`));
    }),
    post: vi.fn(),
    patch: vi.fn(),
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

describe('ParentDashboardPage (authenticated)', () => {
  it('renders child summary cards without throwing', async () => {
    renderApp('/dashboard');
    const link = await waitFor(() => screen.getByRole('link', { name: /ava/i }));
    expect(link).toBeDefined();
    expect(screen.getByText(/2 session\(s\)/i)).toBeDefined();
    expect(screen.getByText(/45/)).toBeDefined();
  });
});
