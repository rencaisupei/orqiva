import AsyncStorage from '@react-native-async-storage/async-storage';

import { localDateKey } from '@/lib/launchAd';

const STORAGE_KEY = 'jihuowang:daily-once:v1';

/**
 * 「這件事今天做過了嗎」的本機旗標，用來擋掉同一天的重複請求（例如 J幣簽到提醒）。
 *
 * 只是省流量用的，不是權威來源：真正的去重在伺服器端（查當天有沒有同一則通知），
 * 所以換裝置、清資料或重裝 App 都不會讓使用者被通知兩次。
 */
async function readLog(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export async function doneToday(key: string): Promise<boolean> {
  const log = await readLog();
  return log[key] === localDateKey();
}

export async function markDoneToday(key: string): Promise<void> {
  try {
    const today = localDateKey();
    const log = await readLog();
    const next: Record<string, string> = { [key]: today };
    // 只留今天的紀錄，昨天以前的自然過期。
    for (const [existing, date] of Object.entries(log)) {
      if (date === today) next[existing] = date;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 寫入失敗最多就是同一天多送一次請求，伺服器端仍會擋掉重複通知。
  }
}
