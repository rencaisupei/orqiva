import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar, Button, Chip, Typography } from 'heroui-native';
import { router } from 'expo-router';
import {
  Bell,
  ChevronRight,
  FileLock2,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store as StoreIcon,
} from 'lucide-react-native';

import { SignInRequired } from '@/components/SignInRequired';
import { useMyStoreQuery } from '@/lib/api/seller';
import { BRAND, BRAND_COPY } from '@/lib/brand';
import { formatDate } from '@/lib/format';
import { useIsAdminConsole, useSessionStore, useUserId } from '@/lib/session';

function MenuRow({
  icon,
  title,
  onPress,
  danger = false,
}: {
  icon: ReactNode;
  title: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable className="flex-row items-center gap-3 px-4 py-3.5" onPress={onPress}>
      <View className="bg-brand-blue-soft h-9 w-9 items-center justify-center rounded-xl">
        {icon}
      </View>
      <Typography type="body" className={danger ? 'text-danger flex-1' : 'text-navy flex-1'}>
        {title}
      </Typography>
      <ChevronRight size={18} color={BRAND.muted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const userId = useUserId();
  const account = useSessionStore((s) => s.account);
  const profile = useSessionStore((s) => s.profile);
  const signOut = useSessionStore((s) => s.signOut);
  const showAdmin = useIsAdminConsole();
  const { data: store } = useMyStoreQuery(userId);

  if (!userId) {
    return (
      <View className="bg-background pt-safe flex-1">
        <SignInRequired title="登入極貨網" description={BRAND_COPY.subTagline} />
      </View>
    );
  }

  const roles = account?.roles ?? ['buyer'];

  return (
    <View className="bg-background flex-1">
      <ScrollView contentContainerClassName="pb-10">
        <View className="bg-surface pt-safe px-4 pb-5">
          <View className="flex-row items-center gap-3 pt-4">
            <Avatar size="lg" alt={profile?.display_name ?? '會員'}>
              {profile?.avatar_url ? <Avatar.Image source={{ uri: profile.avatar_url }} /> : null}
              <Avatar.Fallback />
            </Avatar>
            <View className="flex-1">
              <Typography type="h5" className="text-navy" style={{ fontWeight: '700' }}>
                {profile?.display_name ?? '極貨網用戶'}
              </Typography>
              <Typography type="body-sm" color="muted">
                {account?.email ?? ''}
              </Typography>
              <Typography type="body-xs" color="muted">
                加入時間 {formatDate(account?.created_at)}
              </Typography>
            </View>
          </View>

          <View className="mt-3 flex-row flex-wrap gap-2">
            {roles.includes('buyer') ? (
              <Chip size="sm" variant="soft" color="accent">
                買家
              </Chip>
            ) : null}
            {roles.includes('seller') ? (
              <Chip size="sm" variant="soft" color="warning">
                賣家
              </Chip>
            ) : null}
            {roles.includes('admin') ? (
              <Chip size="sm" variant="soft" color="success">
                管理員
              </Chip>
            ) : null}
          </View>

          <Button
            variant="secondary"
            size="sm"
            className="mt-4 self-start"
            onPress={() => router.push('/profile/edit')}
          >
            <Button.Label>編輯個人資料</Button.Label>
          </Button>
        </View>

        <View className="bg-surface mx-4 mt-3 overflow-hidden rounded-2xl">
          <MenuRow
            icon={<Receipt size={18} color={BRAND.blue} />}
            title="我的訂單"
            onPress={() => router.push('/orders')}
          />
          <MenuRow
            icon={<Heart size={18} color={BRAND.blue} />}
            title="我的收藏"
            onPress={() => router.push('/favorites')}
          />
          <MenuRow
            icon={<ShoppingCart size={18} color={BRAND.blue} />}
            title="購物車"
            onPress={() => router.push('/cart')}
          />
          <MenuRow
            icon={<Bell size={18} color={BRAND.blue} />}
            title="通知中心"
            onPress={() => router.push('/notifications')}
          />
        </View>

        <View className="bg-surface mx-4 mt-3 overflow-hidden rounded-2xl">
          {store ? (
            <>
              <MenuRow
                icon={<LayoutDashboard size={18} color={BRAND.blue} />}
                title="賣家中心"
                onPress={() => router.push('/seller')}
              />
              <MenuRow
                icon={<Settings size={18} color={BRAND.blue} />}
                title="店舖設定"
                onPress={() => router.push('/seller/store')}
              />
            </>
          ) : (
            <MenuRow
              icon={<StoreIcon size={18} color={BRAND.blue} />}
              title="申請成為賣家"
              onPress={() => router.push('/seller/onboarding')}
            />
          )}
          {showAdmin ? (
            <MenuRow
              icon={<ShieldCheck size={18} color={BRAND.blue} />}
              title="平台管理"
              onPress={() => router.push('/admin')}
            />
          ) : null}
        </View>

        <View className="bg-surface mx-4 mt-3 overflow-hidden rounded-2xl">
          <MenuRow
            icon={<LifeBuoy size={18} color={BRAND.blue} />}
            title="聯絡我們"
            onPress={() => router.push('/support/contact')}
          />
          <MenuRow
            icon={<FileLock2 size={18} color={BRAND.blue} />}
            title="隱私權政策"
            onPress={() => router.push('/legal/privacy')}
          />
        </View>

        <View className="bg-surface mx-4 mt-3 overflow-hidden rounded-2xl">
          <MenuRow
            icon={<LogOut size={18} color={BRAND.blue} />}
            title="登出"
            danger
            onPress={() => void signOut()}
          />
        </View>

        <View className="mt-6 items-center">
          <Typography type="body-xs" color="muted">
            {BRAND_COPY.nameZh} {BRAND_COPY.name} · {BRAND_COPY.slogan}
          </Typography>
        </View>
      </ScrollView>
    </View>
  );
}
