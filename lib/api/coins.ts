import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CoinRedemption, CoinSummary, CoinTaskKey } from '@/lib/api/contracts';
import { bilt, callCoins } from '@/lib/backend';
import type {
  AdBannerPlacement,
  CoinRedemptionStatus,
  StoreBadgeKind,
  StorePromotion,
} from '@/lib/types';

/** J幣錢包 + 今日任務 + 明細。開這一頁時伺服器會順手補發被動獎勵。 */
export function useCoinSummary(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['coins', 'summary', userId],
    queryFn: (): Promise<CoinSummary> => callCoins('summary'),
    staleTime: 15_000,
  });
}

function invalidateCoins(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['coins'] });
  void qc.invalidateQueries({ queryKey: ['notifications'] });
}

export function useCoinCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callCoins('checkin'),
    onSuccess: () => invalidateCoins(qc),
  });
}

export function useClaimCoinTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task: CoinTaskKey) => callCoins('claim_task', { task }),
    onSuccess: () => invalidateCoins(qc),
  });
}

export type RedeemInput =
  | {
      kind: 'ad_slot';
      placement: AdBannerPlacement;
      days: number;
      title: string;
      subtitle: string;
      imageUrl: string;
      ctaLabel: string;
      productId: string | null;
    }
  | { kind: 'product_boost'; productId: string; days: number }
  | { kind: 'store_badge'; badgeKind: StoreBadgeKind };

export function useRedeemCoins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RedeemInput) => callCoins('redeem', { ...input }),
    onSuccess: () => {
      invalidateCoins(qc);
      // 置頂與徽章立刻生效，列表與店舖頁要跟著換。
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['store-promotion'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

/* ── 管理員：廣告版位兌換審核 ─────────────────────────────────── */

export function useAdminRedemptions(status: CoinRedemptionStatus | 'all', enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['coins', 'admin-redemptions', status],
    queryFn: () => callCoins('admin_redemptions', { status }),
  });
}

export function useReviewRedemption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; approve: boolean; note: string }) =>
      callCoins('review_redemption', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['coins'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'ad-banners'] });
    },
  });
}

/* ── 買家端：店舖徽章 ────────────────────────────────────────── */

/** 公開鏡像表，買家不用登入也讀得到；過期的徽章由伺服器收掉。 */
export function useStorePromotion(storeId: string | undefined) {
  return useQuery({
    enabled: !!storeId,
    queryKey: ['store-promotion', storeId],
    queryFn: async (): Promise<StorePromotion | null> => {
      const { data, error } = await bilt
        .from('store_promotions')
        .select('store_id, badge_kind, badge_expires_at')
        .eq('store_id', storeId!)
        .returns<StorePromotion[]>()
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      if (data.badge_kind === 'none') return null;
      if (data.badge_expires_at && new Date(data.badge_expires_at).getTime() < Date.now()) {
        return null;
      }
      return data;
    },
    staleTime: 60_000,
  });
}

/** 賣家自己的推廣紀錄，用來在商品管理列出「哪些商品正在置頂」。 */
export function activeBoostEnds(redemptions: CoinRedemption[]): Map<string, string> {
  const map = new Map<string, string>();
  const now = Date.now();
  for (const row of redemptions) {
    if (row.kind !== 'product_boost' || !row.productId || !row.endsAt) continue;
    if (new Date(row.endsAt).getTime() < now) continue;
    const current = map.get(row.productId);
    if (!current || new Date(current).getTime() < new Date(row.endsAt).getTime()) {
      map.set(row.productId, row.endsAt);
    }
  }
  return map;
}
