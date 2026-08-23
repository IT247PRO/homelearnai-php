import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

  return (
    <AppLayout>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Kids Mode Settings</h1>

      <div className="mb-6 rounded border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          Status:{' '}
          <span className="font-medium">
            {settingsQuery.data?.hasPinSetup ? 'PIN configured' : 'No PIN set up yet'}
          </span>
          {settingsQuery.data?.isLocked && <span className="ml-2 text-red-600">Locked due to failed attempts</span>}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSuccess(false);
          setPinMutation.mutate();
        }}
        className="mb-4 space-y-3 rounded border border-slate-200 bg-white p-4"
      >
        <label className="block text-sm font-medium text-slate-700">
          {settingsQuery.data?.hasPinSetup ? 'Change PIN (4-6 digits)' : 'Set up a PIN (4-6 digits)'}
        </label>
        <input
          type="password"
          inputMode="numeric"
          pattern="\d{4,6}"
          required
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-32 rounded border border-slate-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">PIN saved.</p>}
        <button type="submit" className="rounded bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
          Save PIN
        </button>
      </form>

      {settingsQuery.data?.hasPinSetup && (
        <button
          onClick={() => resetPinMutation.mutate()}
          className="text-sm text-red-600 hover:underline"
        >
          Remove PIN (disables Kids Mode entry until a new PIN is set)
        </button>
      )}
    </AppLayout>
  );
}
