import { Platform, Pressable, View, type ViewStyle } from 'react-native';
import { Typography } from 'heroui-native';

export type Segment<T extends string> = { key: T; label: string };

export type SegmentedControlProps<T extends string> = {
  items: Segment<T>[];
  value: T;
  onChange: (key: T) => void;
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * iOS-style segmented control: every option shares one tinted track and the
 * selected one lifts onto a white pill.
 *
 * Built on a plain `Pressable` for the same reason as `SelectPill` — HeroUI's
 * pressable primitives kept swallowing taps in selection rows.
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const height = size === 'sm' ? 'py-1.5' : 'py-2';

  return (
    <View className={`bg-surface-secondary flex-row rounded-xl p-1 ${className ?? ''}`}>
      {items.map((item) => {
        const active = item.key === value;
        const style: ViewStyle = {
          ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
          ...(active
            ? {
                shadowColor: 'rgba(8, 38, 107, 0.16)',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 1,
                shadowRadius: 3,
                elevation: 2,
              }
            : null),
        };

        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            style={style}
            className={`flex-1 items-center justify-center rounded-lg px-1 ${height} ${
              active ? 'bg-surface' : ''
            }`}
          >
            <Typography
              type={size === 'sm' ? 'body-xs' : 'body-sm'}
              numberOfLines={1}
              className={active ? 'text-navy' : 'text-muted'}
              style={{ fontWeight: active ? '700' : '500' }}
            >
              {item.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}
