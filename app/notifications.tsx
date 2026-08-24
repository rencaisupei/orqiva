import { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, View } from 'react-native';
import { Button, Separator, Spinner, Switch, Typography, useToast } from 'heroui-native';
import {
  BellRing,
  CheckCircle2,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  PackageCheck,
  Receipt,
  Settings2,
  ShieldCheck,
  Store as StoreIcon,
  TrendingDown,
  Truck,
} from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { PushDiagnosticsCard } from '@/components/PushDiagnosticsCard';
import { SignInRequired } from '@/components/SignInRequired';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import {
  useMarkNotificationsRead,
  useNotificationPrefs,
  useNotifications,
  useUpdateNotificationPrefs,
} from '@/lib/api/social';
import { BRAND } from '@/lib/brand';
import { relativeTime } from '@/lib/format';
import { openNotificationLink } from '@/lib/push';
import { setAppBadgeCount } from '@/lib/pushToken';
import { useUserId } from '@/lib/session';
import { COIN_NAME, type NotificationPrefs, type NotificationType } from '@/lib/types';

function iconFor(type: NotificationType) {
  switch (type) {
    case 'new_order':
      return <Receipt size={18} color={BRAND.blue} />;
    case 'order_status':
      return <PackageCheck size={18} color={BRAND.blue} />;
    case 'logistics':
      return <Truck size={18} color={BRAND.blue} />;
    case 'message':
      return <MessageCircle size={18} color={BRAND.blue} />;
    case 'moderation':
      return <ShieldCheck size={18} color={BRAND.blue} />;
    case 'support':
      return <LifeBuoy size={18} color={BRAND.blue} />;
    case 'seller_reply':
      return <StoreIcon size={18} color={BRAND.blue} />;
    case 'product_sold':
      return <CheckCircle2 size={18} color={BRAND.blue} />;
    case 'product_published':
      return <Megaphone size={18} color={BRAND.blue} />;
    case 'price_drop':
      return <TrendingDown size={18} color={BRAND.orange} />;
    default:
      return <BellRing size={18} color={BRAND.blue} />;
  }
}

const PREF_ROWS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: 'notify_messages', label: '新訊息', hint: '買家或賣家傳訊息時推播' },
  { key: 'notify_orders', label: '訂單與物流', hint: '成立、付款、出貨、到店可取貨' },
  { key: 'notify_moderation', label: '審核結果', hint: '商品通過或需要修正時通知' },
  {
    key: 'notify_coins',
    label: `${COIN_NAME}簽到`,
    hint: `每天提醒領${COIN_NAME}、入帳時通知（賣家）`,
  },
  { key: 'notify_price_drop', label: '收藏降價', hint: '收藏清單裡的商品降價時通知' },
];

export default function NotificationsScreen() {
  const userId = useUserId();
  const { toast } = useToast();
  const { data: notifications, isLoading } = useNotifications(userId);
  const { data: prefs } = useNotificationPrefs(userId);
  const markRead = useMarkNotificationsRead();
  const updatePrefs = useUpdateNotificationPrefs();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { refreshing, onRefresh } = usePullToRefresh();

  const unread = (notifications ?? []).filter((n) => !n.read).length;

  // Keep the iOS/Android app icon badge in step with the unread list.
  useEffect(() => {
    if (!notifications) return;
    void setAppBadgeCount(unread);
  }, [notifications, unread]);

  if (!userId) {
    return <SignInRequired title="登入後查看通知" />;
  }

  const unreadCount = unread;

  // The panel scrolls with the list: on a phone the preference rows plus the
  // diagnostics card are taller than the fixed header can afford.
  const settingsPanel = (
    <View className="gap-3 pb-1">
      <View className="bg-surface gap-3 rounded-2xl p-3">
        {PREF_ROWS.map((row) => (
          <View key={row.key} className="flex-row items-center gap-3">
            <View className="flex-1">
              <Typography type="body-sm" className="text-navy">
                {row.label}
              </Typography>
              <Typography type="body-xs" color="muted">
                {row.hint}
              </Typography>
            </View>
            <Switch
              isSelected={prefs?.[row.key] ?? true}
              onSelectedChange={(value) =>
                updatePrefs.mutate(
                  { userId, patch: { [row.key]: value } },
                  {
                    onError: (error: Error) =>
                      toast.show({ variant: 'danger', label: error.message }),
                  },
                )
              }
            />
          </View>
        ))}
        <Separator />
        <Typography type="body-xs" color="muted">
          {Platform.OS === 'web'
            ? '推播通知需要在 iOS 或 Android App 上開啟；網頁版只會顯示站內通知。'
            : '關閉後仍會保留站內通知，只是不會再跳出手機推播。'}
        </Typography>
      </View>

      <PushDiagnosticsCard />
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <View className="bg-surface gap-3 px-4 py-3">
        <View className="flex-row items-center justify-between gap-3">
          <Typography type="body-sm" color="muted" className="flex-1">
            {unreadCount > 0 ? `${unreadCount} 則未讀通知` : '沒有未讀通知'}
          </Typography>
          {unreadCount > 0 ? (
            <Button size="sm" variant="secondary" onPress={() => markRead.mutate({ userId })}>
              <Button.Label>全部已讀</Button.Label>
            </Button>
          ) : null}
          <Button size="sm" variant="tertiary" onPress={() => setSettingsOpen((v) => !v)}>
            <View className="flex-row items-center gap-1.5">
              <Settings2 size={14} color={BRAND.navy} />
              <Typography type="body-sm" className="text-navy">
                推播設定
              </Typography>
            </View>
          </Button>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (
        <FlatList
          data={notifications ?? []}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 gap-2.5 pb-10"
          ListHeaderComponent={settingsOpen ? settingsPanel : null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BRAND.blue}
              colors={[BRAND.blue]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<BellRing size={26} color={BRAND.blue} />}
              title="目前沒有通知"
              description="訂單、物流、訊息與審核結果的通知會顯示在這裡。"
            />
          }
          renderItem={({ item }) => (
            <Pressable
              className="bg-surface flex-row gap-3 rounded-2xl p-4"
              onPress={() => {
                if (!item.read) markRead.mutate({ userId, id: item.id });
                openNotificationLink(item.link);
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
