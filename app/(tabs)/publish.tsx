import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import {
  BadgeCheck,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  PackagePlus,
  Store as StoreIcon,
} from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { SignInRequired } from '@/components/SignInRequired';
import { useMyStoreQuery } from '@/lib/api/seller';
import { BRAND } from '@/lib/brand';
import { useSessionStore, useUserId } from '@/lib/session';

type ActionProps = {
  icon: ReactNode;
  title: string;
  description: string;
  onPress: () => void;
  highlighted?: boolean;
};

function ActionRow({ icon, title, description, onPress, highlighted = false }: ActionProps) {
  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-2xl p-4"
      style={{ backgroundColor: highlighted ? BRAND.orange : BRAND.white }}
      onPress={onPress}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: highlighted ? 'rgba(255,255,255,0.22)' : BRAND.blueSoft }}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Typography
          type="body"
          className={highlighted ? 'text-white' : 'text-navy'}
          style={{ fontWeight: '600' }}
        >
          {title}
        </Typography>
        <Typography type="body-xs" className={highlighted ? 'text-white/80' : 'text-muted'}>
          {description}
        </Typography>
      </View>
      <ChevronRight size={18} color={highlighted ? BRAND.white : BRAND.muted} />
    </Pressable>
  );
}

export default function PublishScreen() {
  const ready = useSessionStore((s) => s.ready);
  const userId = useUserId();
  const { data: store, isLoading } = useMyStoreQuery(userId);

  if (!ready) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (!userId) {
    return (
      <View className="bg-background pt-safe flex-1">
        <SignInRequired
          title="登入後即可發布商品"
          description="同一個極貨網帳號可以同時是買家與賣家"
        />
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <View className="bg-surface pt-safe px-4 pb-3">
        <View className="pt-2">
          <Typography type="h4" className="text-navy" style={{ fontWeight: '700' }}>
            發布
          </Typography>
          <Typography type="body-sm" color="muted">
            上架商品、管理訂單，都在這裡
          </Typography>
        </View>
      </View>

      <ScrollView contentContainerClassName="p-4 gap-3 pb-10">
        {isLoading ? (
          <View className="py-10">
            <Spinner />
          </View>
        ) : store ? (
          <>
            <View className="bg-surface rounded-2xl p-4">
              <View className="flex-row items-center gap-2">
                <BadgeCheck size={18} color={BRAND.blue} />
                <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                  {store.name}
                </Typography>
              </View>
              <Typography type="body-sm" color="muted" className="mt-1">
                {store.description || '尚未填寫店舖介紹'}
              </Typography>
            </View>

            <ActionRow
              highlighted
              icon={<PackagePlus size={20} color={BRAND.white} />}
              title="新增商品"
              description="9 個步驟完成上架"
              onPress={() => router.push('/seller/new-product')}
            />
            <ActionRow
              icon={<LayoutDashboard size={20} color={BRAND.blue} />}
              title="賣家中心"
              description="今日瀏覽、訂單與營收"
              onPress={() => router.push('/seller')}
            />
            <ActionRow
              icon={<ClipboardList size={20} color={BRAND.blue} />}
              title="商品管理"
              description="修改價格、庫存與上下架"
              onPress={() => router.push('/seller/products')}
            />
            <ActionRow
              icon={<StoreIcon size={20} color={BRAND.blue} />}
              title="店舖設定"
              description="店舖名稱、Logo 與介紹"
              onPress={() => router.push('/seller/store')}
            />
          </>
        ) : (
          <EmptyState
            icon={<StoreIcon size={26} color={BRAND.blue} />}
            title="還沒有極貨網店舖"
            description="建立店舖後就可以上架商品、接收訂單與回覆買家訊息。"
            action={
              <Button onPress={() => router.push('/seller/onboarding')}>
                <Button.Label>申請成為賣家</Button.Label>
              </Button>
            }
          />
        )}
      </ScrollView>
    </View>
  );
}
