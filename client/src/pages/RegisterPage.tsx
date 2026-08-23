import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiErrorBody } from '../lib/api';
import { useTranslation } from '../i18n';

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/onboarding');
    } catch (err) {
      setError(apiErrorBody(err)?.error ?? 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold text-slate-900">{t('register.title')}</h1>
        {error && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="register-name" className="block text-sm font-medium text-slate-700">
            {t('register.name')}
          </label>
          <input
            id="register-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="register-email" className="block text-sm font-medium text-slate-700">
            {t('register.email')}
          </label>
          <input
            id="register-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="register-password" className="block text-sm font-medium text-slate-700">
            {t('register.password')}
          </label>
          <input
            id="register-password"
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
          disabled={submitting}
          className="w-full rounded bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? t('register.submitting') : t('register.submit')}
        </button>
        <p className="text-center text-sm text-slate-600">
          {t('register.haveAccount')}{' '}
          <Link to="/login" className="text-brand-600 hover:underline">
            {t('register.login')}
          </Link>
        </p>
      </form>
    </div>
  );
}
