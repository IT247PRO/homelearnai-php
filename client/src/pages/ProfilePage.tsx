import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { User, Settings2, Shield, AlertTriangle, Check } from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../hooks/useAuth';
import { api, apiErrorBody } from '../lib/api';


const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export default function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [generalSaved, setGeneralSaved] = useState(false);

  const [timezone, setTimezone] = useState(user?.timezone ?? 'UTC');
  const [regionFormat, setRegionFormat] = useState(user?.regionFormat ?? 'us');
  const [timeFormat, setTimeFormat] = useState(user?.timeFormat ?? '12h');
  const [weekStart, setWeekStart] = useState(user?.weekStart ?? 'sunday');
  const [dateFormatType, setDateFormatType] = useState(user?.dateFormatType ?? 'us');
  const [prefsSaved, setPrefsSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const invalidateMe = () => queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });

  const saveGeneral = useMutation({
    mutationFn: async () => {
      await api.patch('/auth/me', { name, email });
    },
    onSuccess: () => {
      setGeneralError(null);
      setGeneralSaved(true);
      invalidateMe();
    },
    onError: (err) => setGeneralError(apiErrorBody(err)?.error ?? 'Could not save changes'),
  });

  const savePreferences = useMutation({
    mutationFn: async () => {
      await api.patch('/auth/me', { timezone, regionFormat, timeFormat, weekStart, dateFormatType });
    },
    onSuccess: () => {
      setPrefsSaved(true);
      invalidateMe();
    },
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      await api.post('/auth/change-password', { currentPassword, newPassword });
    },
    onSuccess: () => {
      setPasswordError(null);
      setPasswordSaved(true);
      setCurrentPassword('');
      setNewPassword('');
    },
    onError: (err) => setPasswordError(apiErrorBody(err)?.error ?? 'Could not change password'),
  });

  const deleteAccount = useMutation({
    mutationFn: async () => {
      await api.delete('/auth/me', { data: { password: deletePassword } });
    },
    onSuccess: () => navigate('/login'),
    onError: (err) => setDeleteError(apiErrorBody(err)?.error ?? 'Could not delete account'),
  });

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Account & Preferences</h1>
        <p className="text-xs text-slate-400">
          Manage family account information, locale settings, calendar defaults, and security
        </p>
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* Profile Card */}
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 text-white shadow-soft-xs">
              <User className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">General Information</h2>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setGeneralSaved(false);
              saveGeneral.mutate();
            }}
            className="space-y-4 max-w-lg"
          >
            <div>
              <label htmlFor="profile-name" className="block text-xs font-bold text-slate-700">
                Full Name
              </label>
              <input
                id="profile-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
            <div>
              <label htmlFor="profile-email" className="block text-xs font-bold text-slate-700">
                Email Address
              </label>
              <input
                id="profile-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
              <p className="mt-1 text-[11px] text-slate-400">Changing your email will require re-verifying it.</p>
            </div>

            {generalError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{generalError}</span>
              </div>
            )}
            {generalSaved && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-700">
                <Check className="h-4 w-4 shrink-0" />
                <span>Account information saved.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saveGeneral.isPending}
              className="rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-5 py-2.5 text-xs font-bold text-white shadow-soft-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {saveGeneral.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </section>

        {/* Preferences & Locale Card */}
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tl from-blue-600 to-cyan-400 text-white shadow-soft-xs">
              <Settings2 className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Locale & Schedule Formatting</h2>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPrefsSaved(false);
              savePreferences.mutate();
            }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div>
              <label htmlFor="pref-timezone" className="block text-xs font-bold text-slate-700">
                Timezone
              </label>
              <select
                id="pref-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pref-region" className="block text-xs font-bold text-slate-700">
                Regional Format Preset
              </label>
              <select
                id="pref-region"
                value={regionFormat}
                onChange={(e) => {
                  const value = e.target.value;
                  setRegionFormat(value);
                  setTimeFormat(value === 'eu' ? '24h' : '12h');
                  setWeekStart(value === 'eu' ? 'monday' : 'sunday');
                  setDateFormatType(value);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="us">US (12-hour, MM/DD/YYYY, Sunday start)</option>
                <option value="eu">EU (24-hour, DD.MM.YYYY, Monday start)</option>
              </select>
            </div>

            <div className="rounded-xl bg-slate-50/70 p-3 sm:col-span-2 text-xs text-slate-500">
              <span className="font-bold text-slate-700">Display Preview:</span> Date:{' '}
              <span className="font-mono text-purple-600">{dateFormatType === 'eu' ? '22.08.2026' : '08/22/2026'}</span> · Time:{' '}
              <span className="font-mono text-purple-600">{timeFormat === '24h' ? '14:30' : '2:30 PM'}</span> · Week Starts:{' '}
              <span className="font-semibold text-slate-700">{weekStart === 'monday' ? 'Monday' : 'Sunday'}</span>.
            </div>

            {prefsSaved && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-700 sm:col-span-2">
                <Check className="h-4 w-4 shrink-0" />
                <span>Preferences updated successfully.</span>
              </div>
            )}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={savePreferences.isPending}
                className="rounded-xl bg-gradient-to-tl from-blue-600 to-cyan-400 px-5 py-2.5 text-xs font-bold text-white shadow-soft-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {savePreferences.isPending ? 'Saving…' : 'Save Preferences'}
              </button>
            </div>
          </form>
        </section>

        {/* Security & Password Card */}
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tl from-emerald-600 to-teal-400 text-white shadow-soft-xs">
              <Shield className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Security & Credentials</h2>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPasswordSaved(false);
              changePassword.mutate();
            }}
            className="max-w-md space-y-4"
          >
            <div>
              <label htmlFor="current-password" className="block text-xs font-bold text-slate-700">
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-xs font-bold text-slate-700">
                New Password (minimum 8 characters)
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            {passwordError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}
            {passwordSaved && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-700">
                <Check className="h-4 w-4 shrink-0" />
                <span>Password changed successfully.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={changePassword.isPending}
              className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-bold text-white shadow-soft-xs hover:bg-slate-900 disabled:opacity-50"
            >
              {changePassword.isPending ? 'Updating…' : 'Update Password'}
            </button>
          </form>

          {/* Danger Zone */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-600">Danger Zone</h3>
            <p className="mt-1 text-xs text-slate-400">
              Deleting your account permanently removes all children, subjects, learning logs, and progress.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to delete your account? This action is permanent.')) {
                  deleteAccount.mutate();
                }
              }}
              className="mt-3 flex max-w-md items-end gap-2"
            >
              <div className="flex-1">
                <label htmlFor="delete-password" className="block text-xs font-bold text-slate-700">
                  Confirm Password
                </label>
                <input
                  id="delete-password"
                  type="password"
                  required
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={deleteAccount.isPending}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Delete Account
              </button>
            </form>
            {deleteError && <p className="mt-2 text-xs text-red-600">{deleteError}</p>}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
