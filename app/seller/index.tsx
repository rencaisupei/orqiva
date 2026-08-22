import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Spinner, Typography } from 'heroui-native';
import { router, type Href } from 'expo-router';
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  MessageCircle,
  Package,
  Plus,
  Settings,
  Store as StoreIcon,
} from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { JihuoBadge } from '@/components/brand/JihuoLogo';
import { SellerLogisticsStatusCard } from '@/components/SellerLogisticsStatusCard';
import { SellerStatTile } from '@/components/SellerStatTile';
import { SellerTabBar } from '@/components/SellerTabBar';
import { SignInRequired } from '@/components/SignInRequired';
import { LinearGradient } from '@/components/ui/primitives/LinearGradient';
import { useMyStoreQuery, useSellerDashboard, useSellerShippingProfile } from '@/lib/api/seller';
import { BRAND } from '@/lib/brand';
import { formatCompact, formatNumber, formatPrice } from '@/lib/format';
import { useUserId } from '@/lib/session';

type MenuRowProps = {
  icon: ReactNode;
  iconBg: string;
  label: string;
  badge?: number;
  href: Href;
};

function MenuRow({ icon, iconBg, label, badge, href }: MenuRowProps) {
  return (
    <Pressable
      className="bg-surface flex-row items-center gap-3 rounded-2xl px-4 py-3.5"
      style={{
        shadowColor: 'rgba(8, 38, 107, 0.08)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 1,
      }}
      onPress={() => router.push(href)}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </View>
      <Typography type="body" className="text-navy flex-1" style={{ fontWeight: '600' }}>
        {label}
      </Typography>
      {badge && badge > 0 ? (
        <View className="bg-brand-orange min-w-6 items-center rounded-full px-2 py-0.5">
          <Typography type="body-xs" className="text-white" style={{ fontWeight: '700' }}>
            {badge > 99 ? '99+' : badge}
          </Typography>
        </View>
      ) : null}
      <ChevronRight size={18} color={BRAND.muted} />
    </Pressable>
  );
}

export default function SellerDashboardScreen() {
  const userId = useUserId();
  const { data: store, isLoading: storeLoading } = useMyStoreQuery(userId);
  const { data: stats, isLoading: statsLoading } = useSellerDashboard(userId, store?.id ?? null);
  const { data: shippingProfile, isLoading: shippingLoading } = useSellerShippingProfile(userId);

  if (!userId) {
    return (
      <View className="bg-background pt-safe flex-1">
        <SignInRequired title="登入後進入賣家中心" />
      </View>
    );
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
      <View className="bg-background pt-safe flex-1">
        <EmptyState
          icon={<StoreIcon size={26} color={BRAND.blue} />}
          title="還沒有極貨網店舖"
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

  return (
    <View className="bg-background flex-1">
      <View className="bg-surface pt-safe px-4 pb-3">
        <View className="flex-row items-center gap-3 pt-2">
          <JihuoBadge size={42} />
          <View className="flex-1">
            <Typography type="h5" className="text-navy" style={{ fontWeight: '700' }}>
              賣家中心
            </Typography>
            <Typography type="body-xs" color="muted" numberOfLines={1}>
              {store.name} · 評價 {store.rating.toFixed(1)}（{store.rating_count}）
            </Typography>
          </View>
          <Pressable
            className="h-10 w-10 items-center justify-center"
            accessibilityLabel="店舖設定"
            onPress={() => router.push('/seller/store')}
          >
            <Settings size={22} color={BRAND.navy} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-3 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {!shippingLoading ? <SellerLogisticsStatusCard profile={shippingProfile} /> : null}

        <Typography type="h6" className="text-navy" style={{ fontWeight: '700' }}>
          今日數據
        </Typography>

        {statsLoading ? (
          <View className="py-8">
            <Spinner />
          </View>
        ) : (
          <>
            <View className="flex-row gap-2">
              <SellerStatTile
                label="瀏覽數"
                value={formatCompact(stats?.todayViews ?? 0)}
                delta={stats?.viewsDelta ?? null}
              />
              <SellerStatTile
                label="訂單數"
                value={formatNumber(stats?.todayOrders ?? 0)}
                delta={stats?.ordersDelta ?? null}
              />
              <SellerStatTile
                label="營收"
                value={formatPrice(stats?.todayRevenue ?? 0)}
                delta={stats?.revenueDelta ?? null}
              />
            </View>

            <View className="bg-surface flex-row items-center justify-between rounded-2xl px-4 py-3">
              <View>
                <Typography type="body-xs" color="muted">
                  本月營收
                </Typography>
                <Typography type="body" className="text-navy" style={{ fontWeight: '700' }}>
                  {formatPrice(stats?.monthRevenue ?? 0)}
                </Typography>
              </View>
              <View className="items-end">
                <Typography type="body-xs" color="muted">
                  商品 / 待處理訂單
                </Typography>
                <Typography type="body" className="text-navy" style={{ fontWeight: '700' }}>
                  {formatNumber(stats?.productCount ?? 0)} /{' '}
                  {formatNumber(stats?.pendingOrders ?? 0)}
                </Typography>
              </View>
            </View>
          </>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="新增商品"
          onPress={() => router.push('/seller/new-product')}
        >
          <LinearGradient
            colors={[BRAND.yellow, BRAND.orange]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="flex-row items-center justify-center gap-2 rounded-2xl py-4"
          >
            <Plus size={20} color={BRAND.white} strokeWidth={2.8} />
            <Typography type="body" className="text-white" style={{ fontWeight: '700' }}>
              新增商品
            </Typography>
          </LinearGradient>
        </Pressable>

        <View className="gap-2.5">
          <MenuRow
            icon={<Package size={18} color={BRAND.blue} />}
            iconBg={BRAND.blueSoft}
            label="商品管理"
            href="/seller/products"
          />
          <MenuRow
            icon={<ClipboardList size={18} color={BRAND.orange} />}
            iconBg={BRAND.orangeSoft}
            label="訂單管理"
            badge={stats?.pendingOrders ?? 0}
            href="/seller/orders"
          />
          <MenuRow
            icon={<BarChart3 size={18} color={BRAND.blue} />}
            iconBg={BRAND.blueSoft}
            label="銷售分析"
            href="/seller/analytics"
          />
          <MenuRow
            icon={<MessageCircle size={18} color={BRAND.blue} />}
            iconBg={BRAND.blueSoft}
            label="買家訊息"
            href="/(tabs)/messages"
          />
          <MenuRow
            icon={<StoreIcon size={18} color={BRAND.navy} />}
            iconBg={BRAND.blueSoft}
            label="店舖設定"
            href="/seller/store"
          />
        </View>
      </ScrollView>

      <SellerTabBar />
    </View>
  );
}
