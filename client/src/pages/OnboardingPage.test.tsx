import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  onboardingCompleted: false,
  onboardingSkipped: false,
};
const mockChild = { id: 1, name: 'Ava' };

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: { data: mockUser } });
      return Promise.reject(new Error(`unmocked GET ${url}`));
    }),
    post: vi.fn((url: string) => {
      if (url === '/onboarding/children') return Promise.resolve({ data: { data: [mockChild] } });
      if (url === '/onboarding/subjects') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: {} });
    }),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
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

describe('OnboardingPage (authenticated)', () => {
  it('walks through all three steps without throwing', async () => {
    renderApp('/onboarding');

    const nameInput = await waitFor(() => screen.getByLabelText('Child 1 name'));
    fireEvent.change(nameInput, { target: { value: 'Ava' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Step 2: subject template picker for the created child
    await waitFor(() => expect(screen.getByText('Ava')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Math' }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Step 3: completion screen
    const done = await waitFor(() => screen.getByText(/all set/i));
    expect(done).toBeDefined();
  });

  it('skip button works from step 1 without throwing', async () => {
    renderApp('/onboarding');
    await waitFor(() => screen.getByLabelText('Child 1 name'));
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));
    // No assertion beyond "didn't throw" — navigation target (dashboard) isn't mocked here.
  });
});
