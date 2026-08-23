import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TutorChat } from './TutorChat';

afterEach(() => cleanup());

const post = vi.fn();

vi.mock('../lib/api', () => ({
  api: { post: (...args: unknown[]) => post(...args) },
  apiErrorBody: (err: unknown) => (err as { body?: unknown } | undefined)?.body ?? null,
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('TutorChat', () => {
  it('sends a message and renders the tutor reply, reusing the conversationId on the next turn', async () => {
    post
      .mockResolvedValueOnce({ data: { data: { conversationId: 7, reply: 'Great question! Why do you think that happens?' } } })
      .mockResolvedValueOnce({ data: { data: { conversationId: 7, reply: 'Exactly right!' } } });

    renderWithClient(<TutorChat messagesUrl="/topics/23/tutor/messages" />);

    const input = screen.getByLabelText('Message to the tutor');
    fireEvent.change(input, { target: { value: 'Why the plus-or-minus?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));

    expect(await waitFor(() => screen.getByText(/Great question!/))).toBeDefined();
    expect(post).toHaveBeenCalledWith('/topics/23/tutor/messages', { conversationId: undefined, message: 'Why the plus-or-minus?' });

    fireEvent.change(screen.getByLabelText('Message to the tutor'), { target: { value: 'Oh I see' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));

    await waitFor(() => screen.getByText('Exactly right!'));
    expect(post).toHaveBeenLastCalledWith('/topics/23/tutor/messages', { conversationId: 7, message: 'Oh I see' });
  });

  it('shows a clear message when the AI provider is not configured', async () => {
    post.mockRejectedValueOnce({ body: { error: 'ai_not_configured', message: "AI features aren't set up yet." } });

    renderWithClient(<TutorChat messagesUrl="/kids/topics/23/tutor/messages" kidsStyle />);
    fireEvent.change(screen.getByLabelText('Message to the tutor'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));

    expect(await waitFor(() => screen.getByText("AI features aren't set up yet."))).toBeDefined();
  });
});
