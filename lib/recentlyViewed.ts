import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'jihuowang.recently-viewed.v1';
const LIMIT = 20;

type RecentlyViewedState = {
  /** Product ids, most recently opened first. */
  ids: string[];
  hydrated: boolean;
  track: (productId: string) => void;
  clear: () => void;
};

/** Recently opened products, kept on the device only (no server write, no account needed). */
export const useRecentlyViewedStore = create<RecentlyViewedState>((set, get) => ({
  ids: [],
  hydrated: false,
  track: (productId) => {
    if (!productId) return;
    const current = get().ids;
    if (current[0] === productId) return;
    const next = [productId, ...current.filter((id) => id !== productId)].slice(0, LIMIT);
    set({ ids: next });
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },
  clear: () => {
    set({ ids: [] });
    void AsyncStorage.removeItem(STORAGE_KEY);
  },
}));

/*
 * Hydrated once at import so any screen can read the list without wiring a
 * provider. Ids tracked before the read finishes stay in front of the stored
 * ones instead of being overwritten.
 */
void (async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const stored = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
    const pending = useRecentlyViewedStore.getState().ids;
    const merged = [...pending, ...stored.filter((id) => !pending.includes(id))].slice(0, LIMIT);
    useRecentlyViewedStore.setState({ ids: merged, hydrated: true });
  } catch {
    useRecentlyViewedStore.setState({ hydrated: true });
  }
})();
