import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Typography } from 'heroui-native';
import { useBrandToast } from '@/components/brand/BrandToast';
import { useFocusEffect } from 'expo-router';
import { RefreshCw, Truck } from 'lucide-react-native';

import { SelectPill } from '@/components/SelectPill';
import { useSyncShipments } from '@/lib/api/logistics';
import { BRAND } from '@/lib/brand';
import {
  isAutoSyncableShipment,
  isCvsOrder,
  isTrackableShipment,
  SHIPMENT_STAGE_LABEL,
  shipmentStage,
  toLogisticsStatus,
  type Order,
  type ShipmentStage,
} from '@/lib/types';

export type ShipmentFilter = ShipmentStage | 'all';

/** 出貨狀態篩選：只對綠界超商取貨訂單有意義，宅配訂單沒有貨態。 */
export const SHIPMENT_FILTERS: { key: ShipmentFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'awaiting', label: SHIPMENT_STAGE_LABEL.awaiting },
  { key: 'created', label: SHIPMENT_STAGE_LABEL.created },
  { key: 'in_transit', label: SHIPMENT_STAGE_LABEL.in_transit },
  { key: 'arrived', label: SHIPMENT_STAGE_LABEL.arrived },
  { key: 'picked_up', label: SHIPMENT_STAGE_LABEL.picked_up },
  { key: 'issue', label: SHIPMENT_STAGE_LABEL.issue },
];

/** 選了具體出貨狀態時，宅配訂單一律排除（它們沒有貨態可以比對）。 */
export function matchesShipmentFilter(order: Order, filter: ShipmentFilter): boolean {
  if (filter === 'all') return true;
  if (!isCvsOrder(order)) return false;
  return shipmentStage(toLogisticsStatus(order.logistics_status)) === filter;
}

/** 貨態徽章顏色：異常紅、已取貨綠、其餘品牌藍。 */
export function shipmentChipColor(stage: ShipmentStage) {
  if (stage === 'issue') return 'danger';
  if (stage === 'picked_up') return 'success';
  return 'accent';
}

/*
 * 自動同步的節流表（模組層級，換頁不會重置）。出貨後綠界會主動回拋貨態到
 * ecpay-logistics-callback，這裡只是補上「使用者剛好在看這一頁」的情況：
 * 同一筆訂單十分鐘內最多主動查一次，避免每次進頁面都打綠界。
 */
const AUTO_SYNC_INTERVAL_MS = 10 * 60_000;
const lastAutoSyncAt = new Map<string, number>();

type Props = {
  orders: Order[];
  value: ShipmentFilter;
  onChange: (value: ShipmentFilter) => void;
  /** 標題文字：買家與賣家兩邊說法略有不同。 */
  title?: string;
  /**
   * 只畫這幾個階段的膠囊（'all' 一律留著）。省略 = 全部階段都畫。
   * 買家訂單列表用它把階段收斂成「這個分頁真的有的貨態」。
   */
  stages?: ShipmentStage[];
};

/**
 * 超商取貨的出貨狀態區塊：三欄對齊的狀態篩選（含筆數）＋自動／手動同步。
 *
 * 買家訂單列表與賣家中心訂單頁共用同一份邏輯。已出貨（拿到寄貨編號）且還在
 * 途中的訂單，在畫面取得焦點時會自動同步一次；手動按鈕仍保留，用來立刻更新
 * 全部在途訂單（含尚未回寄貨編號的 requested）。
 */
