import { Platform, Pressable, type ViewStyle } from 'react-native';
import { Typography } from 'heroui-native';

/**
 * Selectable pill used for tab bars, filters and single/multi choice rows.
 *
 * Deliberately built on a plain React Native `Pressable` (the same pattern as
 * the sign-in mode switcher) instead of HeroUI's `Chip`: `Chip` renders its own
 * internal Pressable, and selection rows built from it kept reading as dead
 * taps. Anything the user is supposed to pick should use this component; keep
 * `Chip` for read-only status badges.
 */
export function SelectPill({
  label,
  selected = false,
  disabled = false,
  size = 'md',
  onPress,
  className,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  onPress: () => void;
  className?: string;
}) {
  const padding = size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2';
  const textType = size === 'sm' ? 'body-xs' : 'body-sm';
  // Web needs an explicit pointer cursor; native gets a slightly bigger touch target.
  const cursor: ViewStyle | null =
    Platform.OS === 'web' && !disabled ? { cursor: 'pointer' } : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [cursor, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}
      className={`flex-row items-center justify-center rounded-full border ${padding} ${
        selected ? 'bg-navy border-navy' : 'bg-background border-border'
      } ${className ?? ''}`}
    >
      <Typography
        type={textType}
        numberOfLines={1}
        className={selected ? 'text-white' : 'text-navy'}
        style={{ fontWeight: '600' }}
      >
        {label}
      </Typography>
    </Pressable>
  );
}
