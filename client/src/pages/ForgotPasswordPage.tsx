import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { note: string | null } }>('/auth/forgot-password', { email });
      return data.data;
    },
    onSuccess: (data) => setNote(data.note ?? 'If that email has an account, a reset link is on its way.'),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>

        {note ? (
          <p role="status" className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {note}
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={submit.isPending}
              className="w-full rounded bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {submit.isPending ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-slate-600">
          <Link to="/login" className="text-brand-600 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
