/**
 * Web-only dropdown built on the browser's own `<select>` element.
 *
 * Exists as a guaranteed-working control for the web admin console: it is
 * handled by the browser itself, so it keeps working even when a React Native
 * touch/press path does not. The native build renders nothing (the admin
 * console is web-only anyway) — see `NativeSelect.web.tsx` for the real thing.
 */
export function NativeSelect(_props: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onChange: (key: string) => void;
}) {
  return null;
}
