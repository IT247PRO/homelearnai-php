import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { AuthProvider } from '../hooks/useAuth';
import { I18nProvider } from '../i18n';

afterEach(() => cleanup());

const mockUser = {
  id: 1,
  name: 'Test Parent',
  email: 'test@example.com',
  locale: 'en',
  timezone: 'UTC',
  regionFormat: 'us',
  timeFormat: '12h',
  weekStart: 'sunday',
  dateFormatType: 'us',
  emailVerified: true,
  onboardingCompleted: true,
  onboardingSkipped: false,
};

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: { data: mockUser } });
      return Promise.reject(new Error(`unmocked GET ${url}`));
    }),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: { data: mockUser } })),
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

describe('ProfilePage (authenticated)', () => {
  it('renders general, preferences, and security sections without throwing', async () => {
    renderApp('/profile');

    expect(await waitFor(() => screen.getByRole('heading', { name: 'General' }))).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Security' })).toBeDefined();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Test Parent');
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeDefined();
  });
});
