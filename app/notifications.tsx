import { FlatList, Pressable, View } from 'react-native';
import { Button, Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import {
  BellRing,
  CheckCircle2,
  Megaphone,
  PackageCheck,
  Receipt,
  Store as StoreIcon,
} from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { SignInRequired } from '@/components/SignInRequired';
import { useMarkNotificationsRead, useNotifications } from '@/lib/api/social';
import { BRAND } from '@/lib/brand';
import { relativeTime } from '@/lib/format';
import { useUserId } from '@/lib/session';
import type { NotificationType } from '@/lib/types';

function iconFor(type: NotificationType) {
  switch (type) {
    case 'new_order':
      return <Receipt size={18} color={BRAND.blue} />;
    case 'order_status':
      return <PackageCheck size={18} color={BRAND.blue} />;
    case 'seller_reply':
      return <StoreIcon size={18} color={BRAND.blue} />;
    case 'product_sold':
      return <CheckCircle2 size={18} color={BRAND.blue} />;
    case 'product_published':
      return <Megaphone size={18} color={BRAND.blue} />;
    default:
      return <BellRing size={18} color={BRAND.blue} />;
  }
}

function openLink(link: string | null) {
  if (!link) return;
  switch (link) {
    case '/orders':
      router.push('/orders');
      break;
    case '/seller':
      router.push('/seller');
      break;
    case '/seller/orders':
      router.push('/seller/orders');
      break;
    case '/seller/products':
      router.push('/seller/products');
      break;
    default:
      break;
  }
}

export default function NotificationsScreen() {
  const userId = useUserId();
  const { data: notifications, isLoading } = useNotifications(userId);
  const markRead = useMarkNotificationsRead();

  if (!userId) {
    return <SignInRequired title="登入後查看通知" />;
  }

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  return (
    <View className="bg-background flex-1">
      {unreadCount > 0 ? (
        <View className="bg-surface flex-row items-center justify-between px-4 py-3">
          <Typography type="body-sm" color="muted">
            {unreadCount} 則未讀通知
          </Typography>
          <Button size="sm" variant="secondary" onPress={() => markRead.mutate({ userId })}>
            <Button.Label>全部標為已讀</Button.Label>
          </Button>
        </View>
      ) : null}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (
        <FlatList
          data={notifications ?? []}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 gap-2.5 pb-10"
          ListEmptyComponent={
            <EmptyState
              icon={<BellRing size={26} color={BRAND.blue} />}
              title="目前沒有通知"
              description="訂單、上架與賣家回覆的通知會顯示在這裡。"
            />
          }
          renderItem={({ item }) => (
            <Pressable
              className="bg-surface flex-row gap-3 rounded-2xl p-4"
              onPress={() => {
                if (!item.read) markRead.mutate({ userId, id: item.id });
                openLink(item.link);
              }}
            >
              <View className="bg-brand-blue-soft h-9 w-9 items-center justify-center rounded-xl">
                {iconFor(item.type)}
              </View>
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-2">
                  <Typography
                    type="body-sm"
                    className="text-navy flex-1"
                    style={{ fontWeight: '600' }}
                  >
                    {item.title}
                  </Typography>
                  {!item.read ? <View className="bg-brand-orange h-2 w-2 rounded-full" /> : null}
                </View>
                <Typography type="body-sm" color="muted">
                  {item.body}
                </Typography>
                <Typography type="body-xs" color="muted">
                  {relativeTime(item.created_at)}
                </Typography>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
