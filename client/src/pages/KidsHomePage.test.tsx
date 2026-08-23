import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { AuthProvider } from '../hooks/useAuth';
import { I18nProvider } from '../i18n';

afterEach(() => cleanup());

// No active Kids Mode session: /kids/me rejects, same as the real server's 401
// kids_mode_not_active response.
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn((url: string) => Promise.reject(new Error(`unauthenticated: ${url}`))),
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

describe('KidsHomePage (no active kids session)', () => {
  it('renders a clean "not active" state rather than throwing or hanging', async () => {
    renderApp('/kids');
    const message = await waitFor(() => screen.getByText(/kids mode isn't active/i));
    expect(message).toBeDefined();
    expect(screen.getByRole('link', { name: /parent dashboard/i })).toBeDefined();
  });
});
