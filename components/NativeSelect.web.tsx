import { BRAND } from '@/lib/brand';

/** Browser-native `<select>`; see NativeSelect.tsx for why this exists. */
export function NativeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onChange: (key: string) => void;
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'inherit',
        fontSize: 13,
        color: BRAND.muted,
      }}
    >
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          appearance: 'auto',
          borderRadius: 8,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: BRAND.border,
          backgroundColor: BRAND.white,
          color: BRAND.navy,
          padding: '6px 10px',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
