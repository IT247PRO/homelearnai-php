import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, ShieldCheck, KeyRound, AlertTriangle, Check } from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { api, apiErrorBody } from '../lib/api';

interface KidsModeSettings {
  hasPinSetup: boolean;
  isLocked: boolean;
  lockedUntil: string | null;
}

export default function KidsModeSettingsPage() {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['kids-mode-settings'],
    queryFn: async () => {
      const { data } = await api.get<{ data: KidsModeSettings }>('/kids-mode/settings');
      return data.data;
    },
  });

  const setPinMutation = useMutation({
    mutationFn: async () => {
      await api.post('/kids-mode/pin', { pin });
    },
    onSuccess: () => {
      setPin('');
      setSuccess(true);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['kids-mode-settings'] });
    },
    onError: (err) => setError(apiErrorBody(err)?.error ?? 'Could not set PIN'),
  });

  const resetPinMutation = useMutation({
    mutationFn: async () => {
      await api.post('/kids-mode/reset-pin');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kids-mode-settings'] }),
  });

  const hasPin = settingsQuery.data?.hasPinSetup;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Kids Mode & Parental Lock</h1>
        <p className="text-xs text-slate-400">
          Configure security PIN protection to prevent children from exiting Kids Mode into the parent portal
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Status Card */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-soft-xl">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-soft-sm ${
                hasPin
                  ? 'bg-gradient-to-tl from-emerald-600 to-teal-400'
                  : 'bg-gradient-to-tl from-amber-500 to-orange-400'
              }`}
            >
              {hasPin ? <ShieldCheck className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {hasPin ? 'Parental Lock Protected' : 'No PIN Configured'}
              </h3>
              <p className="text-xs text-slate-400">
                {hasPin
                  ? 'PIN is active. Required to exit Kids Mode.'
                  : 'Set a 4-6 digit numerical PIN below to secure parent settings.'}
              </p>
            </div>
          </div>

          <span
            className={`rounded-xl px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
              hasPin ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {hasPin ? 'Protected' : 'Unprotected'}
          </span>
        </div>

        {/* PIN Configuration Card */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft-xl">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-4 w-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-800">
              {hasPin ? 'Update Parental PIN' : 'Set Up Parental PIN'}
            </h2>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSuccess(false);
              setPinMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700">
                PIN Code (4-6 digits)
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="\d{4,6}"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="mt-1 w-48 rounded-xl border border-slate-200 p-2.5 text-center font-mono text-base tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                <Check className="h-4 w-4 shrink-0" />
                <span>Parental PIN successfully updated.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={setPinMutation.isPending}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-tl from-purple-700 to-pink-500 px-5 py-2.5 text-xs font-bold text-white shadow-soft-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <span>{setPinMutation.isPending ? 'Saving PIN…' : 'Save Parental PIN'}</span>
            </button>
          </form>

          {hasPin && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  if (confirm('Remove Parental PIN? Anyone in Kids Mode will be able to exit freely.')) {
                    resetPinMutation.mutate();
                  }
                }}
                className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline"
              >
                Remove PIN Protection
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
