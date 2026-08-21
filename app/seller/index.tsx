import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Separator, Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import {
  ClipboardList,
  Eye,
  Package,
  PackagePlus,
  Receipt,
  Store as StoreIcon,
  Wallet,
} from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { SignInRequired } from '@/components/SignInRequired';
import { useMyStoreQuery, useSellerDashboard } from '@/lib/api/seller';
import { BRAND } from '@/lib/brand';
import { formatCompact, formatNumber, formatPrice } from '@/lib/format';
import { useUserId } from '@/lib/session';

function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <View
      className="min-w-[46%] flex-1 gap-1.5 rounded-2xl p-4"
      style={{ backgroundColor: accent ? BRAND.navy : BRAND.white }}
    >
      <View className="flex-row items-center gap-2">
        {icon}
        <Typography type="body-xs" className={accent ? 'text-white/75' : 'text-muted'}>
          {label}
        </Typography>
      </View>
      <Typography
        type="h5"
        className={accent ? 'text-white' : 'text-navy'}
        style={{ fontWeight: '700' }}
      >
        {value}
      </Typography>
    </View>
  );
}

export default function SellerDashboardScreen() {
  const userId = useUserId();
  const { data: store, isLoading: storeLoading } = useMyStoreQuery(userId);
  const { data: stats, isLoading: statsLoading } = useSellerDashboard(userId, store?.id ?? null);

  if (!userId) {
    return <SignInRequired title="登入後進入賣家中心" />;
  }

  if (storeLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (!store) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          icon={<StoreIcon size={26} color={BRAND.blue} />}
          title="還沒有 ORQIVA 店舖"
          description="建立店舖後就能查看銷售數據與訂單。"
          action={
            <Button onPress={() => router.replace('/seller/onboarding')}>
              <Button.Label>申請成為賣家</Button.Label>
            </Button>
          }
        />
      </View>
    );
  }

  const maxRevenue = Math.max(1, ...(stats?.trend ?? []).map((t) => t.revenue));

  return (
    <View className="bg-background flex-1">
      <ScrollView contentContainerClassName="p-4 gap-3 pb-10">
        <View className="bg-surface gap-1 rounded-2xl p-4">
          <Typography type="body-xs" color="muted">
            賣家中心
          </Typography>
          <Typography type="h5" className="text-navy" style={{ fontWeight: '700' }}>
            {store.name}
          </Typography>
          <Typography type="body-xs" color="muted">
            {store.location} · 評價 {Number(store.rating).toFixed(1)}（{store.rating_count}）
          </Typography>
        </View>

        {statsLoading ? (
          <View className="py-8">
            <Spinner />
          </View>
        ) : (
          <>
            <View className="flex-row flex-wrap gap-3">
              <StatCard
                accent
                label="今日營收"
                value={formatPrice(stats?.todayRevenue ?? 0)}
                icon={<Wallet size={15} color={BRAND.white} />}
              />
              <StatCard
                label="本月營收"
                value={formatPrice(stats?.monthRevenue ?? 0)}
                icon={<Wallet size={15} color={BRAND.blue} />}
              />
              <StatCard
                label="今日瀏覽"
                value={formatCompact(stats?.todayViews ?? 0)}
                icon={<Eye size={15} color={BRAND.blue} />}
              />
              <StatCard
                label="今日訂單"
                value={formatNumber(stats?.todayOrders ?? 0)}
                icon={<Receipt size={15} color={BRAND.blue} />}
              />
              <StatCard
                label="商品數量"
                value={formatNumber(stats?.productCount ?? 0)}
                icon={<Package size={15} color={BRAND.blue} />}
              />
              <StatCard
                label="待處理訂單"
                value={formatNumber(stats?.pendingOrders ?? 0)}
                icon={<ClipboardList size={15} color={BRAND.orange} />}
              />
            </View>

            <View className="bg-surface gap-3 rounded-2xl p-4">
              <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                近 7 日銷售趨勢
              </Typography>
              <View className="h-32 flex-row items-end gap-2">
                {(stats?.trend ?? []).map((point) => (
                  <View key={point.date} className="flex-1 items-center gap-1">
                    <View
                      className="w-full rounded-t-md"
                      style={{
                        height: Math.max(4, (point.revenue / maxRevenue) * 96),
                        backgroundColor: point.revenue > 0 ? BRAND.blue : BRAND.border,
                      }}
                    />
                    <Typography type="body-xs" color="muted" style={{ fontSize: 9 }}>
                      {point.date}
                    </Typography>
                  </View>
                ))}
              </View>
            </View>

            <View className="bg-surface gap-3 rounded-2xl p-4">
              <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                熱門商品
              </Typography>
              {(stats?.topProducts ?? []).length === 0 ? (
                <Typography type="body-sm" color="muted">
                  還沒有商品，先上架第一件商品吧。
                </Typography>
              ) : (
                (stats?.topProducts ?? []).map((product) => (
                  <Pressable
                    key={product.id}
                    className="flex-row items-center gap-3"
                    onPress={() =>
                      router.push({ pathname: '/products/[id]', params: { id: product.id } })
                    }
                  >
                    <AppImage uri={product.cover_url} className="h-12 w-12 rounded-xl" />
                    <View className="flex-1">
                      <Typography type="body-sm" numberOfLines={1} className="text-navy">
                        {product.title}
                      </Typography>
                      <Typography type="body-xs" color="muted">
                        已售 {product.sold_count} · 庫存 {product.stock} · 瀏覽 {product.view_count}
                      </Typography>
                    </View>
                    <Typography
                      type="body-sm"
                      className="text-brand-orange"
                      style={{ fontWeight: '600' }}
                    >
                      {formatPrice(product.price)}
                    </Typography>
                  </Pressable>
                ))
              )}
            </View>
          </>
        )}

        <View className="bg-surface gap-2 rounded-2xl p-4">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            快速操作
          </Typography>
          <Separator />
          <Button className="mt-1" onPress={() => router.push('/seller/new-product')}>
            <View className="flex-row items-center gap-2">
              <PackagePlus size={16} color={BRAND.white} />
              <Typography type="body-sm" className="text-white" style={{ fontWeight: '600' }}>
                新增商品
              </Typography>
            </View>
          </Button>
          <Button variant="secondary" onPress={() => router.push('/seller/products')}>
            <Button.Label>商品管理</Button.Label>
          </Button>
          <Button variant="secondary" onPress={() => router.push('/seller/orders')}>
            <Button.Label>訂單管理</Button.Label>
          </Button>
          <Button variant="secondary" onPress={() => router.push('/seller/store')}>
            <Button.Label>店舖設定</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
