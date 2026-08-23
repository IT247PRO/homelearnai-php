import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiErrorBody } from '../lib/api';
import { useTranslation } from '../i18n';

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(user.onboardingCompleted || user.onboardingSkipped ? '/dashboard' : '/onboarding');
    } catch (err) {
      setError(apiErrorBody(err)?.error ?? 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold text-slate-900">{t('login.title')}</h1>
        {error && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">
            {t('login.email')}
          </label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
            {t('login.password')}
          </label>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
          <Link to="/forgot-password" className="mt-1 inline-block text-xs text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? t('login.submitting') : t('login.submit')}
        </button>
        <p className="text-center text-sm text-slate-600">
          {t('login.noAccount')}{' '}
          <Link to="/register" className="text-brand-600 hover:underline">
            {t('login.register')}
          </Link>
        </p>
      </form>
    </div>
  );
}