export function ShipmentStatusBar({ orders, value, onChange, title, stages }: Props) {
  const { toast } = useBrandToast();
  const { mutate: syncShipments, isPending } = useSyncShipments();
  const [autoSyncedAt, setAutoSyncedAt] = useState<number | null>(null);

  const cvsOrders = useMemo(() => orders.filter((order) => isCvsOrder(order)), [orders]);

  const counts = useMemo(() => {
    const map = new Map<ShipmentFilter, number>();
    map.set('all', orders.length);
    for (const order of cvsOrders) {
      const stage = shipmentStage(toLogisticsStatus(order.logistics_status));
      map.set(stage, (map.get(stage) ?? 0) + 1);
    }
    return map;
  }, [orders, cvsOrders]);

  /** 手動同步的對象：所有還在途中的超商訂單。 */
  const trackableIds = useMemo(
    () =>
      cvsOrders
        .filter((order) => isTrackableShipment(toLogisticsStatus(order.logistics_status)))
        .map((order) => order.id),
    [cvsOrders],
  );

  /** 自動同步的對象：已出貨（有寄貨編號）且還在途中。 */
  const autoIds = useMemo(
    () => cvsOrders.filter((order) => isAutoSyncableShipment(order)).map((order) => order.id),
    [cvsOrders],
  );

  const runSync = () => {
    if (trackableIds.length === 0 || isPending) return;
    syncShipments(trackableIds, {
      onSuccess: (result) =>
        toast.show({
          variant: 'success',
          label:
            result.failed > 0
              ? `已更新 ${result.synced} 筆貨態，${result.failed} 筆稍後再試`
              : `已更新 ${result.synced} 筆出貨狀態`,
        }),
      onError: (err: Error) => toast.show({ variant: 'danger', label: err.message }),
    });
  };

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const due = autoIds.filter(
        (id) => now - (lastAutoSyncAt.get(id) ?? 0) > AUTO_SYNC_INTERVAL_MS,
      );
      if (due.length === 0) return;
      for (const id of due) lastAutoSyncAt.set(id, now);
      // 自動同步保持安靜：使用者沒按任何東西，成功只更新畫面，失敗不跳錯誤。
      syncShipments(due, {
        onSuccess: () => setAutoSyncedAt(Date.now()),
        onError: () => undefined,
      });
    }, [autoIds, syncShipments]),
  );

  if (cvsOrders.length === 0) return null;

  /* 這一次要畫哪些膠囊：'all' 永遠在，其餘依呼叫端指定的階段收斂。 */
  const visible = stages
    ? SHIPMENT_FILTERS.filter((item) => item.key === 'all' || stages.includes(item.key))
    : SHIPMENT_FILTERS;

  const statusLine = isPending
    ? '正在向綠界更新貨態…'
    : autoSyncedAt
      ? '剛剛已自動更新貨態'
      : autoIds.length > 0
        ? '出貨後綠界會自動回報貨態，打開這一頁也會自動更新'
        : '賣家建立物流單並出貨後，貨態就會自動更新';

  return (
    <View className="border-border bg-background gap-2.5 rounded-2xl border p-3">
      <View className="flex-row items-center gap-2">
        <Truck size={14} color={BRAND.blue} />
        <Typography
          type="body-xs"
          numberOfLines={1}
          className="text-navy flex-1"
          style={{ fontWeight: '700' }}
        >
          {title ?? '超商取貨出貨狀態'}
        </Typography>
        {trackableIds.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={6}
            disabled={isPending}
            onPress={runSync}
            style={{
              ...(Platform.OS === 'web' && !isPending ? { cursor: 'pointer' } : null),
              ...(isPending ? { opacity: 0.6 } : null),
            }}
            className="bg-brand-blue-soft shrink-0 flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
          >
            <RefreshCw size={13} color={BRAND.blue} />
            <Typography type="body-xs" className="text-brand-blue" style={{ fontWeight: '600' }}>
              {isPending ? '同步中…' : `立即同步（${trackableIds.length}）`}
            </Typography>
          </Pressable>
        ) : null}
      </View>

      <Typography type="body-xs" color="muted">
        {statusLine}
      </Typography>

      {/* 固定三欄：每一列寬度一致，狀態與筆數上下對齊。 */}
      <View className="flex-row flex-wrap gap-2">
        {visible.map((item) => (
          <View key={item.key} className="w-[31.5%] grow">
            <SelectPill
              block
              size="sm"
              tone="soft"
              label={`${item.label} ${counts.get(item.key) ?? 0}`}
              selected={value === item.key}
              onPress={() => onChange(item.key)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
