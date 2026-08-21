import { useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Button, Chip, Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { Receipt } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { SignInRequired } from '@/components/SignInRequired';
import { useMyOrders } from '@/lib/api/commerce';
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

export default function OrdersScreen() {
  const userId = useUserId();
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const { data: orders, isLoading } = useMyOrders(userId);

  if (!userId) {
    return <SignInRequired title="登入後查看訂單" />;
  }

  const filtered = (orders ?? []).filter((order) => filter === 'all' || order.status === filter);

  return (
    <View className="bg-background flex-1">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="bg-surface">
        <View className="flex-row gap-2 px-4 py-3">
          {FILTERS.map((item) => (
            <Pressable key={item.key} onPress={() => setFilter(item.key)}>
              <Chip size="sm" variant={filter === item.key ? 'primary' : 'tertiary'}>
                {item.label}
              </Chip>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 gap-3 pb-10"
          ListEmptyComponent={
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
          }
          renderItem={({ item }) => (
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
          )}
        />
      )}
    </View>
  );
}
