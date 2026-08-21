import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt } from '@/lib/backend';
import type { AppSettings } from '@/lib/types';

const DEFAULTS: AppSettings = {
  id: 'default',
  maintenance_enabled: false,
  maintenance_title: '系統維護中',
  maintenance_message: '極貨網正在進行系統維護與資料更新，請稍後再回來。',
  maintenance_started_at: null,
  announcement_enabled: false,
  announcement_message: '',
  min_supported_version: null,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

/**
 * Platform-wide switches (maintenance mode, announcement banner).
 *
 * Readable by everyone including signed-out visitors, so the gate can render
 * before a session exists. A failed read must never lock users out: the query
 * falls back to "everything open" instead of throwing.
 */
export function useAppSettings() {
  return useQuery({
    queryKey: ['system', 'app-settings'],
    // Maintenance can be flipped while the app is open, so keep this fresher
    // than the global default and re-check whenever the app regains focus.
    staleTime: 30_000,
    refetchInterval: 120_000,
    retry: 2,
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await bilt
        .from('app_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();
      if (error) return DEFAULTS;
      return (data as AppSettings | null) ?? DEFAULTS;
    },
  });
}

export function useSaveAppSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AppSettings>) => {
      const { data, error } = await bilt
        .from('app_settings')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', 'default')
        .select('*')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('沒有權限更新系統設定');
      return data as AppSettings;
    },
    onSuccess: (data) => {
      qc.setQueryData(['system', 'app-settings'], data);
      void qc.invalidateQueries({ queryKey: ['system'] });
    },
  });
}
