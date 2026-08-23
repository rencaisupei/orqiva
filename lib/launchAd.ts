import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 開啟 App 的彈出廣告：每一支廣告一天最多跳一次。
 *
 * 紀錄存在手機本機（不上傳），格式是 { 廣告key: 'YYYY-MM-DD' }，寫入時會順手
 * 清掉不是今天的紀錄，所以這份資料永遠只有幾筆。
 */
const STORAGE_KEY = 'jihuowang:launch-ad:v1';

export type LaunchAdLog = Record<string, string>;

/** 以裝置當地時區計算日期（台灣是 UTC+8，用 UTC 日期會提早換日）。 */
export function localDateKey(date = new Date()): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export async function loadLaunchAdLog(): Promise<LaunchAdLog> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: LaunchAdLog = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export async function markLaunchAdShown(key: string): Promise<void> {
  try {
    const today = localDateKey();
    const log = await loadLaunchAdLog();
    const next: LaunchAdLog = { [key]: today };
    // 只留今天的紀錄，昨天以前的自然過期。
    for (const [existing, date] of Object.entries(log)) {
      if (date === today) next[existing] = date;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 寫入失敗最多就是同一天多跳一次，不需要打斷使用者。
  }
}

export function shownToday(log: LaunchAdLog, key: string): boolean {
  return log[key] === localDateKey();
}
