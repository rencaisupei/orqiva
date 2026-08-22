import { BRAND } from '@/lib/brand';

/** Visual weight: `solid` = filled navy (tab bars, pickers), `soft` = chip-style filter. */
export type SelectPillTone = 'solid' | 'soft';

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
  tone = 'solid',
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  tone?: SelectPillTone;
  onPress: () => void;
  className?: string;
}) {
  const small = size === 'sm';
  const soft = tone === 'soft';

  const border = selected ? (soft ? BRAND.blue : BRAND.navy) : BRAND.border;
  const background = selected ? (soft ? BRAND.blueSoft : BRAND.navy) : BRAND.background;
  const color = selected ? (soft ? BRAND.blue : BRAND.white) : BRAND.navy;

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
        borderColor: border,
        backgroundColor: background,
        color,
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
