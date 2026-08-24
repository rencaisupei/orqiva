import { View } from 'react-native';
import { Typography } from 'heroui-native';
import { Star } from 'lucide-react-native';

import { BRAND } from '@/lib/brand';

type Props = {
  /** 一到五星各有幾筆（index 0 = 一星），與 `ratingBreakdown()` 的回傳一致。 */
  buckets: number[];
  className?: string;
};

/**
 * 星等分佈長條。商品頁的評價區與賣家分析頁共用同一份畫法，
 * 所以「幾顆星有幾筆」在兩邊看起來一模一樣。
 */
export function RatingBreakdown({ buckets, className }: Props) {
  const total = buckets.reduce((sum, count) => sum + count, 0);

  return (
    <View className={className}>
      {[5, 4, 3, 2, 1].map((star) => {
        const count = buckets[star - 1] ?? 0;
        const ratio = total > 0 ? count / total : 0;
        return (
          <View key={star} className="flex-row items-center gap-2 py-0.5">
            <View className="w-8 flex-row items-center gap-0.5">
              <Typography type="body-xs" className="text-navy">
                {star}
              </Typography>
              <Star size={10} color={BRAND.yellow} fill={BRAND.yellow} />
            </View>
            <View className="bg-surface-secondary h-1.5 flex-1 overflow-hidden rounded-full">
              <View
                className="bg-brand-yellow h-full rounded-full"
                style={{ width: `${Math.round(ratio * 100)}%` }}
              />
            </View>
            <Typography type="body-xs" color="muted" className="w-7 text-right">
              {count}
            </Typography>
          </View>
        );
      })}
    </View>
  );
}
