import { Pressable, View } from 'react-native';
import { Button, Chip, Separator, Typography, useToast } from 'heroui-native';
import { router } from 'expo-router';
import { ChevronRight, Store as StoreIcon, Truck } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { shipmentChipColor } from '@/components/ShipmentStatusBar';
import { useReorder, useSetOrderStatus } from '@/lib/api/commerce';
import { useStartConversation } from '@/lib/api/social';
import { BRAND } from '@/lib/brand';
import { formatDateTime, formatNumber, formatPrice } from '@/lib/format';
import { useUserId } from '@/lib/session';
import {
  isCvsOrder,
  LOGISTICS_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  SHIPMENT_STAGE_LABEL,
  shipmentStage,
  toLogisticsStatus,
  type Order,
  type OrderStatus,
} from '@/lib/types';

/** 狀態文字的顏色：進行中用品牌色、已取消紅、已完成灰。 */
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: BRAND.orange,
  paid: BRAND.blue,
  shipped: BRAND.blue,
  completed: BRAND.muted,
  cancelled: BRAND.danger,
};

/** 取貨門市／寄貨編號：標籤固定寬度，多筆訂單的值上下對齊。 */
function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View className="flex-row items-start gap-2">
      <Typography type="body-xs" color="muted" className="w-16 shrink-0">
        {label}
      </Typography>
      <Typography type="body-xs" numberOfLines={2} className="text-navy flex-1">
        {value}
      </Typography>
    </View>
  );
}

/**
 * 買家的訂單卡片。
 *
 * 結構刻意分成兩層：上半部（店舖、貨態、商品）是一個 Pressable，整塊點下去進訂單
 * 詳情；下半部的操作按鈕放在 Pressable 外面，避免兩層可點區互相吃掉觸控。
 */
