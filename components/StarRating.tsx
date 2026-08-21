import { View } from 'react-native';
import { Typography } from 'heroui-native';
import { Star } from 'lucide-react-native';

import { BRAND } from '@/lib/brand';
import { formatCompact } from '@/lib/format';

type Props = {
  rating: number;
  count?: number | null;
  size?: number;
  showCount?: boolean;
};

export function StarRating({ rating, count, size = 12, showCount = true }: Props) {
  const value = Number(rating ?? 0);
  return (
    <View className="flex-row items-center gap-1">
      <Star size={size} color={BRAND.yellow} fill={BRAND.yellow} />
      <Typography type="body-xs" className="text-navy" style={{ fontWeight: '600' }}>
        {value > 0 ? value.toFixed(1) : '—'}
      </Typography>
      {showCount && typeof count === 'number' ? (
        <Typography type="body-xs" color="muted">
          ({formatCompact(count)})
        </Typography>
      ) : null}
    </View>
  );
}
