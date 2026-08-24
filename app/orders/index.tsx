import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Button, SearchField, Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { Receipt } from 'lucide-react-native';

import { BuyerOrderCard } from '@/components/BuyerOrderCard';
import { EmptyState } from '@/components/EmptyState';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { SelectPill } from '@/components/SelectPill';
import {
  matchesShipmentFilter,
  ShipmentStatusBar,
  type ShipmentFilter,
} from '@/components/ShipmentStatusBar';
import { SignInRequired } from '@/components/SignInRequired';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useMyOrders } from '@/lib/api/commerce';
import { BRAND } from '@/lib/brand';
import { formatNumber } from '@/lib/format';
import { useUserId } from '@/lib/session';
import {
  isCvsOrder,
  shipmentStage,
  toLogisticsStatus,
  type Order,
  type OrderStatus,
  type ShipmentStage,
} from '@/lib/types';

type StatusFilter = OrderStatus | 'all';
type RangeKey = 'all' | '30d' | '3m';

const STATUS_SEGMENTS: Segment<StatusFilter>[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待付款' },
  { key: 'paid', label: '備貨中' },
  { key: 'shipped', label: '已出貨' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
];

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: 'all', label: '全部時間', days: null },
  { key: '30d', label: '近 30 天', days: 30 },
  { key: '3m', label: '近 3 個月', days: 90 },
];

const DAY_MS = 86_400_000;

/** Matches the keyword against order number, store name and every line title. */
function matchesKeyword(order: Order, keyword: string): boolean {
  if (!keyword) return true;
  if (order.order_no.toLowerCase().includes(keyword)) return true;
  if ((order.store?.name ?? '').toLowerCase().includes(keyword)) return true;
  return order.order_items.some((line) => line.title.toLowerCase().includes(keyword));
}

/** 貨態徽章顏色與篩選比對搬到 ShipmentStatusBar，與賣家中心共用同一份規則。 */
export default function OrdersScreen() {
  const userId = useUserId();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [shipment, setShipment] = useState<ShipmentFilter>('all');
  const [range, setRange] = useState<RangeKey>('all');
  const [search, setSearch] = useState('');
  const { data: orders, isLoading } = useMyOrders(userId);
  const { refreshing, onRefresh } = usePullToRefresh();

  const keyword = search.trim().toLowerCase();
  const rangeDays = RANGES.find((item) => item.key === range)?.days ?? null;

  /* 換分頁時把貨態條件收回「全部」：每個分頁的階段不同，留著上一頁選的階段
     會出現「看得到膠囊卻沒有訂單」的狀況。 */
  const changeStatus = (next: StatusFilter) => {
    setStatus(next);
    setShipment('all');
  };

  /* 這個分頁的訂單（還沒套用貨態條件）：出貨狀態區塊的筆數與階段都由它決定，
     所以待付款分頁只會看到待付款訂單的貨態。 */
  const scoped = useMemo(() => {
    const cutoff = rangeDays ? Date.now() - rangeDays * DAY_MS : null;
    return (orders ?? []).filter((order) => {
      if (status !== 'all' && order.status !== status) return false;
      if (cutoff && new Date(order.created_at).getTime() < cutoff) return false;
      return matchesKeyword(order, keyword);
    });
  }, [orders, status, rangeDays, keyword]);

  const filtered = useMemo(
    () => scoped.filter((order) => matchesShipmentFilter(order, shipment)),
    [scoped, shipment],
  );

  /* 只留這個分頁真的有訂單的階段，例如備貨中分頁通常只有「待出貨／已建單」。 */
  const stages = useMemo(() => {
    const present = new Set<ShipmentStage>();
    for (const order of scoped) {
      if (!isCvsOrder(order)) continue;
      present.add(shipmentStage(toLogisticsStatus(order.logistics_status)));
    }
    return Array.from(present);
  }, [scoped]);

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

  const statusLabel = STATUS_SEGMENTS.find((item) => item.key === status)?.label ?? '全部';

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

        <SegmentedControl
          items={STATUS_SEGMENTS}
          value={status}
          onChange={changeStatus}
          size="sm"
        />

        {/* 出貨動態跟著分頁走：每一頁都看得到，但只統計、只篩選這一頁的訂單。 */}
        <ShipmentStatusBar
          orders={scoped}
          value={shipment}
          onChange={setShipment}
          stages={stages}
          title={status === 'all' ? '超商取貨出貨狀態' : `${statusLabel}的出貨動態`}
        />

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
          renderItem={({ item }) => <BuyerOrderCard order={item} />}
        />
      )}
    </View>
  );
}
