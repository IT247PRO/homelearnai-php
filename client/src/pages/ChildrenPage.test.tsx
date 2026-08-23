import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { AuthProvider } from '../hooks/useAuth';
import { I18nProvider } from '../i18n';

afterEach(() => cleanup());

const mockUser = { id: 1, name: 'Test Parent', email: 'test@example.com', locale: 'en', timezone: 'UTC' };
const mockChildren = [{ id: 1, name: 'Ava', grade: '3rd', independenceLevel: 2 }];

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: { data: mockUser } });
      if (url === '/children') return Promise.resolve({ data: { data: mockChildren } });
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

describe('ChildrenPage (authenticated)', () => {
  it('renders the children list and add-child form without throwing', async () => {
    renderApp('/children');
    const childLink = await waitFor(() => screen.getByRole('link', { name: /ava/i }));
    expect(childLink).toBeDefined();
    expect(screen.getByRole('button', { name: /add child/i })).toBeDefined();
  });
});
