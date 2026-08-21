import { View } from 'react-native';
import { Typography } from 'heroui-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';

const UP = '#12A150';
const DOWN = '#DC2626';

type Props = {
  label: string;
  value: string;
  /** Percentage change vs yesterday; null hides the trend line. */
  delta?: number | null;
};

/** Compact metric tile used across the seller center. */
export function SellerStatTile({ label, value, delta = null }: Props) {
  const isUp = (delta ?? 0) >= 0;
  return (
    <View className="bg-brand-blue-soft/60 flex-1 gap-1 rounded-2xl px-3 py-3">
      <Typography type="body-xs" color="muted" numberOfLines={1}>
        {label}
      </Typography>
      <Typography type="h6" className="text-navy" numberOfLines={1} style={{ fontWeight: '700' }}>
        {value}
      </Typography>
      {delta === null ? (
        <Typography type="body-xs" color="muted" numberOfLines={1}>
          與昨日持平
        </Typography>
      ) : (
        <View className="flex-row items-center gap-1">
          {isUp ? <TrendingUp size={11} color={UP} /> : <TrendingDown size={11} color={DOWN} />}
          <Typography
            type="body-xs"
            numberOfLines={1}
            style={{ color: isUp ? UP : DOWN, fontWeight: '700' }}
          >
            {isUp ? '+' : ''}
            {delta}%
          </Typography>
        </View>
      )}
    </View>
  );
}
