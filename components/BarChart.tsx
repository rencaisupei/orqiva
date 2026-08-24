import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Typography } from 'heroui-native';

import { BRAND } from '@/lib/brand';

export type BarPoint = { key: string; label: string; value: number };

type Props = {
  points: BarPoint[];
  /** 長條顏色（預設品牌藍）。 */
  color?: string;
  /** 數值格式（金額用 formatPrice，件數用 formatNumber）。 */
  formatValue: (value: number) => string;
  height?: number;
};

/**
 * 純 React Native 畫的長條圖（沒有引入圖表套件）。
 *
 * 一次可能有 30 根長條，全部標日期會擠成一團，所以底部標籤只挑幾根顯示；
 * 點任一根會在圖表上方顯示那一段的完整標籤與數值，資料不會因為省略標籤而看不到。
 */
export function BarChart({ points, color = BRAND.blue, formatValue, height = 128 }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const max = Math.max(1, ...points.map((point) => point.value));
  const active = points.find((point) => point.key === selected) ?? points[points.length - 1];
  /* 標籤密度：長條越多就跳越多根，讓文字不重疊。 */
  const step = Math.max(1, Math.ceil(points.length / 6));

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline gap-2">
        <Typography type="body-sm" className="text-navy" style={{ fontWeight: '700' }}>
          {active ? formatValue(active.value) : formatValue(0)}
        </Typography>
        <Typography type="body-xs" color="muted">
          {active ? active.label : ''}
          {selected ? '' : '（最新）'}
        </Typography>
      </View>

      <View className="flex-row items-end gap-1" style={{ height }}>
        {points.map((point) => {
          const isActive = active?.key === point.key;
          return (
            <Pressable
              key={point.key}
              accessibilityRole="button"
              accessibilityLabel={`${point.label} ${formatValue(point.value)}`}
              className="flex-1 justify-end"
              style={{
                height: '100%',
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
              }}
              onPress={() => setSelected(point.key)}
            >
              <View
                className="w-full rounded-t-md"
                style={{
                  height: Math.max(3, (point.value / max) * (height - 8)),
                  backgroundColor: point.value > 0 ? color : BRAND.border,
                  opacity: isActive || point.value === 0 ? 1 : 0.75,
                }}
              />
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row gap-1">
        {points.map((point, i) => (
          <View key={point.key} className="flex-1 items-center">
            {i % step === 0 || i === points.length - 1 ? (
              <Typography type="body-xs" color="muted" numberOfLines={1}>
                {point.label}
              </Typography>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
