import { useQuery } from '@tanstack/react-query';

import type { RecommendationResult } from '@/lib/api/contracts';
import { callRecommend } from '@/lib/backend';

/** 排序在 queryKey 裡，換順序不算換一組種子（伺服器的快取鍵也是排序後的）。 */
function seedKey(ids: string[]): string {
  return [...ids].sort().join(',');
}

/**
 * 商品頁的「猜你喜歡」。伺服器拿當前商品當種子，用模型從同分類與熱門商品裡挑，
 * 結果快取數小時，所以同一件商品的多位買家共用同一份推薦。
 */
export function useSimilarProducts(productId: string | undefined, limit = 10) {
  return useQuery({
    enabled: !!productId,
    queryKey: ['recommend', 'similar', productId, limit],
    queryFn: (): Promise<RecommendationResult> => callRecommend('similar', { productId, limit }),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * 「為你推薦」。種子是這台裝置最近看過的商品；登入時伺服器會再加上購物車與收藏。
 * 完全沒有種子（新使用者）時回熱門商品，不會開天窗。
 */
export function useForYouProducts(seedIds: string[], limit = 10, enabled = true) {
  const key = seedKey(seedIds);
  return useQuery({
    enabled,
    queryKey: ['recommend', 'for-you', key, limit],
    queryFn: (): Promise<RecommendationResult> =>
      callRecommend('for_you', { productIds: seedIds.slice(0, 8), limit }),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
