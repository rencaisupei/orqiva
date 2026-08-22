import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt, callModeration } from '@/lib/backend';
import type {
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
