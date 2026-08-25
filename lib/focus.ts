import { useEffect, useRef, useState, type RefObject } from 'react';
import type { FlatList } from 'react-native';
import { create } from 'zustand';

/**
 * 「打開某個清單並把某一列指出來」的唯一傳遞管道。
 *
 * 通知（站內清單與推播）落地時不會另外疊一個新畫面，而是切到對應的分頁，
 * 再由那一頁自己捲到相關的那一列並短暫高亮。用 store 而不是路由參數，是因為
 * 分頁畫面會留在記憶體裡：同一個分頁重複導覽時參數不一定會變，store 的 nonce
 * 每次都會變，所以第二次點同一則通知也會再捲一次。
 */
export type FocusKey = 'seller-orders' | 'seller-products' | 'seller-messages' | 'buyer-messages';

type FocusRequest = { token: string; nonce: number };

type FocusState = {
  requests: Partial<Record<FocusKey, FocusRequest>>;
  request: (key: FocusKey, token: string) => void;
  consume: (key: FocusKey) => void;
};

let sequence = 0;

const useFocusStore = create<FocusState>((set) => ({
  requests: {},
  request: (key, token) =>
    set((state) => ({ requests: { ...state.requests, [key]: { token, nonce: ++sequence } } })),
  consume: (key) =>
    set((state) => {
      if (!state.requests[key]) return state;
      const next = { ...state.requests };
      delete next[key];
      return { requests: next };
    }),
}));

/** 導覽之前呼叫：目標畫面掛好（或切回焦點）後就會處理。 */
export function requestFocus(key: FocusKey, token: string) {
  useFocusStore.getState().request(key, token);
}

type Options<T> = {
  key: FocusKey;
  listRef: RefObject<FlatList<T> | null>;
  /** 目前畫面上真正在顯示的資料（已套用篩選），用來算捲動的位置。 */
  items: T[];
  /** 這一列是不是通知指的那一筆。訂單可能用編號比對，其他多半是 id。 */
  matches: (item: T, token: string) => boolean;
  /** 在捲動之前跑：清掉會讓目標列被藏起來的篩選條件。 */
  onRequest?: (token: string) => void;
  /** 高亮持續時間（毫秒）。 */
  duration?: number;
};

/**
 * 消化一筆 focus 請求：清篩選 → 捲到那一列 → 短暫高亮 → 自己淡出。
 * 回傳目前要高亮的 token（比對方式與 `matches` 相同）。
 */
export function useFocusHighlight<T>({
  key,
  listRef,
  items,
  matches,
  onRequest,
  duration = 3200,
}: Options<T>): string | null {
  const request = useFocusStore((state) => state.requests[key] ?? null);
  const consume = useFocusStore((state) => state.consume);
  const [highlight, setHighlight] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);

  // 請求可能在畫面掛載之前就進來（冷啟動點推播），所以 handler 用 ref 保存，
  // 第一次 effect 就拿得到最新的一份。
  const onRequestRef = useRef(onRequest);
  onRequestRef.current = onRequest;
  const matchesRef = useRef(matches);
  matchesRef.current = matches;

  useEffect(() => {
    if (!request) return;
    onRequestRef.current?.(request.token);
    pendingRef.current = request.token;
    setHighlight(request.token);
    consume(key);
  }, [request, key, consume]);

  // 清掉篩選後資料才會出現，所以捲動等到目標列真的在 items 裡才做。
  useEffect(() => {
    const token = pendingRef.current;
    if (!token) return;
    const index = items.findIndex((item) => matchesRef.current(item, token));
    if (index < 0) return;
    pendingRef.current = null;
    // 讓這一輪的列表先畫完再捲；這裡刻意不在 cleanup 清掉 timer，
    // 否則資料一重新整理（輪詢）就會把還沒觸發的捲動取消掉。
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.12, animated: true });
    }, 150);
  }, [items, highlight, listRef]);

  useEffect(() => {
    if (!highlight) return undefined;
    const timer = setTimeout(() => setHighlight(null), duration);
    return () => clearTimeout(timer);
  }, [highlight, duration]);

  return highlight;
}

/**
 * FlatList 沒有 getItemLayout 時 scrollToIndex 可能失敗（目標還沒被渲染），
 * 用平均列高估一個位置補上。三個清單共用同一份行為。
 */
export function scrollToIndexFallback<T>(
  listRef: RefObject<FlatList<T> | null>,
  info: { index: number; averageItemLength: number },
) {
  listRef.current?.scrollToOffset({
    offset: Math.max(0, info.averageItemLength * info.index),
    animated: true,
  });
}
