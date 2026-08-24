import { View } from 'react-native';
import { Typography } from 'heroui-native';
import { Layers } from 'lucide-react-native';

import { useProductBulkTiers } from '@/lib/api/bulk';
import { BRAND } from '@/lib/brand';
import { formatPrice } from '@/lib/format';
import { bulkDiscountFor, type BulkTier } from '@/lib/types';

type Props = { productId: string | undefined; price: number };

/** 商品頁的數量折扣表。沒有設定階梯時整塊不出現。 */
export function BulkTierInfo({ productId, price }: Props) {
  const { data: tiers } = useProductBulkTiers(productId);
  if (!tiers || tiers.length === 0) return null;

  const ascending: BulkTier[] = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);

  return (
    <View className="bg-surface mt-3 gap-2 p-4">
      <View className="flex-row items-center gap-2">
        <Layers size={16} color={BRAND.blue} />
        <Typography type="body" className="text-navy flex-1" style={{ fontWeight: '600' }}>
          數量折扣
        </Typography>
        <Typography type="body-xs" color="muted">
          購物車自動折抵
        </Typography>
      </View>

      {ascending.map((tier) => {
        const unit = Math.round((price * (100 - tier.percent)) / 100);
        return (
          <View
            key={`${tier.min_quantity}-${tier.percent}`}
            className="border-border bg-background flex-row items-center gap-3 rounded-2xl border p-3"
          >
            <Typography type="body-sm" className="text-navy" style={{ fontWeight: '700' }}>
              滿 {tier.min_quantity} 件
            </Typography>
            <Typography type="body-sm" className="text-brand-orange flex-1">
              折 {tier.percent}%
            </Typography>
            <View className="items-end">
              <Typography type="body-sm" className="text-navy">
                每件 {formatPrice(unit)}
              </Typography>
              <Typography type="body-xs" color="muted">
                省 {formatPrice(bulkDiscountFor(price, tier.min_quantity, [tier]))}
              </Typography>
            </View>
          </View>
        );
      })}
    </View>
  );
}
