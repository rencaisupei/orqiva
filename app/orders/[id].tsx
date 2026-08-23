import { ScrollView, View } from 'react-native';
import { Button, Chip, Separator, Spinner, Typography, useToast } from 'heroui-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MapPin, Package, Truck } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { LogisticsPanel } from '@/components/LogisticsPanel';
import { useOrder, useReorder, useSetOrderStatus } from '@/lib/api/commerce';
import { BRAND } from '@/lib/brand';
import { deliveryEstimate, formatDateTime, formatPrice } from '@/lib/format';
import { useUserId } from '@/lib/session';
import { ORDER_STATUS_LABEL } from '@/lib/types';

const TIMELINE = ['pending', 'paid', 'shipped', 'completed'] as const;

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const { toast } = useToast();
  const { data: order, isLoading } = useOrder(id);
  const setStatus = useSetOrderStatus();
  const reorder = useReorder();

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (!order) {
    return (
      <View className="bg-background flex-1">
        <EmptyState title="找不到這筆訂單" />
      </View>
    );
  }

  const isBuyer = order.buyer_id === userId;
  const currentStep = TIMELINE.findIndex((step) => step === order.status);

  const changeStatus = (status: string, label: string) => {
    setStatus.mutate(
      { orderId: order.id, status },
      {
        onSuccess: () => toast.show({ variant: 'success', label }),
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  /** Puts every still-buyable line back in the cart and goes there. */
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
                ? `已加入 ${result.added} 項商品，${result.skipped} 項已下架或缺貨`
                : `已把 ${result.added} 項商品加入購物車`,
          });
          router.push('/cart');
        },
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  return (
    <View className="bg-background flex-1">
      <ScrollView contentContainerClassName="p-4 gap-3 pb-6">
        <View className="bg-surface gap-2 rounded-2xl p-4">
          <View className="flex-row items-center justify-between">
            <Typography type="h6" className="text-navy" style={{ fontWeight: '700' }}>
              {ORDER_STATUS_LABEL[order.status]}
            </Typography>
            <Chip size="sm" variant="tertiary">
              {order.order_no}
            </Chip>
          </View>
          <Typography type="body-xs" color="muted">
            建立時間 {formatDateTime(order.created_at)}
          </Typography>

          {order.status !== 'cancelled' ? (
            <View className="mt-2 flex-row items-center">
              {TIMELINE.map((step, index) => (
                <View key={step} className="flex-1 items-center">
                  <View
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: index <= currentStep ? BRAND.blue : BRAND.border }}
                  />
                  <Typography
                    type="body-xs"
                    className={index <= currentStep ? 'text-navy' : 'text-muted'}
                  >
                    {ORDER_STATUS_LABEL[step]}
                  </Typography>
                </View>
              ))}
            </View>
          ) : null}

          {/* 出貨動態放在最上面這一欄：門市、寄貨編號與貨態更新都在這裡，
              不必再滑到商品下方。 */}
          <LogisticsPanel order={order} role={isBuyer ? 'buyer' : 'seller'} showEvents />
        </View>

        <View className="bg-surface gap-2 rounded-2xl p-4">
          <View className="flex-row items-center gap-2">
            <Truck size={15} color={BRAND.blue} />
            <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
              配送資訊
            </Typography>
          </View>
          <Typography type="body-sm" color="muted">
            {order.shipping_method} · {deliveryEstimate(order.shipping_method)}
          </Typography>
          <View className="flex-row items-start gap-2">
            <MapPin size={14} color={BRAND.muted} />
            <View className="flex-1">
              <Typography type="body-sm" className="text-navy">
                {order.recipient_name} {order.recipient_phone}
              </Typography>
              <Typography type="body-sm" color="muted">
                {order.shipping_address}
              </Typography>
            </View>
          </View>
          {order.note ? (
            <Typography type="body-xs" color="muted">
              備註：{order.note}
            </Typography>
          ) : null}
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <View className="flex-row items-center gap-2">
            <Package size={15} color={BRAND.blue} />
            <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
              {order.store?.name ?? '極貨網賣家'}
            </Typography>
          </View>
          {order.order_items.map((line) => (
            <View key={line.id} className="flex-row items-center gap-3">
              <AppImage uri={line.image_url} className="h-16 w-16 rounded-xl" />
              <View className="flex-1">
                <Typography type="body-sm" numberOfLines={2} className="text-navy">
                  {line.title}
                </Typography>
                <Typography type="body-xs" color="muted">
                  {formatPrice(line.unit_price)} × {line.quantity}
                </Typography>
              </View>
              {isBuyer && order.status === 'completed' && line.product_id && !line.reviewed ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/review/[productId]',
                      params: {
                        productId: line.product_id!,
                        orderId: order.id,
                        orderItemId: line.id,
                      },
                    })
                  }
                >
                  <Button.Label>評價</Button.Label>
                </Button>
              ) : null}
              {line.reviewed ? (
                <Chip size="sm" variant="soft" color="success">
                  已評價
                </Chip>
              ) : null}
            </View>
          ))}
        </View>

        <View className="bg-surface gap-2 rounded-2xl p-4">
          <View className="flex-row justify-between">
            <Typography type="body-sm" color="muted">
              商品小計
            </Typography>
            <Typography type="body-sm" className="text-navy">
              {formatPrice(order.subtotal)}
            </Typography>
          </View>
          <View className="flex-row justify-between">
            <Typography type="body-sm" color="muted">
              運費
            </Typography>
            <Typography type="body-sm" className="text-navy">
              {formatPrice(order.shipping_fee)}
            </Typography>
          </View>
          <Separator />
          <View className="flex-row items-center justify-between">
            <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
              訂單總額
            </Typography>
            <Typography type="h5" className="text-brand-orange" style={{ fontWeight: '700' }}>
              {formatPrice(order.total)}
            </Typography>
          </View>
        </View>
      </ScrollView>

      <View className="border-border bg-surface pb-safe-offset-3 flex-row gap-2 border-t px-4 py-3">
        {isBuyer && (order.status === 'pending' || order.status === 'paid') ? (
          <Button
            variant="secondary"
            className="flex-1"
            isDisabled={setStatus.isPending}
            onPress={() => changeStatus('cancelled', '訂單已取消')}
          >
            <Button.Label>取消訂單</Button.Label>
          </Button>
        ) : null}
        {isBuyer && order.status === 'shipped' ? (
          <Button
            className="flex-1"
            isDisabled={setStatus.isPending}
            onPress={() => changeStatus('completed', '訂單已完成')}
          >
            <Button.Label>確認收貨</Button.Label>
          </Button>
        ) : null}
        {!isBuyer && order.status === 'pending' ? (
          <Button
            className="flex-1"
            isDisabled={setStatus.isPending}
            onPress={() => changeStatus('paid', '已標記為備貨中')}
          >
            <Button.Label>確認款項</Button.Label>
          </Button>
        ) : null}
        {!isBuyer && order.status === 'paid' ? (
          <Button
            className="flex-1"
            isDisabled={setStatus.isPending}
            onPress={() => changeStatus('shipped', '已標記為出貨')}
          >
            <Button.Label>標記出貨</Button.Label>
          </Button>
        ) : null}
        {isBuyer && (order.status === 'completed' || order.status === 'cancelled') ? (
          <Button className="flex-1" isDisabled={reorder.isPending} onPress={buyAgain}>
            <Button.Label numberOfLines={1}>
              {reorder.isPending ? '加入中…' : '再買一次'}
            </Button.Label>
          </Button>
        ) : null}
        {order.status === 'completed' || order.status === 'cancelled' ? (
          <Button variant="secondary" className="flex-1" onPress={() => router.push('/products')}>
            <Button.Label numberOfLines={1}>繼續探索</Button.Label>
          </Button>
        ) : null}
      </View>
    </View>
  );
}
