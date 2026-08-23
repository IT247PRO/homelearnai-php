import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, apiErrorBody } from '../lib/api';
import { RichContent } from './RichContent';

interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TutorReply {
  conversationId: number;
  reply: string;
  followUpQuestion?: string;
  recommendsPractice?: boolean;
}

const QUICK_ACTIONS = [
  { label: '💡 Explain this', message: 'Can you explain this differently, in a simpler way?' },
  { label: '📖 Give an example', message: 'Can you give me an example?' },
  { label: '🤔 Give me a hint', message: "I'm stuck — can you give me a hint without telling me the answer?" },
];

/** Embedded directly in the topic/lesson a child/parent is already looking at — not a
 * standalone chat page. Works against either the parent-authenticated preview endpoint or
 * the Kids Mode endpoint, whichever `messagesUrl` points at; both share the same
 * postTutorMessage service and safety/pedagogy system prompt server-side. When `lessonId`
 * (and optionally `sectionId`) is passed, the tutor sees the exact lesson content the child
 * is looking at plus their recent mistakes in it (Plan3 §42-44), and the three quick-action
 * buttons (Plan3 §32-36, scoped to canned context-aware prompts) become available. */
export function TutorChat({
  messagesUrl,
  kidsStyle,
  lessonId,
  sectionId,
  studyGuideVersionId,
  conceptIndex,
}: {
  messagesUrl: string;
  kidsStyle?: boolean;
  lessonId?: number;
  sectionId?: number;
  studyGuideVersionId?: number;
  conceptIndex?: number;
}) {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: async (message: string) => {
      const { data } = await api.post<{ data: TutorReply }>(messagesUrl, {
        conversationId: conversationId ?? undefined,
        message,
        lessonId,
        sectionId,
        studyGuideVersionId,
        conceptIndex,
      });
      return data.data;
    },
    onSuccess: (result, message) => {
      setConversationId(result.conversationId);
      const assistantText = [result.reply, result.followUpQuestion].filter(Boolean).join('\n\n');
      setMessages((prev) => [...prev, { role: 'user', content: message }, { role: 'assistant', content: assistantText }]);
      setInput('');
      setError(null);
      setNotConfigured(null);
    },
    onError: (err) => {
      const body = apiErrorBody(err);
      if (body?.error === 'ai_not_configured') {
        setNotConfigured(body.message ?? 'AI features are not set up yet.');
      } else if (body?.error === 'tutor_disabled_by_parent') {
        setError('The AI tutor is turned off — ask a parent to enable it in AI settings.');
      } else {
        setError(body?.message ?? body?.error ?? 'Could not reach the tutor');
      }
    },
  });

  return (
    <div className={kidsStyle ? 'rounded-2xl border-2 border-sky-200 bg-white p-4' : 'rounded border border-slate-200 bg-white p-3 text-sm'}>
      <p className={kidsStyle ? 'mb-3 text-lg font-semibold text-slate-800' : 'mb-2 font-medium text-slate-700'}>🤖 Ask the tutor</p>

      {messages.length > 0 && (
        <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <span className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-left ${m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                {m.role === 'user' ? m.content : <RichContent content={m.content} className="[&>p]:m-0" />}
              </span>
            </div>
          ))}
        </div>
      )}

      {notConfigured && <p className="mb-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">{notConfigured}</p>}
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {(lessonId || studyGuideVersionId) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={send.isPending}
              onClick={() => send.mutate(action.message)}
              className={
                kidsStyle
                  ? 'rounded-full border border-sky-300 bg-white px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50'
                  : 'rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50'
              }
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) send.mutate(input.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this topic…"
          aria-label="Message to the tutor"
          required
          className={kidsStyle ? 'flex-1 rounded-full border border-slate-300 px-4 py-2 text-base' : 'flex-1 rounded border border-slate-300 px-3 py-1.5'}
        />
        <button
          type="submit"
          disabled={send.isPending}
          className={kidsStyle ? 'rounded-full bg-sky-500 px-5 py-2 font-semibold text-white hover:bg-sky-600 disabled:opacity-50' : 'rounded bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700 disabled:opacity-50'}
        >
          {send.isPending ? '…' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
