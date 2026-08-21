import { Pressable, View } from 'react-native';
import { Typography } from 'heroui-native';
import { Minus, Plus } from 'lucide-react-native';

import { BRAND } from '@/lib/brand';

type Props = {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
};

export function QuantityStepper({ value, min = 1, max = 999, onChange }: Props) {
  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <View className="border-border bg-surface flex-row items-center overflow-hidden rounded-full border">
      <Pressable
        className="h-8 w-9 items-center justify-center"
        disabled={!canDecrease}
        onPress={() => onChange(Math.max(min, value - 1))}
        accessibilityLabel="減少數量"
      >
        <Minus size={16} color={canDecrease ? BRAND.navy : BRAND.border} />
      </Pressable>
      <Typography
        type="body-sm"
        className="text-navy min-w-8 text-center"
        style={{ fontWeight: '600' }}
      >
        {value}
      </Typography>
      <Pressable
        className="h-8 w-9 items-center justify-center"
        disabled={!canIncrease}
        onPress={() => onChange(Math.min(max, value + 1))}
        accessibilityLabel="增加數量"
      >
        <Plus size={16} color={canIncrease ? BRAND.navy : BRAND.border} />
      </Pressable>
    </View>
  );
}
