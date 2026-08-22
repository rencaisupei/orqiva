import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, View } from 'react-native';
import { Button, Chip, SearchField, Spinner, Typography, useToast } from 'heroui-native';
import { router } from 'expo-router';
import { Receipt, RefreshCw, Truck } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { SelectPill } from '@/components/SelectPill';
import { SignInRequired } from '@/components/SignInRequired';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useMyOrders } from '@/lib/api/commerce';
import { useSyncShipments } from '@/lib/api/logistics';
import { BRAND } from '@/lib/brand';
import { formatDateTime, formatNumber, formatPrice } from '@/lib/format';
import { useUserId } from '@/lib/session';
import {
  isCvsOrder,
  isTrackableShipment,
  LOGISTICS_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  SHIPMENT_STAGE_LABEL,
  shipmentStage,
  toLogisticsStatus,
  type Order,
  type OrderStatus,
  type ShipmentStage,
} from '@/lib/types';

type StatusFilter = OrderStatus | 'all';
type ShipmentFilter = ShipmentStage | 'all';
type RangeKey = 'all' | '30d' | '3m' | '1y';

const STATUS_SEGMENTS: Segment<StatusFilter>[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待付款' },
  { key: 'paid', label: '備貨中' },
  { key: 'shipped', label: '已出貨' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
];

/** 出貨狀態篩選：只對綠界超商取貨訂單有意義，宅配訂單沒有貨態。 */
const SHIPMENT_FILTERS: { key: ShipmentFilter; label: string }[] = [
  { key: 'all', label: '全部出貨狀態' },
  { key: 'awaiting', label: SHIPMENT_STAGE_LABEL.awaiting },
  { key: 'created', label: SHIPMENT_STAGE_LABEL.created },
  { key: 'in_transit', label: SHIPMENT_STAGE_LABEL.in_transit },
  { key: 'arrived', label: SHIPMENT_STAGE_LABEL.arrived },
  { key: 'picked_up', label: SHIPMENT_STAGE_LABEL.picked_up },
  { key: 'issue', label: SHIPMENT_STAGE_LABEL.issue },
];

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: 'all', label: '全部時間', days: null },
  { key: '30d', label: '近 30 天', days: 30 },
  { key: '3m', label: '近 3 個月', days: 90 },
  { key: '1y', label: '近 1 年', days: 365 },
];

const DAY_MS = 86_400_000;

/** Matches the keyword against order number, store name and every line title. */
function matchesKeyword(order: Order, keyword: string): boolean {
  if (!keyword) return true;
  if (order.order_no.toLowerCase().includes(keyword)) return true;
  if ((order.store?.name ?? '').toLowerCase().includes(keyword)) return true;
  return order.order_items.some((line) => line.title.toLowerCase().includes(keyword));
}

/** 貨態徽章顏色：異常紅、已取貨綠、其餘品牌藍。 */
function shipmentChipColor(stage: ShipmentStage) {
  if (stage === 'issue') return 'danger';
  if (stage === 'picked_up') return 'success';
  return 'accent';
}

