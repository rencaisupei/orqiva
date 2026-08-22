import { useMemo } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Typography, useToast } from 'heroui-native';
import { RefreshCw } from 'lucide-react-native';

import { SelectPill } from '@/components/SelectPill';
import { useSyncShipments } from '@/lib/api/logistics';
import { BRAND } from '@/lib/brand';
import {
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
  { key: 'all', label: '全部出貨狀態' },
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

type Props = {
  orders: Order[];
  value: ShipmentFilter;
  onChange: (value: ShipmentFilter) => void;
  /** 標題文字：買家與賣家兩邊說法略有不同。 */
  title?: string;
};

/**
 * 超商取貨的出貨狀態篩選列，右上角是「同步出貨狀態（N）」。
 *
 * 買家訂單列表與賣家中心訂單頁共用同一份邏輯：N 只計算還在途中的訂單
 * （已取貨／退回／取消不再向綠界查詢），沒有任何超商訂單時整列不渲染。
 */
export function ShipmentStatusBar({ orders, value, onChange, title }: Props) {
  const { toast } = useToast();
  const sync = useSyncShipments();

  const trackableIds = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            isCvsOrder(order) && isTrackableShipment(toLogisticsStatus(order.logistics_status)),
        )
        .map((order) => order.id),
    [orders],
  );

  const hasCvsOrders = useMemo(() => orders.some((order) => isCvsOrder(order)), [orders]);

  const runSync = () => {
    if (trackableIds.length === 0 || sync.isPending) return;
    sync.mutate(trackableIds, {
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

  if (!hasCvsOrders) return null;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-3">
        <Typography type="body-xs" color="muted" className="flex-1">
          {title ?? '超商取貨出貨狀態'}
        </Typography>
        {trackableIds.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={6}
            disabled={sync.isPending}
            onPress={runSync}
            style={{
              ...(Platform.OS === 'web' && !sync.isPending ? { cursor: 'pointer' } : null),
              ...(sync.isPending ? { opacity: 0.6 } : null),
            }}
            className="bg-brand-blue-soft flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
          >
            <RefreshCw size={13} color={BRAND.blue} />
            <Typography type="body-xs" className="text-brand-blue" style={{ fontWeight: '600' }}>
              {sync.isPending ? '同步中…' : `同步出貨狀態（${trackableIds.length}）`}
            </Typography>
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {SHIPMENT_FILTERS.map((item) => (
          <SelectPill
            key={item.key}
            size="sm"
            tone="soft"
            label={item.label}
            selected={value === item.key}
            onPress={() => onChange(item.key)}
          />
        ))}
      </View>
    </View>
  );
}
