import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, apiErrorBody } from '../lib/api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      await api.post('/auth/reset-password', { token, password });
    },
    onSuccess: () => navigate('/login'),
    onError: (err) => setError(apiErrorBody(err)?.error ?? 'That link is invalid or has expired.'),
  });

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
        <div>
          <p className="mb-2 text-slate-700">This reset link is missing its token.</p>
          <Link to="/forgot-password" className="text-brand-600 hover:underline">
            Request a new one
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow"
      >
        <h1 className="text-xl font-semibold text-slate-900">Choose a new password</h1>
        {error && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={submit.isPending}
          className="w-full rounded bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submit.isPending ? 'Saving…' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}
