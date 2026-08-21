import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar, Button, Chip, Separator, Spinner, Typography, useToast } from 'heroui-native';
import { router } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { SignInRequired } from '@/components/SignInRequired';
import {
  useAdminOrders,
  useAdminOverview,
  useAdminProducts,
  useAdminReports,
  useAdminResolveReport,
  useAdminSetProductStatus,
  useAdminSetUserSuspended,
  useAdminStores,
  useAdminUsers,
} from '@/lib/api/admin';
import { BRAND } from '@/lib/brand';
import { formatDate, formatPrice } from '@/lib/format';
import { useIsAdmin, useUserId } from '@/lib/session';
import { ORDER_STATUS_LABEL } from '@/lib/types';

type TabKey = 'overview' | 'users' | 'products' | 'stores' | 'orders' | 'reports';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '總覽' },
  { key: 'users', label: '會員' },
  { key: 'products', label: '商品' },
  { key: 'stores', label: '商店' },
  { key: 'orders', label: '訂單' },
  { key: 'reports', label: '檢舉' },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="bg-surface min-w-[46%] flex-1 gap-1 rounded-2xl p-4">
      <Typography type="body-xs" color="muted">
        {label}
      </Typography>
      <Typography type="h5" className="text-navy" style={{ fontWeight: '700' }}>
        {value}
      </Typography>
    </View>
  );
}

