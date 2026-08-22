import { useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Button, Chip, Spinner, Typography, useToast } from 'heroui-native';
import { router } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { LogisticsPanel } from '@/components/LogisticsPanel';
import { SelectPill } from '@/components/SelectPill';
import { SellerTabBar } from '@/components/SellerTabBar';
import { SignInRequired } from '@/components/SignInRequired';
import { useSetOrderStatus } from '@/lib/api/commerce';
import { useSellerOrders } from '@/lib/api/seller';
import { BRAND } from '@/lib/brand';
import { formatDateTime, formatPrice } from '@/lib/format';
import { useUserId } from '@/lib/session';
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/lib/types';

const FILTERS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待付款' },
  { key: 'paid', label: '備貨中' },
  { key: 'shipped', label: '已出貨' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
];

export default function SellerOrdersScreen() {
  const userId = useUserId();
  const { toast } = useToast();
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const { data: orders, isLoading } = useSellerOrders(userId);
  const setStatus = useSetOrderStatus();

  if (!userId) {
    return <SignInRequired title="登入後管理訂單" />;
  }

  const filtered = (orders ?? []).filter((order) => filter === 'all' || order.status === filter);

  const advance = (orderId: string, status: string, label: string) => {
    setStatus.mutate(
      { orderId, status },
      {
        onSuccess: () => toast.show({ variant: 'success', label }),
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  return (
    <View className="bg-background flex-1">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="bg-surface">
        <View className="flex-row gap-2 px-4 py-3">
          {FILTERS.map((item) => (
            <SelectPill
              key={item.key}
              size="sm"
              label={item.label}
              selected={filter === item.key}
              onPress={() => setFilter(item.key)}
            />
          ))}
        </View>
      </ScrollView>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 gap-3 pb-6"
          ListEmptyComponent={
            <EmptyState
              icon={<ClipboardList size={26} color={BRAND.blue} />}
              title="還沒有訂單"
              description="買家下單後會出現在這裡，並發送通知給你。"
            />
          }
          renderItem={({ item }) => (
            <View className="bg-surface gap-3 rounded-2xl p-4">
              <Pressable
                className="gap-2"
                onPress={() => router.push({ pathname: '/orders/[id]', params: { id: item.id } })}
              >
                <View className="flex-row items-center justify-between gap-3">
                  <Typography
                    type="body-sm"
                    numberOfLines={1}
                    className="text-navy flex-1"
                    style={{ fontWeight: '600' }}
                  >
                    {item.order_no}
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

                {item.order_items.map((line) => (
                  <View key={line.id} className="flex-row items-center gap-3">
                    <AppImage uri={line.image_url} className="h-12 w-12 rounded-xl" />
                    <View className="flex-1">
                      <Typography type="body-sm" numberOfLines={1} className="text-navy">
                        {line.title}
                      </Typography>
                      <Typography type="body-xs" color="muted">
                        {formatPrice(line.unit_price)} × {line.quantity}
                      </Typography>
                    </View>
                  </View>
                ))}

                <View className="flex-row items-center justify-between">
                  <Typography type="body-xs" color="muted">
                    {item.recipient_name ?? ''} · {formatDateTime(item.created_at)}
                  </Typography>
                  <Typography
                    type="body"
                    className="text-brand-orange"
                    style={{ fontWeight: '700' }}
                  >
                    {formatPrice(item.total)}
                  </Typography>
                </View>
              </Pressable>

              <LogisticsPanel order={item} role="seller" />

              {item.status === 'pending' ? (
                <Button
                  size="sm"
                  isDisabled={setStatus.isPending}
                  onPress={() => advance(item.id, 'paid', '已標記為備貨中')}
                >
                  <Button.Label>確認款項，開始備貨</Button.Label>
                </Button>
              ) : null}
              {item.status === 'paid' ? (
                <Button
                  size="sm"
                  isDisabled={setStatus.isPending}
                  onPress={() => advance(item.id, 'shipped', '已標記為出貨')}
                >
                  <Button.Label>標記已出貨</Button.Label>
                </Button>
              ) : null}
              {item.status === 'pending' || item.status === 'paid' ? (
                <Button
                  size="sm"
                  variant="danger-soft"
                  isDisabled={setStatus.isPending}
                  onPress={() => advance(item.id, 'cancelled', '訂單已取消')}
                >
                  <Button.Label>取消訂單</Button.Label>
                </Button>
              ) : null}
            </View>
          )}
        />
      )}

      <SellerTabBar />
    </View>
  );
}
