import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt } from '@/lib/backend';
import type { AppSettings } from '@/lib/types';

const DEFAULTS: AppSettings = {
  id: 'default',
  maintenance_enabled: false,
  maintenance_title: '系統維護中',
  maintenance_message: '極貨網正在進行系統維護與資料更新，請稍後再回來。',
  maintenance_started_at: null,
  maintenance_schedule_enabled: false,
  maintenance_starts_at: null,
  maintenance_ends_at: null,
  maintenance_notice_minutes: 60,
  announcement_enabled: false,
  announcement_message: '',
  min_supported_version: null,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

export const MAINTENANCE_FALLBACK_TITLE = DEFAULTS.maintenance_title;
export const MAINTENANCE_FALLBACK_MESSAGE = DEFAULTS.maintenance_message;

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

/** Local clock that only ticks while a scheduled window still has a boundary ahead. */
function useNow(enabled: boolean, intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
  return now;
}

export type MaintenanceState = {
  /** True while users should be blocked — manual switch OR inside the scheduled window. */
  active: boolean;
  source: 'manual' | 'schedule' | null;
  title: string;
  message: string;
  scheduleEnabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** Scheduled window that has not started yet but is inside the notice period. */
  upcoming: boolean;
  /** Scheduled window whose end time has already passed (maintenance lifted itself). */
  finished: boolean;
  noticeMinutes: number;
  now: number;
};

/**
 * Resolves the *effective* maintenance state.
 *
 * A scheduled window needs no server job: the window is evaluated against the
 * device clock on every tick, so maintenance starts and lifts itself on time
 * even if no admin is around. The manual switch always wins.
 */
export function useMaintenanceState(): MaintenanceState {
  const { data } = useAppSettings();
  const settings = data ?? DEFAULTS;

  const startsAt = settings.maintenance_starts_at ?? null;
  const endsAt = settings.maintenance_ends_at ?? null;
  const start = startsAt ? new Date(startsAt).getTime() : null;
  const end = endsAt ? new Date(endsAt).getTime() : null;
  const scheduleEnabled =
    settings.maintenance_schedule_enabled && start !== null && !Number.isNaN(start);

  // Keep ticking while any boundary is still ahead of us; stop once nothing can change.
  const pending = scheduleEnabled && (end === null || Date.now() < end);
  const now = useNow(pending);

  const inWindow = scheduleEnabled && start !== null && now >= start && (end === null || now < end);
  const manual = settings.maintenance_enabled;

  const noticeMinutes = Math.max(0, settings.maintenance_notice_minutes ?? 60);

  return {
    active: manual || inWindow,
    source: manual ? 'manual' : inWindow ? 'schedule' : null,
    title: settings.maintenance_title?.trim() || MAINTENANCE_FALLBACK_TITLE,
    message: settings.maintenance_message?.trim() || MAINTENANCE_FALLBACK_MESSAGE,
    scheduleEnabled,
    startsAt,
    endsAt,
    upcoming:
      scheduleEnabled &&
      !manual &&
      !inWindow &&
      start !== null &&
      now < start &&
      start - now <= noticeMinutes * 60_000,
    finished: scheduleEnabled && end !== null && now >= end,
    noticeMinutes,
    now,
  };
}
