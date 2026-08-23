import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../i18n';

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4">
            <Link to="/dashboard" className="font-semibold text-slate-900">
              {t('app.name')}
            </Link>
            <Link to="/children" className="text-sm text-slate-600 hover:text-brand-600">
              {t('nav.children')}
            </Link>
            <Link to="/tasks" className="text-sm text-slate-600 hover:text-brand-600">
              Tasks
            </Link>
            <Link to="/curricula" className="text-sm text-slate-600 hover:text-brand-600">
              Curricula
            </Link>
            <Link to="/kids-mode/settings" className="text-sm text-slate-600 hover:text-brand-600">
              {t('nav.kidsMode')}
            </Link>
          </nav>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            {user && (
              <Link to="/profile" className="hover:text-brand-600">
                {user.name}
              </Link>
            )}
            <button onClick={handleLogout} className="text-brand-600 hover:underline">
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
