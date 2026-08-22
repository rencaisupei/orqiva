import { BRAND } from '@/lib/brand';

/**
 * Web build of `SelectPill`.
 *
 * Renders a real DOM `<button>` instead of a React Native `Pressable`, so a tap
 * never depends on react-native-web's responder system (which is what kept
 * reading as a dead tap in the admin console). Same props as the native file.
 */
export function SelectPill({
  label,
  selected = false,
  disabled = false,
  size = 'md',
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  onPress: () => void;
  className?: string;
}) {
  const small = size === 'sm';

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onPress()}
      style={{
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        margin: 0,
        borderRadius: 999,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: selected ? BRAND.navy : BRAND.border,
        backgroundColor: selected ? BRAND.navy : BRAND.background,
        color: selected ? BRAND.white : BRAND.navy,
        padding: small ? '6px 12px' : '8px 16px',
        fontFamily: 'inherit',
        fontSize: small ? 13 : 14,
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease',
      }}
    >
      {label}
    </button>
  );
}
