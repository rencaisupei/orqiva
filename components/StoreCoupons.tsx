import { Platform, Pressable, View } from 'react-native';
import { Typography, useToast } from 'heroui-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, TicketPercent } from 'lucide-react-native';

import { useStoreCoupons } from '@/lib/api/coupons';
import { BRAND } from '@/lib/brand';
import { couponConditions, couponHeadline } from '@/lib/format';
import { couponCoversProduct, type Coupon } from '@/lib/types';

type Props = {
  storeId: string | null | undefined;
  /** 商品頁傳入：只顯示適用於這件商品的券。 */
  productId?: string;
  title?: string;
};

/**
 * 店舖目前可用的優惠券（商品頁與店舖頁共用）。
 *
 * 券碼可以直接複製，結帳頁貼上即可 —— 不做「領取」動作，所以買家不需要多記一份
 * 我的優惠券清單，賣家也不必管理領取名單。沒有可用券時整塊不顯示。
 */
export function StoreCoupons({ storeId, productId, title = '店舖優惠券' }: Props) {
  const { toast } = useToast();
  const { data: coupons } = useStoreCoupons(storeId);

  const usable = (coupons ?? []).filter(
    (coupon) => !productId || couponCoversProduct(coupon, productId),
  );
  if (usable.length === 0) return null;

  const copy = async (coupon: Coupon) => {
    try {
      await Clipboard.setStringAsync(coupon.code);
      toast.show({ variant: 'success', label: `已複製折扣碼 ${coupon.code}` });
    } catch {
      toast.show({ variant: 'danger', label: '複製失敗，請手動輸入折扣碼' });
    }
  };

  return (
    <View className="bg-surface mt-3 gap-3 p-4">
      <View className="flex-row items-center gap-2">
        <TicketPercent size={16} color={BRAND.orange} />
        <Typography type="body" className="text-navy flex-1" style={{ fontWeight: '600' }}>
          {title}
        </Typography>
        <Typography type="body-xs" color="muted">
          結帳輸入即折抵
        </Typography>
      </View>

      {usable.map((coupon) => (
        <View
          key={coupon.id}
          className="border-border bg-background flex-row items-center gap-3 rounded-2xl border p-3"
        >
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Typography
                type="body-sm"
                className="text-brand-orange"
                style={{ fontWeight: '700' }}
              >
                {couponHeadline(coupon)}
              </Typography>
              {coupon.title ? (
                <Typography type="body-xs" color="muted" numberOfLines={1} className="flex-1">
                  {coupon.title}
                </Typography>
              ) : null}
            </View>
            <Typography type="body-xs" color="muted" className="mt-0.5 leading-5">
              {couponConditions(coupon).join('・')}
            </Typography>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`複製折扣碼 ${coupon.code}`}
            hitSlop={6}
            onPress={() => void copy(coupon)}
            className="bg-brand-blue-soft shrink-0 flex-row items-center gap-1.5 rounded-full px-3 py-2"
            style={Platform.OS === 'web' ? { cursor: 'pointer' } : undefined}
          >
            <Typography type="body-xs" className="text-brand-blue" style={{ fontWeight: '700' }}>
              {coupon.code}
            </Typography>
            <Copy size={13} color={BRAND.blue} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
