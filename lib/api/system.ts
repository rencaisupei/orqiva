import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt, callMaintenance } from '@/lib/backend';
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
  cleanup_enabled: true,
  cleanup_interval_hours: 12,
  cleanup_notification_days: 30,
  cleanup_history_days: 180,
  cleanup_last_run_at: null,
  cleanup_running_since: null,
  cleanup_last_total: 0,
  auto_review_enabled: true,
  auto_review_interval_hours: 6,
  auto_approve_max_risk: 20,
  auto_reject_min_risk: 90,
  auto_review_last_run_at: null,
  auto_review_running_since: null,
  auto_review_last_total: 0,
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
        .returns<AppSettings[]>()
        .maybeSingle();
      if (error) return DEFAULTS;
      return data ?? DEFAULTS;
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
        .returns<AppSettings[]>()
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('沒有權限更新系統設定');
      return data;
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

/* ── 自動清理（減少伺服器與 App 負擔） ───────────────────────── */

/** 下一次清理到期的時間；沒跑過就是「現在」。 */
function cleanupDueAt(settings: AppSettings): number {
  if (!settings.cleanup_last_run_at) return 0;
  const last = Date.parse(settings.cleanup_last_run_at);
  if (Number.isNaN(last)) return 0;
  return last + Math.max(1, settings.cleanup_interval_hours) * 3_600_000;
}

export function isCleanupDue(settings: AppSettings, now = Date.now()): boolean {
  return settings.cleanup_enabled && now >= cleanupDueAt(settings);
}

/**
 * 定期清理的觸發器。
 *
 * bilt-cloud 沒有資料庫排程，所以到期判斷放在公開可讀的 app_settings 上：
 * App 只有在「真的到期」時才會呼叫一次維護函式，其他時候一次請求都不會發出。
 * 函式本身還有一道到期檢查與併發鎖，所以多台裝置同時到期也只會執行一次。
 */
export function useAutoCleanup() {
  const { data } = useAppSettings();
  const qc = useQueryClient();
  const fired = useRef(false);

  useEffect(() => {
    if (!data || fired.current) return;
    if (!isCleanupDue(data)) return;
    fired.current = true;
    callMaintenance('run_cleanup')
      .then((result) => {
        if (result.ran) void qc.invalidateQueries({ queryKey: ['system'] });
      })
      .catch(() => {
        // 清理失敗不影響使用者；下一次啟動或管理員手動執行時會再試。
      });
  }, [data, qc]);
}

/** Admin only: 目前設定、上次執行結果與可清理筆數。 */
export function useMaintenanceStatus(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['system', 'maintenance-status'],
    staleTime: 30_000,
    queryFn: () => callMaintenance('status'),
  });
}

/** Admin only: 立刻執行一次清理（忽略間隔）。 */
export function useRunCleanup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input?: { force?: boolean }) =>
      callMaintenance('run_cleanup', { force: input?.force ?? true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['system'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