export default function AdminScreen() {
  const userId = useUserId();
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('overview');

  const overview = useAdminOverview(isAdmin && tab === 'overview');
  const users = useAdminUsers(isAdmin && tab === 'users');
  const products = useAdminProducts(isAdmin && tab === 'products');
  const stores = useAdminStores(isAdmin && tab === 'stores');
  const orders = useAdminOrders(isAdmin && tab === 'orders');
  const reports = useAdminReports(isAdmin && tab === 'reports');

  const setProductStatus = useAdminSetProductStatus();
  const setUserSuspended = useAdminSetUserSuspended();
  const resolveReport = useAdminResolveReport();

  if (!userId) {
    return <SignInRequired title="登入後查看平台管理" />;
  }

  if (!isAdmin) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          icon={<ShieldAlert size={26} color={BRAND.blue} />}
          title="需要管理員權限"
          description="此頁面僅開放給 admin 角色。請由資料庫將帳號的 roles 加入 admin 後再進入。"
          action={
            <Button variant="secondary" onPress={() => router.replace('/(tabs)')}>
              <Button.Label>回到首頁</Button.Label>
            </Button>
          }
        />
      </View>
    );
  }

  const loading =
    overview.isLoading ||
    users.isLoading ||
    products.isLoading ||
    stores.isLoading ||
    orders.isLoading ||
    reports.isLoading;

  return (
    <View className="bg-background flex-1">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="bg-surface">
        <View className="flex-row gap-2 px-4 py-3">
          {TABS.map((item) => (
            <Pressable key={item.key} onPress={() => setTab(item.key)}>
              <Chip size="sm" variant={tab === item.key ? 'primary' : 'tertiary'}>
                {item.label}
              </Chip>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <ScrollView contentContainerClassName="p-4 gap-3 pb-10">
        {loading ? (
          <View className="py-10">
            <Spinner />
          </View>
        ) : null}

        {tab === 'overview' && overview.data ? (
          <>
            <View className="flex-row flex-wrap gap-3">
              <Stat label="會員數" value={String(overview.data.userCount)} />
              <Stat label="商店數" value={String(overview.data.storeCount)} />
              <Stat label="商品數" value={String(overview.data.productCount)} />
              <Stat label="訂單數" value={String(overview.data.orderCount)} />
              <Stat label="平台交易總額" value={formatPrice(overview.data.gmv)} />
              <Stat label="待處理檢舉" value={String(overview.data.openReports)} />
            </View>
            <View className="bg-surface rounded-2xl p-4">
              <Typography type="body-sm" color="muted">
                極貨網平台統計即時來自資料庫，包含所有買家與賣家的交易紀錄。
              </Typography>
            </View>
          </>
        ) : null}

        {tab === 'users'
          ? (users.data ?? []).map((user) => (
              <View key={user.id} className="bg-surface gap-2 rounded-2xl p-4">
                <View className="flex-row items-center gap-3">
                  <Avatar size="sm" alt={user.profile?.display_name ?? '會員'}>
                    {user.profile?.avatar_url ? (
                      <Avatar.Image source={{ uri: user.profile.avatar_url }} />
                    ) : null}
                    <Avatar.Fallback />
                  </Avatar>
                  <View className="flex-1">
                    <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
                      {user.profile?.display_name ?? '未命名會員'}
                    </Typography>
                    <Typography type="body-xs" color="muted">
                      {user.email ?? '（未提供 Email）'} · {formatDate(user.created_at)}
                    </Typography>
                  </View>
                  {user.is_suspended ? (
                    <Chip size="sm" variant="soft" color="danger">
                      已停用
                    </Chip>
                  ) : null}
                </View>
                <View className="flex-row flex-wrap gap-1.5">
                  {user.roles.map((role) => (
                    <Chip key={role} size="sm" variant="tertiary">
                      {role}
                    </Chip>
                  ))}
                </View>
                <Button
                  size="sm"
                  variant={user.is_suspended ? 'secondary' : 'danger-soft'}
                  onPress={() =>
                    setUserSuspended.mutate(
                      { userId: user.id, suspended: !user.is_suspended },
                      {
                        onSuccess: () =>
                          toast.show({
                            variant: 'success',
                            label: user.is_suspended ? '帳號已恢復' : '帳號已停用',
                          }),
                      },
                    )
                  }
                >
                  <Button.Label>{user.is_suspended ? '恢復帳號' : '停用帳號'}</Button.Label>
                </Button>
              </View>
            ))
          : null}

        {tab === 'products'
          ? (products.data ?? []).map((product) => (
              <View key={product.id} className="bg-surface gap-2 rounded-2xl p-4">
                <Pressable
                  className="flex-row items-center gap-3"
                  onPress={() =>
                    router.push({ pathname: '/products/[id]', params: { id: product.id } })
                  }
                >
                  <AppImage uri={product.cover_url} className="h-14 w-14 rounded-xl" />
                  <View className="flex-1">
                    <Typography type="body-sm" numberOfLines={2} className="text-navy">
                      {product.title}
                    </Typography>
                    <Typography type="body-xs" color="muted">
                      {formatPrice(product.price)} · 庫存 {product.stock} · 已售{' '}
                      {product.sold_count}
                    </Typography>
                  </View>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={product.status === 'suspended' ? 'danger' : 'success'}
                  >
                    {product.status === 'active'
                      ? '上架中'
                      : product.status === 'draft'
                        ? '未上架'
                        : '已停用'}
                  </Chip>
                </Pressable>
                <Button
                  size="sm"
                  variant={product.status === 'suspended' ? 'secondary' : 'danger-soft'}
                  onPress={() =>
                    setProductStatus.mutate(
                      {
                        productId: product.id,
                        status: product.status === 'suspended' ? 'active' : 'suspended',
                      },
                      {
                        onSuccess: () =>
                          toast.show({
                            variant: 'success',
                            label: product.status === 'suspended' ? '商品已恢復' : '商品已停用',
                          }),
                      },
                    )
                  }
                >
                  <Button.Label>
                    {product.status === 'suspended' ? '恢復商品' : '停用商品'}
                  </Button.Label>
                </Button>
              </View>
            ))
          : null}

        {tab === 'stores'
          ? (stores.data ?? []).map((store) => (
              <Pressable
                key={store.id}
                className="bg-surface flex-row items-center gap-3 rounded-2xl p-4"
                onPress={() => router.push({ pathname: '/store/[id]', params: { id: store.id } })}
              >
                <Avatar size="sm" alt={store.name}>
                  {store.logo_url ? <Avatar.Image source={{ uri: store.logo_url }} /> : null}
                  <Avatar.Fallback />
                </Avatar>
                <View className="flex-1">
                  <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
                    {store.name}
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    {store.location} · 評價 {Number(store.rating).toFixed(1)}（{store.rating_count}
                    ）
                  </Typography>
                </View>
              </Pressable>
            ))
          : null}

        {tab === 'orders'
          ? (orders.data ?? []).map((order) => (
              <Pressable
                key={order.id}
                className="bg-surface gap-2 rounded-2xl p-4"
                onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })}
              >
                <View className="flex-row items-center justify-between">
                  <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
                    {order.order_no}
                  </Typography>
                  <Chip size="sm" variant="tertiary">
                    {ORDER_STATUS_LABEL[order.status]}
                  </Chip>
                </View>
                <Separator />
                <View className="flex-row items-center justify-between">
                  <Typography type="body-xs" color="muted">
                    {order.store?.name ?? '—'} · {formatDate(order.created_at)}
                  </Typography>
                  <Typography
                    type="body-sm"
                    className="text-brand-orange"
                    style={{ fontWeight: '700' }}
                  >
                    {formatPrice(order.total)}
                  </Typography>
                </View>
              </Pressable>
            ))
          : null}

        {tab === 'reports' ? (
          (reports.data ?? []).length === 0 ? (
            <EmptyState title="目前沒有檢舉" description="買家送出的檢舉會顯示在這裡。" />
          ) : (
            (reports.data ?? []).map((report) => (
              <View key={report.id} className="bg-surface gap-2 rounded-2xl p-4">
                <View className="flex-row items-center justify-between">
                  <Chip size="sm" variant="tertiary">
                    {report.target_type === 'product'
                      ? '商品'
                      : report.target_type === 'store'
                        ? '商店'
                        : '會員'}
                  </Chip>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={report.status === 'resolved' ? 'success' : 'warning'}
                  >
                    {report.status === 'resolved' ? '已處理' : '待處理'}
                  </Chip>
                </View>
                <Typography type="body-sm" className="text-navy">
                  {report.reason}
                </Typography>
                <Typography type="body-xs" color="muted">
                  {formatDate(report.created_at)}
                </Typography>
                {report.status !== 'resolved' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      resolveReport.mutate(report.id, {
                        onSuccess: () =>
                          toast.show({ variant: 'success', label: '已標記為處理完成' }),
                      })
                    }
                  >
                    <Button.Label>標記已處理</Button.Label>
                  </Button>
                ) : null}
              </View>
            ))
          )
        ) : null}
      </ScrollView>
    </View>
  );
}
