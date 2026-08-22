import { BRAND } from '@/lib/brand';

export type Segment<T extends string> = { key: T; label: string };

export type SegmentedControlProps<T extends string> = {
  items: Segment<T>[];
  value: T;
  onChange: (key: T) => void;
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * Web build of `SegmentedControl` — real DOM buttons, so a click never depends
 * on react-native-web's responder system. Same props as the native file.
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  size = 'md',
}: SegmentedControlProps<T>) {
  const small = size === 'sm';

  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 2,
        padding: 4,
        borderRadius: 12,
        backgroundColor: '#EEF1F6',
        boxSizing: 'border-box',
      }}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            style={{
              appearance: 'none',
              flex: 1,
              minWidth: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              margin: 0,
              border: 'none',
              borderRadius: 8,
              backgroundColor: active ? BRAND.white : 'transparent',
              boxShadow: active ? '0 1px 3px rgba(8, 38, 107, 0.16)' : 'none',
              color: active ? BRAND.navy : BRAND.muted,
              padding: small ? '6px 4px' : '8px 6px',
              fontFamily: 'inherit',
              fontSize: small ? 12 : 14,
              fontWeight: active ? 700 : 500,
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              cursor: 'pointer',
              transition: 'background-color 150ms ease, color 150ms ease',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
