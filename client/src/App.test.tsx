import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import { I18nProvider } from './i18n';

// Renders with a real DOM (jsdom) so a real render-time error (bad hook usage, missing
// provider, broken import) actually surfaces — a clean `tsc`/`vite build` would not catch
// this class of bug.
vi.mock('./lib/api', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('unauthenticated')),
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

describe('App', () => {
  it('renders without throwing and redirects an unauthenticated visitor to /login', async () => {
    renderApp('/');
    const heading = await waitFor(() => screen.getByRole('heading', { name: /log in/i }));
    expect(heading).toBeDefined();
  });

  it('renders the register page at /register', async () => {
    renderApp('/register');
    const heading = await waitFor(() => screen.getByRole('heading', { name: /create a parent account/i }));
    expect(heading).toBeDefined();
  });

  it('does not redirect away from /login itself (no redirect loop)', async () => {
    renderApp('/login');
    const heading = await waitFor(() => screen.getByRole('heading', { name: /log in/i }));
    expect(heading).toBeDefined();
  });
});
