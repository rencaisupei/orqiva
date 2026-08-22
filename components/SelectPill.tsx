import { Platform, Pressable, type ViewStyle } from 'react-native';
import { Typography } from 'heroui-native';

/** Visual weight: `solid` = filled navy (tab bars, pickers), `soft` = chip-style filter. */
export type SelectPillTone = 'solid' | 'soft';

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
  tone = 'solid',
  onPress,
  className,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  tone?: SelectPillTone;
  onPress: () => void;
  className?: string;
}) {
  const padding = size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2';
  const textType = size === 'sm' ? 'body-xs' : 'body-sm';
  const soft = tone === 'soft';

  const container = selected
    ? soft
      ? 'bg-brand-blue-soft border-brand-blue'
      : 'bg-navy border-navy'
    : 'bg-background border-border';
  const text = selected ? (soft ? 'text-brand-blue' : 'text-white') : 'text-navy';

  // Plain object, never a `style={({ pressed }) => …}` callback: a function style
  // stops composing once Uniwind merges `className` into the same prop, which is
  // the one difference this component had from the sign-in switcher that works.
  const style: ViewStyle = {
    ...(Platform.OS === 'web' && !disabled ? { cursor: 'pointer' } : null),
    ...(disabled ? { opacity: 0.45 } : null),
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={style}
      className={`flex-row items-center justify-center rounded-full border ${padding} ${container} ${
        className ?? ''
      }`}
    >
      <Typography type={textType} numberOfLines={1} className={text} style={{ fontWeight: '600' }}>
        {label}
      </Typography>
    </Pressable>
  );
}
