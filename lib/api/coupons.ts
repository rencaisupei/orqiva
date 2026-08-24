import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt, callMarket } from '@/lib/backend';
import type { CouponPreview } from '@/lib/api/contracts';
import { isCouponLive, normalizeCouponCode, type Coupon, type CouponKind } from '@/lib/types';

/**
 * 賣家優惠券。
 *
 * 建立、停用與刪除都走 RLS（`coupons_seller_all`：只有店鋪擁有者動得了自己的券），
 * 但「這張券在這筆訂單折多少」一律由 market 邊緣函式判斷 —— App 只顯示伺服器算好的
 * 金額，避免前端算一套、下單又算另一套。
 */

/** 賣家自己的券（含停用與過期，供管理頁使用）。 */
export function useMyCoupons(storeId: string | null) {
  return useQuery({
    enabled: !!storeId,
    queryKey: ['coupons', 'mine', storeId],
    queryFn: async (): Promise<Coupon[]> => {
      const { data, error } = await bilt
        .from('coupons')
        .select('*')
        .eq('store_id', storeId!)
        .order('created_at', { ascending: false })
        .returns<Coupon[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/**
 * 某間店鋪目前可用的券。RLS 的 select 政策已經把停用／未開始／過期／用完的擋掉，
 * 這裡再用 isCouponLive 過一次（避免裝置時間與伺服器時間差造成的邊界誤差）。
 */
export function useStoreCoupons(storeId: string | null | undefined) {
  return useQuery({
    enabled: !!storeId,
    staleTime: 60_000,
    queryKey: ['coupons', 'store', storeId],
    queryFn: async (): Promise<Coupon[]> => {
      const { data, error } = await bilt
        .from('coupons')
        .select('*')
        .eq('store_id', storeId!)
        .order('min_spend', { ascending: true })
        .returns<Coupon[]>();
      if (error) throw new Error(error.message);
      return (data ?? []).filter((coupon) => isCouponLive(coupon));
    },
  });
}

export type CouponDraft = {
  code: string;
  title: string;
  kind: CouponKind;
  value: number;
  maxDiscount: number | null;
  minSpend: number;
  usageLimit: number | null;
  perUserLimit: number | null;
  productIds: string[];
  endsAt: string | null;
};

function invalidateCoupons(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['coupons'] });
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; storeId: string; draft: CouponDraft }) => {
      const { draft } = input;
      const { error } = await bilt.from('coupons').insert({
        store_id: input.storeId,
        seller_id: input.userId,
        code: normalizeCouponCode(draft.code),
        title: draft.title.trim(),
        kind: draft.kind,
        value: draft.kind === 'free_shipping' ? 0 : draft.value,
        max_discount: draft.kind === 'percent' ? draft.maxDiscount : null,
        min_spend: draft.minSpend,
        usage_limit: draft.usageLimit,
        per_user_limit: draft.perUserLimit,
        product_ids: draft.productIds,
        ends_at: draft.endsAt,
      });
      if (error) {
        throw new Error(
          error.code === '23505' ? '這個折扣碼已經有人使用，請換一組代碼。' : error.message,
        );
      }
    },
    onSuccess: () => invalidateCoupons(qc),
  });
}

export function useSetCouponActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) => {
      const { error } = await bilt
        .from('coupons')
        .update({ is_active: input.isActive, updated_at: new Date().toISOString() })
        .eq('id', input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateCoupons(qc),
  });
}

export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await bilt.from('coupons').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateCoupons(qc),
  });
}

export type CouponPreviewInput = {
  code: string;
  items: { product_id: string; quantity: number }[];
  shippingFee: number;
};

/** 結帳頁按「套用」時的試算：不寫任何資料，錯誤訊息直接顯示給買家。 */
export function usePreviewCoupon() {
  return useMutation({
    mutationFn: async (input: CouponPreviewInput): Promise<CouponPreview> =>
      await callMarket('preview_coupon', {
        code: normalizeCouponCode(input.code),
        items: input.items,
        shipping_fee: input.shippingFee,
      }),
  });
}
