import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { CalendarClock, Megaphone, RefreshCw, Wrench } from 'lucide-react-native';

import { JihuoLogo } from '@/components/brand/JihuoLogo';
import { useAppSettings, useMaintenanceState } from '@/lib/api/system';
import { BRAND } from '@/lib/brand';
import { durationUntil, formatDateTime } from '@/lib/format';
import { useIsAdmin, useIsSignedIn } from '@/lib/session';
import { useOtaUpdates } from '@/lib/updates';

/** Full-screen takeover shown to everyone except administrators. */
function MaintenanceScreen({
  title,
  message,
  eta,
  isChecking,
  onRetry,
  onAdminSignIn,
}: {
  title: string;
  message: string;
  eta: string | null;
  isChecking: boolean;
  onRetry: () => void;
  onAdminSignIn: () => void;
}) {
  return (
    <View className="bg-background pt-safe absolute inset-0 z-50 items-center justify-center gap-5 px-6">
      <JihuoLogo />
      <View className="bg-brand-blue-soft h-16 w-16 items-center justify-center rounded-2xl">
        <Wrench size={28} color={BRAND.blue} />
      </View>
      <View className="gap-2">
        <Typography type="h4" className="text-navy text-center" style={{ fontWeight: '700' }}>
          {title}
        </Typography>
        <Typography type="body-sm" color="muted" className="text-center">
          {message}
        </Typography>
        {eta ? (
          <View className="bg-surface mt-1 flex-row items-center justify-center gap-2 rounded-2xl px-3 py-2">
            <CalendarClock size={16} color={BRAND.blue} />
            <Typography type="body-xs" className="text-navy">
              {eta}
            </Typography>
          </View>
        ) : null}
      </View>
      <View className="w-full max-w-80 gap-2">
        <Button isDisabled={isChecking} onPress={onRetry}>
          <Button.Label>{isChecking ? '檢查中…' : '重新檢查'}</Button.Label>
        </Button>
        <Button variant="tertiary" onPress={onAdminSignIn}>
          <Button.Label>我是管理員，前往登入</Button.Label>
        </Button>
      </View>
    </View>
  );
}

/**
 * Wraps the whole navigation tree:
 * - blocks the app while maintenance is on — either the manual switch or an
 *   automatic scheduled window, which starts and lifts itself on time,
 * - warns everyone shortly before a scheduled window begins,
 * - shows the platform announcement banner,
 * - offers a restart once a downloaded OTA update is waiting.
 *
 * The children stay mounted underneath the takeover so an admin can still walk
 * through the sign-in screen and switch maintenance back off.
 */
export function SystemGate({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { data: settings, refetch, isFetching } = useAppSettings();
  const maintenance = useMaintenanceState();
  const isAdmin = useIsAdmin();
  const isSignedIn = useIsSignedIn();
  const ota = useOtaUpdates();

  const [signInEscape, setSignInEscape] = useState(false);
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState<string | null>(null);
  const [dismissedNotice, setDismissedNotice] = useState<string | null>(null);

  const active = maintenance.active;

  useEffect(() => {
    if (!active) setSignInEscape(false);
  }, [active]);

  // A non-admin who finished signing in gets the takeover back.
  useEffect(() => {
    if (isSignedIn && !isAdmin) setSignInEscape(false);
  }, [isSignedIn, isAdmin]);

  const announcement = settings?.announcement_message?.trim() ?? '';
  const showAnnouncement =
    settings?.announcement_enabled === true &&
    announcement.length > 0 &&
    dismissedAnnouncement !== announcement;

  const showNotice = maintenance.upcoming && dismissedNotice !== maintenance.startsAt;

  const blocked = active && !isAdmin && !signInEscape;
  const bannerBottom = insets.bottom + (Platform.OS === 'web' ? 72 : 64);

  const eta = maintenance.endsAt
    ? `預計 ${formatDateTime(maintenance.endsAt)} 恢復服務（約 ${durationUntil(maintenance.endsAt, maintenance.now)}後）`
    : null;

  const adminReminder =
    maintenance.source === 'schedule'
      ? `排程維護進行中${maintenance.endsAt ? `，${formatDateTime(maintenance.endsAt)} 自動解除` : ''}。`
      : '維護模式已開啟，一般使用者目前無法使用 App。';

  return (
    <View className="flex-1">
      {children}

      {blocked ? null : (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 12, right: 12, bottom: bannerBottom, zIndex: 40 }}
          className="gap-2"
        >
          {active && isAdmin ? (
            <View className="border-brand-orange bg-surface flex-row items-center gap-3 rounded-2xl border p-3 shadow-lg">
              <Wrench size={18} color={BRAND.orange} />
              <Typography type="body-xs" className="text-navy flex-1">
                {adminReminder}
              </Typography>
              {Platform.OS === 'web' ? (
                <Button size="sm" variant="tertiary" onPress={() => router.push('/admin')}>
                  <Button.Label>前往設定</Button.Label>
                </Button>
              ) : null}
            </View>
          ) : null}

          {showNotice ? (
            <View className="border-border bg-surface flex-row items-center gap-3 rounded-2xl border p-3 shadow-lg">
              <CalendarClock size={18} color={BRAND.orange} />
              <View className="flex-1">
                <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
                  {durationUntil(maintenance.startsAt, maintenance.now)}後進行系統維護
                </Typography>
                <Typography type="body-xs" color="muted">
                  {formatDateTime(maintenance.startsAt)}
                  {maintenance.endsAt ? ` ~ ${formatDateTime(maintenance.endsAt)}` : ' 起'}
                  ，期間將暫停下單，請先完成手上的操作。
                </Typography>
              </View>
              <Button
                size="sm"
                variant="tertiary"
                onPress={() => setDismissedNotice(maintenance.startsAt)}
              >
                <Button.Label>知道了</Button.Label>
              </Button>
            </View>
          ) : null}

          {showAnnouncement ? (
            <View className="border-border bg-surface flex-row items-center gap-3 rounded-2xl border p-3 shadow-lg">
              <Megaphone size={18} color={BRAND.blue} />
              <Typography type="body-xs" className="text-navy flex-1">
                {announcement}
              </Typography>
              <Button
                size="sm"
                variant="tertiary"
                onPress={() => setDismissedAnnouncement(announcement)}
              >
                <Button.Label>知道了</Button.Label>
              </Button>
            </View>
          ) : null}

          {ota.isReady ? (
            <View className="border-border bg-surface flex-row items-center gap-3 rounded-2xl border p-3 shadow-lg">
              <RefreshCw size={18} color={BRAND.blue} />
              <View className="flex-1">
                <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
                  已下載新版本
                </Typography>
                <Typography type="body-xs" color="muted">
                  重新啟動即可套用最新功能與修正。
                </Typography>
              </View>
              <Button size="sm" onPress={ota.restart}>
                <Button.Label>重新啟動</Button.Label>
              </Button>
            </View>
          ) : null}
        </View>
      )}

      {blocked ? (
        <MaintenanceScreen
          title={maintenance.title}
          message={maintenance.message}
          eta={eta}
          isChecking={isFetching}
          onRetry={() => void refetch()}
          onAdminSignIn={() => {
            setSignInEscape(true);
            router.push('/auth/sign-in');
          }}
        />
      ) : null}
    </View>
  );
}
