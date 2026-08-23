import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Account</h1>

      <div className="space-y-6">
        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-medium text-slate-900">General</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setGeneralSaved(false);
              saveGeneral.mutate();
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="profile-name" className="block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                id="profile-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="profile-email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Changing your email will require re-verifying it.</p>
            </div>
            {generalError && <p className="text-sm text-red-600">{generalError}</p>}
            {generalSaved && <p className="text-sm text-emerald-600">Saved.</p>}
            <button type="submit" disabled={saveGeneral.isPending} className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
              Save
            </button>
          </form>
        </section>

        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-medium text-slate-900">Preferences</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPrefsSaved(false);
              savePreferences.mutate();
            }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div>
              <label htmlFor="pref-timezone" className="block text-sm font-medium text-slate-700">
                Timezone
              </label>
              <select
                id="pref-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pref-region" className="block text-sm font-medium text-slate-700">
                Region format
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
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="us">US (12-hour, MM/DD/YYYY, Sunday start)</option>
                <option value="eu">EU (24-hour, DD.MM.YYYY, Monday start)</option>
              </select>
            </div>
            <p className="text-xs text-slate-500 sm:col-span-2">
              Preview — Date: <span className="font-mono">{dateFormatType === 'eu' ? '22.08.2026' : '08/22/2026'}</span>, Time:{' '}
              <span className="font-mono">{timeFormat === '24h' ? '14:30' : '2:30 PM'}</span>, Week starts{' '}
              <span className="font-medium">{weekStart === 'monday' ? 'Monday' : 'Sunday'}</span>.
            </p>
            {prefsSaved && <p className="text-sm text-emerald-600 sm:col-span-2">Saved.</p>}
            <div className="sm:col-span-2">
              <button type="submit" disabled={savePreferences.isPending} className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
                Save preferences
              </button>
            </div>
          </form>
        </section>

        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-medium text-slate-900">Security</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPasswordSaved(false);
              changePassword.mutate();
            }}
            className="max-w-sm space-y-3"
          >
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium text-slate-700">
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
            {passwordSaved && <p className="text-sm text-emerald-600">Password updated.</p>}
            <button type="submit" disabled={changePassword.isPending} className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
              Update password
            </button>
          </form>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-medium text-red-700">Danger zone</h3>
            <p className="mt-1 text-sm text-slate-500">Deleting your account permanently removes all children, subjects, and history.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                  deleteAccount.mutate();
                }
              }}
              className="mt-3 flex max-w-sm items-end gap-2"
            >
              <div className="flex-1">
                <label htmlFor="delete-password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="delete-password"
                  type="password"
                  required
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button type="submit" disabled={deleteAccount.isPending} className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50">
                Delete account
              </button>
            </form>
            {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
