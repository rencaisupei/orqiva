import { Button, Chip, Spinner, Typography, useToast } from 'heroui-native';
import { Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, MapPin, RefreshCw, Store, Truck } from 'lucide-react-native';

import {
  useCreateLogisticsOrder,
  useLogisticsEvents,
  useLogisticsOrder,
  useSyncLogisticsOrder,
} from '@/lib/api/logistics';
import { BRAND } from '@/lib/brand';
import { formatDateTime, formatPrice } from '@/lib/format';
import {
  LOGISTICS_STATUS_LABEL,
  LOGISTICS_SUB_TYPE_LABEL,
  isHomeSubType,
  toLogisticsStatus,
  toLogisticsSubType,
  type LogisticsStatus,
  type Order,
} from '@/lib/types';

type Props = {
  order: Order;
  role: 'seller' | 'buyer';
  /** 顯示綠界回報的貨態更新紀錄。列表畫面不開，避免每張卡片各打一次查詢。 */
  showEvents?: boolean;
};

function statusColor(status: LogisticsStatus) {
  if (status === 'failed' || status === 'returned' || status === 'cancelled') return 'danger';
  if (status === 'picked_up') return 'success';
  return 'accent';
}

/** 綠界貨到付款的收件資料、寄貨編號／黑貓託運單號與貨態。非綠界訂單不會渲染。 */
export function LogisticsPanel({ order, role, showEvents = false }: Props) {
  const { toast } = useToast();
  const { data: shipment, isLoading } = useLogisticsOrder(order.id);
  const { data: events } = useLogisticsEvents(showEvents ? shipment?.id : undefined);
  const create = useCreateLogisticsOrder();
  const sync = useSyncLogisticsOrder();

  if (order.shipping_provider !== 'ecpay' && !order.cvs_store_id) return null;

  const subType = toLogisticsSubType(order.logistics_sub_type ?? shipment?.logistics_sub_type);
  // 宅配（黑貓）：沒有取貨門市，寄貨編號換成託運單號，司機依收件地址送達。
  const isHome = isHomeSubType(subType) || order.logistics_type === 'HOME';
  const waybillNo = isHome
    ? (shipment?.booking_note ?? order.logistics_booking_note ?? shipment?.shipment_no ?? null)
    : (shipment?.shipment_no ?? null);
  const homeAddress = [order.receiver_zip_code, order.receiver_city, order.receiver_address]
    .filter(Boolean)
    .join(' ');

  const copy = (value: string, label: string) => {
    void Clipboard.setStringAsync(value);
    toast.show({ variant: 'success', label: `${label}已複製` });
  };

  return (
    <View className="border-border gap-3 rounded-2xl border border-dashed p-3">
      <View className="flex-row items-center gap-2">
        <Truck size={16} color={BRAND.blue} />
        <Typography type="body-sm" className="text-navy flex-1" style={{ fontWeight: '600' }}>
          {isHome ? '宅配貨到付款' : '超商取貨付款'}
          {subType ? ` · ${LOGISTICS_SUB_TYPE_LABEL[subType]}` : ''}
        </Typography>
        {shipment ? (
          <Chip size="sm" variant="soft" color={statusColor(shipment.status)}>
            {LOGISTICS_STATUS_LABEL[shipment.status]}
          </Chip>
        ) : null}
      </View>

      {isHome ? (
        homeAddress ? (
          <View className="bg-background gap-1 rounded-xl p-3">
            <View className="flex-row items-center gap-2">
              <MapPin size={14} color={BRAND.muted} />
              <Typography type="body-xs" color="muted" className="flex-1">
                收件地址
              </Typography>
            </View>
            <Typography type="body-sm" className="text-navy">
              {homeAddress}
            </Typography>
          </View>
        ) : null
      ) : order.cvs_store_id ? (
        <View className="bg-background gap-1 rounded-xl p-3">
          <View className="flex-row items-center gap-2">
            <Store size={14} color={BRAND.muted} />
            <Typography type="body-sm" numberOfLines={1} className="text-navy flex-1">
              {order.cvs_store_name ?? '取貨門市'}（{order.cvs_store_id}）
            </Typography>
          </View>
          {order.cvs_store_address ? (
            <Typography type="body-xs" color="muted">
              {order.cvs_store_address}
            </Typography>
          ) : null}
        </View>
      ) : null}

      {isLoading ? <Spinner size="sm" /> : null}

      <View className="bg-background gap-1 rounded-xl p-3">
        <View className="flex-row items-center justify-between gap-2">
          <Typography type="body-xs" color="muted" className="flex-1">
            {isHome ? '代收金額（司機送達時收款）' : '代收金額（買家到店付款）'}
          </Typography>
          <Typography type="body-sm" className="text-brand-orange" style={{ fontWeight: '700' }}>
            {formatPrice(shipment?.collection_amount ?? order.total)}
          </Typography>
        </View>
        <Typography type="body-xs" color="muted" numberOfLines={1}>
          商品名稱：{shipment?.goods_name ?? order.order_items[0]?.title ?? '商品一批'}
        </Typography>
      </View>

      {waybillNo ? (
        <Pressable
          className="bg-background flex-row items-center gap-2 rounded-xl p-3"
          onPress={() => copy(waybillNo, isHome ? '黑貓託運單號' : '寄貨編號')}
        >
          <View className="flex-1">
            <Typography type="body-xs" color="muted">
              {isHome ? '黑貓託運單號（列印託運單用）' : '寄貨編號'}
            </Typography>
            <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
              {waybillNo}
              {!isHome && shipment?.validation_no ? ` / ${shipment.validation_no}` : ''}
            </Typography>
          </View>
          <Copy size={15} color={BRAND.muted} />
        </Pressable>
      ) : null}

      {shipment?.rtn_msg ? (
        <Typography type="body-xs" color="muted">
          綠界回報：{shipment.rtn_msg}
          {shipment.rtn_code ? `（${shipment.rtn_code}）` : ''}
        </Typography>
      ) : null}

      {/* 貨態更新：最新的在最上面，時間是綠界回報的時間。 */}
      {showEvents && events && events.length > 0 ? (
        <View className="bg-background gap-2 rounded-xl p-3">
          <Typography type="body-xs" color="muted">
            貨態更新
          </Typography>
          {events.slice(0, 6).map((event) => {
            const status = toLogisticsStatus(event.logistics_status);
            return (
              <View key={event.id} className="flex-row items-start gap-2">
                <View
                  className="mt-1.5 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: BRAND.blue }}
                />
                <View className="flex-1">
                  <Typography type="body-xs" numberOfLines={2} className="text-navy">
                    {status ? LOGISTICS_STATUS_LABEL[status] : (event.rtn_msg ?? '狀態更新')}
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    {formatDateTime(event.created_at)}
                  </Typography>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {role === 'seller' && !shipment ? (
        <Button
          size="sm"
          isDisabled={create.isPending}
          onPress={() =>
            create.mutate(
              { orderId: order.id, logisticsSubType: subType ?? undefined },
              {
                onSuccess: () => toast.show({ variant: 'success', label: '物流單已建立' }),
                onError: (err: Error) => toast.show({ variant: 'danger', label: err.message }),
              },
            )
          }
        >
          <Button.Label>
            {create.isPending ? '送出中…' : isHome ? '建立黑貓託運單' : '建立綠界物流單'}
          </Button.Label>
        </Button>
      ) : null}

      {role === 'seller' && shipment?.status === 'failed' ? (
        <Button
          size="sm"
          variant="secondary"
          isDisabled={create.isPending}
          onPress={() =>
            create.mutate(
              { orderId: order.id, logisticsSubType: subType ?? undefined },
              {
                onSuccess: () => toast.show({ variant: 'success', label: '物流單已重新建立' }),
                onError: (err: Error) => toast.show({ variant: 'danger', label: err.message }),
              },
            )
          }
        >
          <Button.Label>重新建立物流單</Button.Label>
        </Button>
      ) : null}

      {shipment ? (
        <Button
          size="sm"
          variant="ghost"
          isDisabled={sync.isPending}
          onPress={() =>
            sync.mutate(order.id, {
              onError: (err: Error) => toast.show({ variant: 'danger', label: err.message }),
            })
          }
        >
          <View className="flex-row items-center gap-1.5">
            <RefreshCw size={14} color={BRAND.blue} />
            <Typography type="body-sm" className="text-brand-blue">
              {sync.isPending ? '更新中…' : '更新貨態'}
            </Typography>
          </View>
        </Button>
      ) : null}
    </View>
  );
}
