function withThousands(value: number): string {
  const [int, frac] = Math.abs(value)
    .toFixed(value % 1 === 0 ? 0 : 2)
    .split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = value < 0 ? '-' : '';
  return frac ? `${sign}${grouped}.${frac}` : `${sign}${grouped}`;
}

export function formatPrice(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  return `NT$${withThousands(Number.isFinite(n) ? n : 0)}`;
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  return withThousands(Number.isFinite(n) ? n : 0);
}

export function formatCompact(value: number | null | undefined): string {
  const n = value ?? 0;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}萬`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function discountPercent(price: number, originalPrice: number | null): number | null {
  if (!originalPrice || originalPrice <= price) return null;
  return Math.round((1 - price / originalPrice) * 100);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** `YYYY-MM-DD HH:mm` in the device's own timezone — the format the admin console types. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Parses `YYYY-MM-DD HH:mm` (also tolerates `YYYY/MM/DD` and a `T` separator) as
 * LOCAL time and returns an ISO string, or null when the text is not a valid moment.
 */
export function parseLocalInput(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  if (!text) return null;
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?$/.exec(text);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h ?? '0'),
    Number(mi ?? '0'),
    0,
    0,
  );
  if (Number.isNaN(date.getTime())) return null;
  if (date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) return null;
  return date.toISOString();
}

/** "3 天 2 小時" / "45 分鐘" — used for maintenance countdowns. */
export function durationUntil(iso: string | null | undefined, from = Date.now()): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - from;
  if (!Number.isFinite(diff) || diff <= 0) return '即將';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) return restMinutes ? `${hours} 小時 ${restMinutes} 分鐘` : `${hours} 小時`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} 天 ${restHours} 小時` : `${days} 天`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return formatDate(iso);
}

/** Rough delivery window shown on the product page, derived from the shipping method. */
export function deliveryEstimate(shippingMethod: string): string {
  if (shippingMethod === '面交') return '與賣家約定時間地點';
  if (shippingMethod === '超商取貨') return '付款後 2-4 個工作日到店';
  return '付款後 1-3 個工作日到貨';
}
