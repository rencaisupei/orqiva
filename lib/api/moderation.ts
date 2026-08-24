import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt, callModeration } from '@/lib/backend';
import { useAppSettings } from '@/lib/api/system';
import type {
  AppSettings,
  MessageFlag,
  MessageScanResult,
  ModerationReview,
  ModerationVerdict,
  Product,
} from '@/lib/types';

export type QueueProduct = Product & {
  store: { id: string; name: string } | null;
};

/** Admin: everything the AI did not clear on its own. */
export function useModerationQueue(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['moderation', 'queue'],
    queryFn: async (): Promise<QueueProduct[]> => {
      const { data, error } = await bilt
        .from('products')
        .select('*, store:stores(id, name)')
        .neq('moderation_status', 'approved')
        .order('moderation_risk', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 60_000,
  });
}

export function useModerationQueueCount(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['moderation', 'queue-count'],
    queryFn: async (): Promise<number> => {
      const { count, error } = await bilt
        .from('products')
        .select('id', { count: 'exact', head: true })
        .neq('moderation_status', 'approved');
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
}

/** Admin: chat messages the risk scan flagged. */
export function useMessageFlags(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['moderation', 'message-flags'],
    queryFn: async (): Promise<MessageFlag[]> => {
      const { data, error } = await bilt
        .from('message_flags')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(100)
        .returns<MessageFlag[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/** The audit trail for one product — sellers see their own, admins see all. */
export function useModerationHistory(targetId: string | undefined) {
  return useQuery({
    enabled: !!targetId,
    queryKey: ['moderation', 'history', targetId],
    queryFn: async (): Promise<ModerationReview[]> => {
      const { data, error } = await bilt
        .from('moderation_reviews')
        .select('*')
        .eq('target_id', targetId!)
        .order('created_at', { ascending: false })
        .returns<ModerationReview[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

function invalidateModeration(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['moderation'] });
  void qc.invalidateQueries({ queryKey: ['seller-products'] });
  void qc.invalidateQueries({ queryKey: ['products'] });
  void qc.invalidateQueries({ queryKey: ['admin'] });
  void qc.invalidateQueries({ queryKey: ['notifications'] });
}

/** Runs the AI check on a product (used on publish, edit and re-submission). */
export function useModerateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => callModeration('moderate_product', { productId }),
    onSuccess: () => invalidateModeration(qc),
  });
}

/** Admin override on a queued product. */
export function useAdminDecideProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; verdict: ModerationVerdict; note?: string }) =>
      callModeration('admin_decide', input),
    onSuccess: () => invalidateModeration(qc),
  });
}

export function useResolveMessageFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { flagId: string; status: 'reviewed' | 'dismissed' }) =>
      callModeration('resolve_flag', input),
    onSuccess: () => invalidateModeration(qc),
  });
}

/** AI grading for a report: severity + summary + suggested action. */
export function useTriageReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) => callModeration('triage_report', { reportId }),
    onSuccess: () => invalidateModeration(qc),
  });
}

export type { MessageScanResult };

/* ── 自動審核（AI 自己處理明顯的案子，人只看灰色地帶） ─────── */

/** 下一次自動巡邏到期的時間；沒跑過就是「現在」。 */
function autoReviewDueAt(settings: AppSettings): number {
  if (!settings.auto_review_last_run_at) return 0;
  const last = Date.parse(settings.auto_review_last_run_at);
  if (Number.isNaN(last)) return 0;
  return last + Math.max(1, settings.auto_review_interval_hours) * 3_600_000;
}

export function isAutoReviewDue(settings: AppSettings, now = Date.now()): boolean {
  return settings.auto_review_enabled && now >= autoReviewDueAt(settings);
}

/**
 * 自動審核的觸發器（與自動清理同一套做法）。
 *
 * bilt-cloud 沒有資料庫排程，所以到期判斷放在人人都讀得到的 app_settings 上：
 * 只有真的到期時 App 才會呼叫一次，其他時候一個請求都不會發。函式本身還會再檢查
 * 一次到期與併發鎖，所以多台裝置同時到期也只有一個會真的執行。
 */
export function useAutoModeration() {
  const { data } = useAppSettings();
  const qc = useQueryClient();
  const fired = useRef(false);

  useEffect(() => {
    if (!data || fired.current) return;
    if (!isAutoReviewDue(data)) return;
    fired.current = true;
    callModeration('auto_review')
      .then((result) => {
        if (result.ran) {
          void qc.invalidateQueries({ queryKey: ['moderation'] });
          void qc.invalidateQueries({ queryKey: ['system'] });
          void qc.invalidateQueries({ queryKey: ['products'] });
        }
      })
      .catch(() => {
        // 自動巡邏失敗不影響使用者；下一次到期或管理員手動執行時會再試。
      });
  }, [data, qc]);
}

/** Admin: 自動審核的設定、待處理筆數與最近幾次執行紀錄。 */
export function useAutoReviewStatus(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['moderation', 'auto-status'],
    staleTime: 30_000,
    queryFn: () => callModeration('auto_status'),
  });
}

/** Admin: 立刻跑一次自動審核（忽略間隔）。 */
export function useRunAutoReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callModeration('auto_review', { force: true }),
    onSuccess: () => {
      invalidateModeration(qc);
      void qc.invalidateQueries({ queryKey: ['system'] });
    },
  });
}
