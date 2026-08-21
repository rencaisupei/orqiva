import { Pressable, ScrollView, View } from 'react-native';
import { Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { BarChart3 } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { SellerStatTile } from '@/components/SellerStatTile';
import { SellerTabBar } from '@/components/SellerTabBar';
import { SignInRequired } from '@/components/SignInRequired';
import { useMyStoreQuery, useSellerDashboard } from '@/lib/api/seller';
import { BRAND } from '@/lib/brand';
import { formatCompact, formatNumber, formatPrice } from '@/lib/format';
import { useUserId } from '@/lib/session';

export default function SellerAnalyticsScreen() {
  const userId = useUserId();
  const { data: store, isLoading: storeLoading } = useMyStoreQuery(userId);
  const { data: stats, isLoading } = useSellerDashboard(userId, store?.id ?? null);

  if (!userId) {
    return <SignInRequired title="登入後查看銷售分析" />;
  }

  if (storeLoading || isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (!store) {
    return (
      <View className="bg-background flex-1">
        <View className="flex-1">
          <EmptyState
            icon={<BarChart3 size={26} color={BRAND.blue} />}
            title="還沒有店舖數據"
            description="建立店舖並上架商品後，這裡會顯示瀏覽、訂單與營收趨勢。"
          />
        </View>
        <SellerTabBar />
      </View>
    );
  }

  const trend = stats?.trend ?? [];
  const maxRevenue = Math.max(1, ...trend.map((t) => t.revenue));
  const weekRevenue = trend.reduce((sum, t) => sum + t.revenue, 0);

  return (
    <View className="bg-background flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-3 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row gap-2">
          <SellerStatTile
            label="今日瀏覽"
            value={formatCompact(stats?.todayViews ?? 0)}
            delta={stats?.viewsDelta ?? null}
          />
          <SellerStatTile
            label="今日訂單"
            value={formatNumber(stats?.todayOrders ?? 0)}
            delta={stats?.ordersDelta ?? null}
          />
          <SellerStatTile
            label="今日營收"
            value={formatPrice(stats?.todayRevenue ?? 0)}
            delta={stats?.revenueDelta ?? null}
          />
        </View>

        <View className="bg-surface flex-row gap-3 rounded-2xl p-4">
          <View className="flex-1">
            <Typography type="body-xs" color="muted">
              近 7 日營收
            </Typography>
            <Typography type="body" className="text-navy" style={{ fontWeight: '700' }}>
              {formatPrice(weekRevenue)}
            </Typography>
          </View>
          <View className="flex-1">
            <Typography type="body-xs" color="muted">
              本月營收
            </Typography>
            <Typography type="body" className="text-navy" style={{ fontWeight: '700' }}>
              {formatPrice(stats?.monthRevenue ?? 0)}
            </Typography>
          </View>
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            近 7 日銷售趨勢
          </Typography>
          <View className="h-32 flex-row items-end gap-2">
            {trend.map((point) => (
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
      </ScrollView>

      <SellerTabBar />
    </View>
  );
}