export default function OrdersScreen() {
  const userId = useUserId();
  const { toast } = useToast();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [shipment, setShipment] = useState<ShipmentFilter>('all');
  const [range, setRange] = useState<RangeKey>('all');
  const [search, setSearch] = useState('');
  const { data: orders, isLoading } = useMyOrders(userId);
  const { refreshing, onRefresh } = usePullToRefresh();
  const sync = useSyncShipments();

  const keyword = search.trim().toLowerCase();
  const rangeDays = RANGES.find((item) => item.key === range)?.days ?? null;

  const filtered = useMemo(() => {
    const cutoff = rangeDays ? Date.now() - rangeDays * DAY_MS : null;
    return (orders ?? []).filter((order) => {
      if (status !== 'all' && order.status !== status) return false;
      if (shipment !== 'all') {
        if (!isCvsOrder(order)) return false;
        if (shipmentStage(toLogisticsStatus(order.logistics_status)) !== shipment) return false;
      }
      if (cutoff && new Date(order.created_at).getTime() < cutoff) return false;
      return matchesKeyword(order, keyword);
    });
  }, [orders, status, shipment, rangeDays, keyword]);

  /** 還在途中的超商取貨訂單：按一下就逐筆向綠界重新查一次貨態。 */
  const trackableIds = useMemo(
    () =>
      (orders ?? [])
        .filter(
          (order) =>
            isCvsOrder(order) && isTrackableShipment(toLogisticsStatus(order.logistics_status)),
        )
        .map((order) => order.id),
    [orders],
  );

  const hasCvsOrders = (orders ?? []).some((order) => isCvsOrder(order));

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

  if (!userId) {
    return <SignInRequired title="登入後查看訂單" />;
  }

  const total = orders?.length ?? 0;
  const narrowed = status !== 'all' || shipment !== 'all' || range !== 'all' || keyword.length > 0;

  const clearFilters = () => {
    setStatus('all');
    setShipment('all');
    setRange('all');
    setSearch('');
  };

  return (
    <View className="bg-background flex-1">
      <View className="bg-surface gap-3 px-4 py-3">
        <SearchField value={search} onChange={setSearch}>
          <SearchField.Group className="rounded-full">
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="搜尋訂單編號、商品或賣家" returnKeyType="search" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <SegmentedControl items={STATUS_SEGMENTS} value={status} onChange={setStatus} size="sm" />

        {hasCvsOrders ? (
          <View className="gap-2">
            <View className="flex-row items-center justify-between gap-3">
              <Typography type="body-xs" color="muted" className="flex-1">
                超商取貨出貨狀態
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
                  <Typography
                    type="body-xs"
                    className="text-brand-blue"
                    style={{ fontWeight: '600' }}
                  >
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
                  selected={shipment === item.key}
                  onPress={() => setShipment(item.key)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View className="flex-row flex-wrap gap-2">
          {RANGES.map((item) => (
            <SelectPill
              key={item.key}
              size="sm"
              tone="soft"
              label={item.label}
              selected={range === item.key}
              onPress={() => setRange(item.key)}
            />
          ))}
        </View>

        <View className="flex-row items-center justify-between gap-3">
          <Typography type="body-xs" color="muted">
            共 {formatNumber(filtered.length)} 筆
            {narrowed ? `／全部 ${formatNumber(total)} 筆` : ''}
          </Typography>
          {narrowed ? (
            <Pressable hitSlop={6} onPress={clearFilters}>
              <Typography type="body-xs" className="text-brand-orange">
                清除條件
              </Typography>
            </Pressable>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 gap-3 pb-10"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BRAND.blue}
              colors={[BRAND.blue]}
            />
          }
          ListEmptyComponent={
            narrowed && total > 0 ? (
              <EmptyState
                icon={<Receipt size={26} color={BRAND.blue} />}
                title="找不到符合的訂單"
                description="試著換個關鍵字，或把狀態與時間範圍調回全部。"
                action={
                  <Button variant="secondary" onPress={clearFilters}>
                    <Button.Label>清除條件</Button.Label>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Receipt size={26} color={BRAND.blue} />}
                title="還沒有訂單"
                description="下單後可在這裡追蹤配送狀態。"
                action={
                  <Button onPress={() => router.push('/products')}>
                    <Button.Label>開始探索</Button.Label>
                  </Button>
                }
              />
            )
          }
          renderItem={({ item }) => {
            const logisticsStatus = toLogisticsStatus(item.logistics_status);
            const stage = shipmentStage(logisticsStatus);
            const shipmentDetail = [
              item.cvs_store_name,
              item.logistics_shipment_no ? `寄貨編號 ${item.logistics_shipment_no}` : null,
            ]
              .filter((part): part is string => !!part)
              .join(' · ');

            return (
              <Pressable
                className="bg-surface gap-3 rounded-2xl p-4"
                onPress={() => router.push({ pathname: '/orders/[id]', params: { id: item.id } })}
              >
                <View className="flex-row items-center justify-between gap-3">
                  <Typography
                    type="body-sm"
                    numberOfLines={1}
                    className="text-navy flex-1"
                    style={{ fontWeight: '600' }}
                  >
                    {item.store?.name ?? '極貨網賣家'}
                  </Typography>
                  <Chip
                    disabled
                    size="sm"
                    variant="soft"
                    color={
                      item.status === 'cancelled'
                        ? 'danger'
                        : item.status === 'completed'
                          ? 'success'
                          : 'accent'
                    }
                  >
                    {ORDER_STATUS_LABEL[item.status]}
                  </Chip>
                </View>

                {item.order_items.slice(0, 2).map((line) => (
                  <View key={line.id} className="flex-row items-center gap-3">
                    <AppImage uri={line.image_url} className="h-14 w-14 rounded-xl" />
                    <View className="flex-1">
                      <Typography type="body-sm" numberOfLines={2} className="text-navy">
                        {line.title}
                      </Typography>
                      <Typography type="body-xs" color="muted">
                        {formatPrice(line.unit_price)} × {line.quantity}
                      </Typography>
                    </View>
                  </View>
                ))}
                {item.order_items.length > 2 ? (
                  <Typography type="body-xs" color="muted">
                    以及其他 {item.order_items.length - 2} 項商品
                  </Typography>
                ) : null}

                {isCvsOrder(item) ? (
                  <View className="bg-background flex-row items-center gap-2 rounded-xl p-3">
                    <Truck size={15} color={BRAND.blue} />
                    <View className="flex-1">
                      <Typography
                        type="body-xs"
                        className="text-navy"
                        style={{ fontWeight: '600' }}
                      >
                        {logisticsStatus
                          ? LOGISTICS_STATUS_LABEL[logisticsStatus]
                          : '賣家尚未建立物流單'}
                      </Typography>
                      {shipmentDetail ? (
                        <Typography type="body-xs" color="muted" numberOfLines={1}>
                          {shipmentDetail}
                        </Typography>
                      ) : null}
                    </View>
                    <Chip disabled size="sm" variant="soft" color={shipmentChipColor(stage)}>
                      {SHIPMENT_STAGE_LABEL[stage]}
                    </Chip>
                  </View>
                ) : null}

                <View className="flex-row items-center justify-between gap-3">
                  <Typography type="body-xs" color="muted" numberOfLines={1} className="flex-1">
                    {item.order_no} · {formatDateTime(item.created_at)}
                  </Typography>
                  <Typography
                    type="body"
                    numberOfLines={1}
                    className="text-brand-orange"
                    style={{ fontWeight: '700' }}
                  >
                    {formatPrice(item.total)}
                  </Typography>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