export function BuyerOrderCard({ order }: { order: Order }) {
  const userId = useUserId();
  const { toast } = useToast();
  const setStatus = useSetOrderStatus();
  const reorder = useReorder();
  const startConversation = useStartConversation();

  const logisticsStatus = toLogisticsStatus(order.logistics_status);
  const stage = shipmentStage(logisticsStatus);
  const itemCount = order.order_items.reduce((sum, line) => sum + line.quantity, 0);
  const visibleLines = order.order_items.slice(0, 2);
  const hiddenCount = order.order_items.length - visibleLines.length;
  const reviewable = order.order_items.find((line) => !!line.product_id && !line.reviewed);

  const openDetail = () => router.push({ pathname: '/orders/[id]', params: { id: order.id } });

  const changeStatus = (status: OrderStatus, label: string) => {
    setStatus.mutate(
      { orderId: order.id, status },
      {
        onSuccess: () => toast.show({ variant: 'success', label }),
        onError: (err: Error) => toast.show({ variant: 'danger', label: err.message }),
      },
    );
  };

  const buyAgain = () => {
    if (!userId) {
      router.push('/auth/sign-in');
      return;
    }
    reorder.mutate(
      { userId, order },
      {
        onSuccess: (result) => {
          toast.show({
            variant: 'success',
            label:
              result.skipped > 0
                ? `已加入 ${result.added} 項，${result.skipped} 項已下架或缺貨`
                : `已把 ${result.added} 項商品加入購物車`,
          });
          router.push('/cart');
        },
        onError: (err: Error) => toast.show({ variant: 'danger', label: err.message }),
      },
    );
  };

  const contactSeller = () => {
    if (!userId || !order.store_id) {
      router.push('/auth/sign-in');
      return;
    }
    startConversation.mutate(
      {
        buyerId: userId,
        storeId: order.store_id,
        sellerId: order.seller_id,
        productId: order.order_items[0]?.product_id ?? null,
      },
      {
        onSuccess: (conversationId) =>
          router.push({ pathname: '/messages/[id]', params: { id: conversationId } }),
        onError: (err: Error) => toast.show({ variant: 'danger', label: err.message }),
      },
    );
  };

  const busy = setStatus.isPending || reorder.isPending || startConversation.isPending;

  return (
    <View className="bg-surface overflow-hidden rounded-2xl">
      <Pressable accessibilityRole="button" className="gap-3 px-4 pt-3.5" onPress={openDetail}>
        {/* 店舖 + 目前狀態：一眼看出「誰的單、到哪一步」。 */}
        <View className="flex-row items-center gap-2">
          {order.store?.logo_url ? (
            <AppImage uri={order.store.logo_url} className="h-7 w-7 rounded-full" />
          ) : (
            <View
              className="h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: BRAND.blueSoft }}
            >
              <StoreIcon size={14} color={BRAND.blue} />
            </View>
          )}
          <Typography
            type="body-sm"
            numberOfLines={1}
            className="text-navy shrink"
            style={{ fontWeight: '700' }}
          >
            {order.store?.name ?? '極貨網賣家'}
          </Typography>
          <ChevronRight size={14} color={BRAND.muted} />
          <View className="flex-1" />
          <Typography
            type="body-sm"
            numberOfLines={1}
            style={{ fontWeight: '700', color: STATUS_COLOR[order.status] }}
          >
            {ORDER_STATUS_LABEL[order.status]}
          </Typography>
        </View>

        {/* 出貨狀態在商品上方：進到列表最先看到的就是「貨到哪了」。 */}
        {isCvsOrder(order) ? (
          <View className="bg-background gap-2 rounded-xl p-3">
            <View className="flex-row items-center gap-2">
              <Truck size={15} color={BRAND.blue} />
              <Typography
                type="body-xs"
                numberOfLines={1}
                className="text-navy flex-1"
                style={{ fontWeight: '600' }}
              >
                {logisticsStatus ? LOGISTICS_STATUS_LABEL[logisticsStatus] : '賣家尚未建立物流單'}
              </Typography>
              <Chip disabled size="sm" variant="soft" color={shipmentChipColor(stage)}>
                {SHIPMENT_STAGE_LABEL[stage]}
              </Chip>
            </View>
            <DetailRow label="取貨門市" value={order.cvs_store_name} />
            <DetailRow label="寄貨編號" value={order.logistics_shipment_no} />
          </View>
        ) : null}

        {/* 商品列：縮圖 + 名稱在左，單價與數量靠右對齊。 */}
        <View className="gap-3">
          {visibleLines.map((line) => (
            <View key={line.id} className="flex-row gap-3">
              <AppImage uri={line.image_url} className="h-16 w-16 rounded-xl" />
              <View className="flex-1">
                <Typography type="body-sm" numberOfLines={2} className="text-navy">
                  {line.title}
                </Typography>
                <Typography type="body-xs" color="muted" numberOfLines={1}>
                  {order.shipping_method}
                  {line.reviewed ? ' · 已評價' : ''}
                </Typography>
              </View>
              <View className="w-24 items-end">
                <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
                  {formatPrice(line.unit_price)}
                </Typography>
                <Typography type="body-xs" color="muted">
                  ×{line.quantity}
                </Typography>
              </View>
            </View>
          ))}
          {hiddenCount > 0 ? (
            <Typography type="body-xs" color="muted">
              以及其他 {hiddenCount} 項商品
            </Typography>
          ) : null}
        </View>

        <Separator />

        <View className="flex-row items-end justify-between gap-3">
          <Typography type="body-xs" color="muted" numberOfLines={1} className="flex-1">
            {order.order_no} · {formatDateTime(order.created_at)}
          </Typography>
          <View className="flex-row items-end gap-1.5">
            <Typography type="body-xs" color="muted">
              共 {formatNumber(itemCount)} 件 合計
            </Typography>
            <Typography type="body" className="text-brand-orange" style={{ fontWeight: '700' }}>
              {formatPrice(order.total)}
            </Typography>
          </View>
        </View>
      </Pressable>

      {/* 操作按鈕：依訂單狀態給該做的下一步，放在可點區之外。 */}
      <View className="flex-row flex-wrap justify-end gap-2 px-4 pt-3 pb-3.5">
        {order.status === 'pending' ? (
          <>
            <Button
              size="sm"
              variant="tertiary"
              isDisabled={busy}
              onPress={() => changeStatus('cancelled', '訂單已取消')}
            >
              <Button.Label>取消訂單</Button.Label>
            </Button>
            <Button size="sm" onPress={openDetail}>
              <Button.Label>查看付款資訊</Button.Label>
            </Button>
          </>
        ) : null}

        {order.status === 'paid' ? (
          <>
            <Button size="sm" variant="tertiary" isDisabled={busy} onPress={contactSeller}>
              <Button.Label>聯絡賣家</Button.Label>
            </Button>
            <Button size="sm" variant="secondary" onPress={openDetail}>
              <Button.Label>訂單詳情</Button.Label>
            </Button>
          </>
        ) : null}

        {order.status === 'shipped' ? (
          <>
            <Button size="sm" variant="tertiary" isDisabled={busy} onPress={contactSeller}>
              <Button.Label>聯絡賣家</Button.Label>
            </Button>
            <Button
              size="sm"
              isDisabled={busy}
              onPress={() => changeStatus('completed', '已確認收貨')}
            >
              <Button.Label>確認收貨</Button.Label>
            </Button>
          </>
        ) : null}

        {order.status === 'completed' || order.status === 'cancelled' ? (
          <>
            <Button size="sm" variant="tertiary" isDisabled={busy} onPress={buyAgain}>
              <Button.Label>{reorder.isPending ? '加入中…' : '再買一次'}</Button.Label>
            </Button>
            {order.status === 'completed' && reviewable ? (
              <Button
                size="sm"
                onPress={() =>
                  router.push({
                    pathname: '/review/[productId]',
                    params: {
                      productId: reviewable.product_id!,
                      orderId: order.id,
                      orderItemId: reviewable.id,
                    },
                  })
                }
              >
                <Button.Label>評價商品</Button.Label>
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onPress={openDetail}>
                <Button.Label>訂單詳情</Button.Label>
              </Button>
            )}
          </>
        ) : null}
      </View>
    </View>
  );
}
