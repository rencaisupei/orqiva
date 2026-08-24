import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Typography } from 'heroui-native';
import { TicketPercent, X } from 'lucide-react-native';

import { FormError } from '@/components/FormError';
import type { CouponPreview } from '@/lib/api/contracts';
import { usePreviewCoupon } from '@/lib/api/coupons';
import { BRAND } from '@/lib/brand';
import { couponHeadline } from '@/lib/format';
import { formatPrice } from '@/lib/format';
import { normalizeCouponCode } from '@/lib/types';

type Props = {
  items: { product_id: string; quantity: number }[];
  shippingFee: number;
  applied: CouponPreview | null;
  onApplied: (coupon: CouponPreview | null) => void;
  /** 顯示折扣落在哪一間店舖的訂單上（跨店結帳時買家會想知道）。 */
  storeName?: (storeId: string) => string | undefined;
};

/**
 * 結帳頁的折扣碼欄位。
 *
 * 金額一律由 market 邊緣函式試算（preview_coupon），送出訂單時同一份邏輯會再算一次，
 * 所以這裡顯示的折抵金額就是實際會寫進訂單的金額。購物車內容變了就自動取消套用，
 * 避免拿舊的試算結果去結帳。
 */
export function CouponInput({ items, shippingFee, applied, onApplied, storeName }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const preview = usePreviewCoupon();

  const signature = items.map((item) => `${item.product_id}:${item.quantity}`).join('|');
  const lastSignature = useRef(signature);

  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    if (applied) {
      onApplied(null);
      setError('購物車內容有變動，請重新套用折扣碼。');
    }
  }, [signature, applied, onApplied]);

  const apply = () => {
    const normalized = normalizeCouponCode(code);
    if (normalized.length < 4) {
      setError('請輸入 4~20 碼的折扣碼。');
      return;
    }
    setError(null);
    preview.mutate(
      { code: normalized, items, shippingFee },
      {
        onSuccess: (result) => {
          onApplied(result);
          setCode('');
        },
        onError: (err: Error) => {
          onApplied(null);
          setError(err.message);
        },
      },
    );
  };

  const store = applied ? storeName?.(applied.store_id) : undefined;

  return (
    <View className="bg-surface gap-3 rounded-2xl p-4">
      <View className="flex-row items-center gap-2">
        <TicketPercent size={16} color={BRAND.orange} />
        <Typography type="body" className="text-navy flex-1" style={{ fontWeight: '600' }}>
          折扣碼
        </Typography>
      </View>

      {applied ? (
        <View className="border-border bg-background flex-row items-center gap-3 rounded-2xl border p-3">
          <View className="flex-1">
            <Typography type="body-sm" className="text-navy" style={{ fontWeight: '700' }}>
              {applied.code}・{couponHeadline(applied)}
            </Typography>
            <Typography type="body-xs" color="muted" className="mt-0.5">
              已折抵 {formatPrice(applied.discount)}
              {store ? `（${store}）` : ''}
            </Typography>
          </View>
          <Button variant="tertiary" size="sm" onPress={() => onApplied(null)}>
            <X size={14} color={BRAND.navy} />
            <Button.Label>移除</Button.Label>
          </Button>
        </View>
      ) : (
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Input
              placeholder="輸入賣家提供的折扣碼"
              autoCapitalize="characters"
              value={code}
              maxLength={20}
              onChangeText={(value) => {
                setCode(normalizeCouponCode(value));
                setError(null);
              }}
            />
          </View>
          <Button
            size="sm"
            isDisabled={preview.isPending || code.length === 0}
            onPress={apply}
            className="shrink-0"
          >
            <Button.Label>{preview.isPending ? '確認中…' : '套用'}</Button.Label>
          </Button>
        </View>
      )}

      {error ? <FormError message={error} /> : null}
    </View>
  );
}
