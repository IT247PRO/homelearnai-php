import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CheckSquare,
  Shield,
  User,
  Sparkles,
  LogOut,
  Menu,
  X,
  ChevronRight,
  GraduationCap,
  Play,
  Globe,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../i18n';
import { api } from '../lib/api';


interface Child {
  id: number;
  name: string;
  grade: string | null;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const { data: childrenData } = useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Child[] }>('/children');
      return data.data;
    },
    enabled: !!user,
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const { data } = await api.get<{ data: { children: Array<{ unacknowledgedInsightCount: number; pendingRecommendationCount: number }> } }>('/dashboard');
      return data.data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const totalAlerts = dashboardData?.children?.reduce(
    (sum, c) => sum + (c.unacknowledgedInsightCount || 0) + (c.pendingRecommendationCount || 0),
    0
  ) ?? 0;

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  // Derive breadcrumbs based on route
  const getBreadcrumbs = () => {
    const path = location.pathname;
    const crumbs = [{ label: 'Home', to: '/dashboard' }];

    if (path === '/dashboard') {
      return [{ label: 'Pages', to: '/dashboard' }, { label: 'Dashboard', to: '/dashboard' }];
    }
    if (path === '/children') {
      return [{ label: 'Pages', to: '/dashboard' }, { label: t('nav.children'), to: '/children' }];
    }
    if (path.startsWith('/children/')) {
      const parts = path.split('/');
      const childId = Number(parts[2]);
      const childName = childrenData?.find((c) => c.id === childId)?.name ?? `Child #${childId}`;
      crumbs.push({ label: 'Children', to: '/children' });
      crumbs.push({ label: childName, to: `/children/${childId}` });

      if (parts[3] === 'planning') crumbs.push({ label: 'Planning Board', to: path });
      else if (parts[3] === 'calendar') crumbs.push({ label: 'Schedule & Calendar', to: path });
      else if (parts[3] === 'review') crumbs.push({ label: 'Flashcard Review', to: path });
      else if (parts[3] === 'ai') crumbs.push({ label: 'AI Generator', to: path });
      return crumbs;
    }
    if (path.startsWith('/curricula')) {
      crumbs.push({ label: 'Curricula Library', to: '/curricula' });
      if (path.includes('/new')) crumbs.push({ label: 'Import New', to: path });
      else if (path.includes('/outline')) crumbs.push({ label: 'Outline & Decomposition', to: path });
      return crumbs;
    }
    if (path === '/tasks') {
      return [{ label: 'Pages', to: '/dashboard' }, { label: 'Tasks', to: '/tasks' }];
    }
    if (path === '/kids-mode/settings') {
      return [{ label: 'Settings', to: '/profile' }, { label: 'Kids Mode PIN & Safety', to: path }];
    }
    if (path === '/profile') {
      return [{ label: 'Settings', to: '/profile' }, { label: 'Parent Account & Preferences', to: path }];
    }
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();
  const currentTitle = breadcrumbs[breadcrumbs.length - 1]?.label ?? 'Overview';

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      active: location.pathname === '/dashboard',
      gradient: 'from-purple-700 to-pink-500',
    },
    {
      to: '/children',
      label: t('nav.children'),
      icon: Users,
      active: location.pathname === '/children' || (location.pathname.startsWith('/children/') && !location.pathname.includes('/ai')),
      gradient: 'from-blue-600 to-cyan-400',
    },
    {
      to: '/curricula',
      label: 'Curricula Library',
      icon: BookOpen,
      active: location.pathname.startsWith('/curricula'),
      gradient: 'from-emerald-500 to-teal-400',
    },
    {
      to: '/tasks',
      label: 'Tasks & To-Dos',
      icon: CheckSquare,
      active: location.pathname === '/tasks',
      gradient: 'from-orange-500 to-yellow-400',
    },
  ];

  const secondaryNavItems = [
    {
      to: '/kids-mode/settings',
      label: t('nav.kidsMode') + ' Security',
      icon: Shield,
      active: location.pathname === '/kids-mode/settings',
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      to: '/profile',
      label: 'Profile & Settings',
      icon: User,
      active: location.pathname === '/profile',
      gradient: 'from-slate-700 to-slate-900',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm xl:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidenav Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 my-4 ml-4 w-64 flex-col justify-between rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-soft-xl backdrop-blur-xl transition-all duration-300 xl:flex ${
          mobileMenuOpen ? 'flex translate-x-0' : '-translate-x-full xl:translate-x-0'
        }`}
      >
        <div className="flex flex-col">
          {/* Sidenav Brand Header */}
          <div className="flex items-center justify-between px-2 py-3">
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-md">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-800 tracking-tight">HomeLearnAI</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600">
                  Homeschool Hub
                </span>
              </div>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 xl:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="my-3 border-t border-slate-100" />

          {/* Main Navigation */}
          <div className="space-y-1">
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Navigation
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                    item.active
                      ? 'bg-white text-slate-800 shadow-soft-md'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                      item.active
                        ? `bg-gradient-to-tl ${item.gradient} text-white shadow-soft-md`
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Quick Learners Access */}
          {childrenData && childrenData.length > 0 && (
            <div className="mt-4 space-y-1">
              <div className="flex items-center justify-between px-3 py-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Active Learners
                </p>
                <Link to="/children" className="text-[10px] font-semibold text-purple-600 hover:underline">
                  All ({childrenData.length})
                </Link>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {childrenData.map((c) => {
                  const isChildActive = location.pathname.startsWith(`/children/${c.id}`);
                  return (
                    <Link
                      key={c.id}
                      to={`/children/${c.id}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all ${
                        isChildActive
                          ? 'bg-purple-50/80 font-bold text-purple-800'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-slate-200 text-[10px] font-bold text-slate-700">
                          {c.name.charAt(0)}
                        </div>
                        <span className="truncate max-w-[110px]">{c.name}</span>
                      </div>
                      {c.grade && <span className="text-[10px] text-slate-400">Gr {c.grade}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Settings Section */}
          <div className="mt-4 space-y-1">
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Settings & Portal
            </p>
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                    item.active
                      ? 'bg-white text-slate-800 shadow-soft-md'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                      item.active
                        ? `bg-gradient-to-tl ${item.gradient} text-white shadow-soft-md`
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Sidenav Bottom Card */}
        <div className="mt-4 rounded-2xl bg-gradient-to-tl from-slate-900 to-slate-800 p-4 text-white shadow-soft-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-amber-300 backdrop-blur-sm">
              <Play className="h-3.5 w-3.5 fill-current" />
            </div>
            <span className="text-xs font-bold tracking-tight">Kids Mode Player</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug mb-3">
            Distraction-free learning interface with voice tutor & interactive player.
          </p>
          <Link
            to="/kids"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-soft-sm transition-all hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Open Kids Portal</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </aside>

      {/* Main Content Area with Top Floating Navbar */}
      <div className="xl:ml-72 min-h-screen px-3 sm:px-6 pt-3 pb-12 transition-all">
        {/* Top Navbar */}
        <header className="sticky top-3 z-30 mb-6 flex items-center justify-between rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-soft-sm backdrop-blur-md sm:px-6">
          {/* Breadcrumb info */}
          <div className="flex flex-col">
            <nav className="flex items-center space-x-1 text-xs text-slate-400">
              {breadcrumbs.map((crumb, idx) => (
                <div key={crumb.to + idx} className="flex items-center space-x-1">
                  {idx > 0 && <span className="text-slate-300">/</span>}
                  <Link
                    to={crumb.to}
                    className={`transition-colors hover:text-slate-700 ${
                      idx === breadcrumbs.length - 1 ? 'font-semibold text-slate-700' : ''
                    }`}
                  >
                    {crumb.label}
                  </Link>
                </div>
              ))}
            </nav>
            <h1 className="text-base font-bold text-slate-800 capitalize sm:text-lg">
              {currentTitle}
            </h1>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Language Switcher Pill */}
            <div className="relative">
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-soft-xs hover:bg-slate-50"
              >
                <Globe className="h-3.5 w-3.5 text-purple-600" />
                <span className="uppercase">{locale}</span>
              </button>
              {langMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-40 w-28 rounded-xl border border-slate-100 bg-white py-1 shadow-soft-xl">
                  <button
                    onClick={() => {
                      setLocale('en');
                      setLangMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-xs ${
                      locale === 'en' ? 'font-bold text-purple-600 bg-purple-50' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>English</span>
                    {locale === 'en' && <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />}
                  </button>
                  <button
                    onClick={() => {
                      setLocale('es');
                      setLangMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-xs ${
                      locale === 'es' ? 'font-bold text-purple-600 bg-purple-50' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Español</span>
                    {locale === 'es' && <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />}
                  </button>
                </div>
              )}
            </div>

            {/* AI Insights Notification Pill */}
            {totalAlerts > 0 && (
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 rounded-xl bg-purple-50 border border-purple-200/60 px-2.5 py-1.5 text-xs font-bold text-purple-700 shadow-soft-xs hover:bg-purple-100 transition-colors"
                title={`${totalAlerts} unread insights / recommendations`}
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-600 animate-pulse" />
                <span className="hidden sm:inline">{totalAlerts} Insights</span>
                <span className="sm:hidden">{totalAlerts}</span>
              </Link>
            )}

            {/* User Profile Button */}
            {user && (
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-soft-xs hover:bg-slate-50 transition-colors"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-gradient-to-tl from-purple-700 to-pink-500 text-[10px] font-bold text-white shadow-soft-xs">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="hidden md:inline max-w-[100px] truncate">{user.name}</span>
              </Link>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-soft-xs hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
              title={t('nav.logout')}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('nav.logout')}</span>
            </button>

            {/* Mobile menu hamburger toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-soft-xs hover:bg-slate-50 xl:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="w-full">{children}</main>
      </div>
    </div>
  );
}
