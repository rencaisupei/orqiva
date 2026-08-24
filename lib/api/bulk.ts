import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt } from '@/lib/backend';
import type { BulkTier } from '@/lib/types';
import { sortBulkTiers } from '@/lib/types';

/**
 * 階梯式批量折扣的讀寫。金額計算一律用 lib/types.ts 的 bulkDiscountFor，
 * 真正寫進訂單的金額由 market edge function 重算（同一份規則）。
 */

/** 單一商品的階梯，商品頁與賣家編輯頁用。 */
export function useProductBulkTiers(productId: string | null | undefined) {
  return useQuery({
    enabled: !!productId,
    staleTime: 60_000,
    queryKey: ['bulk-tiers', 'product', productId],
    queryFn: async (): Promise<BulkTier[]> => {
      const { data, error } = await bilt
        .from('product_bulk_tiers')
        .select('id, product_id, min_quantity, percent')
        .eq('product_id', productId!)
        .returns<BulkTier[]>();
      if (error) throw new Error(error.message);
      return sortBulkTiers(data ?? []);
    },
  });
}

/**
 * 一次查多個商品的階梯（購物車／結帳用）。回傳 Map 讓呼叫端 O(1) 取用；
 * queryKey 用排序後的 id 串，避免同一組商品因順序不同重打查詢。
 */
export function useBulkTiers(productIds: string[]) {
  const ids = [...new Set(productIds.filter(Boolean))].sort();
  return useQuery({
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryKey: ['bulk-tiers', 'list', ids.join(',')],
    queryFn: async (): Promise<Map<string, BulkTier[]>> => {
      const { data, error } = await bilt
        .from('product_bulk_tiers')
        .select('id, product_id, min_quantity, percent')
        .in('product_id', ids)
        .returns<BulkTier[]>();
      if (error) throw new Error(error.message);
      const map = new Map<string, BulkTier[]>();
      for (const tier of data ?? []) {
        if (!tier.product_id) continue;
        map.set(tier.product_id, [...(map.get(tier.product_id) ?? []), tier]);
      }
      for (const [key, list] of map) map.set(key, sortBulkTiers(list));
      return map;
    },
  });
}

/** 整組覆蓋：先刪掉這個商品現有的階梯再寫入新的，避免逐筆 diff。 */
export function useSaveBulkTiers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { productId: string; tiers: BulkTier[] }) => {
      const { error: delError } = await bilt
        .from('product_bulk_tiers')
        .delete()
        .eq('product_id', input.productId);
      if (delError) throw new Error(delError.message);
      if (input.tiers.length === 0) return;
      const { error } = await bilt.from('product_bulk_tiers').insert(
        input.tiers.map((tier) => ({
          product_id: input.productId,
          min_quantity: tier.min_quantity,
          percent: tier.percent,
        })),
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bulk-tiers'] });
    },
  });
}
