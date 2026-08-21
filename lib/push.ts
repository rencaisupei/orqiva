import { useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';

import { callNotify } from '@/lib/backend';
import {
  getRegisteredPushToken,
  setRegisteredPushToken,
  unregisterPushToken,
} from '@/lib/pushToken';
import { useSessionStore } from '@/lib/session';

/** Foreground behaviour: show the banner so chat pushes are not silently swallowed. */
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

type PushPayload = { link?: string; type?: string; conversationId?: string };

function readPayload(data: unknown): PushPayload {
  if (!data || typeof data !== 'object') return {};
  const record = data as Record<string, unknown>;
  return {
    link: typeof record.link === 'string' ? record.link : undefined,
    type: typeof record.type === 'string' ? record.type : undefined,
    conversationId: typeof record.conversationId === 'string' ? record.conversationId : undefined,
  };
}

/** Maps a notification link (`/orders/<id>`, `/messages/<id>`, …) onto a typed route. */
export function openNotificationLink(link: string | null | undefined) {
  if (!link) return;

  const chat = /^\/messages\/([^/]+)$/.exec(link);
  if (chat) {
    router.push({ pathname: '/messages/[id]', params: { id: chat[1] } });
    return;
  }

  const order = /^\/orders\/([^/]+)$/.exec(link);
  if (order) {
    router.push({ pathname: '/orders/[id]', params: { id: order[1] } });
    return;
  }

  const product = /^\/products\/([^/]+)$/.exec(link);
  if (product) {
    router.push({ pathname: '/products/[id]', params: { id: product[1] } });
    return;
  }

  switch (link) {
    case '/orders':
      router.push('/orders');
      break;
    case '/cart':
      router.push('/cart');
      break;
    case '/favorites':
      router.push('/favorites');
      break;
    case '/notifications':
      router.push('/notifications');
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
    case '/admin':
      router.push('/admin');
      break;
    case '/support/contact':
      router.push('/support/contact');
      break;
    case '/legal/privacy':
      router.push('/legal/privacy');
      break;
    default:
      break;
  }
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: '極貨網通知',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#006BFF',
  });
}

function expoProjectId(): string | null {
  return (
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
    Constants.easConfig?.projectId ??
    null
  );
}

/** Asks for permission and returns the Expo push token, or null when unavailable. */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null;

  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  let granted =
    existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
  if (!granted) {
    const asked = await Notifications.requestPermissionsAsync();
    granted =
      asked.granted || asked.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
  }
  if (!granted) return null;

  const projectId = expoProjectId() ?? undefined;

  try {
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data;
  } catch {
    // Expo Go without a project id, or no network — push simply stays off.
    return null;
  }
}

/**
 * Requests permission, gets the token and attaches this device to the account.
 * Shared by the automatic registration on sign-in and the manual retry in the
 * notification settings panel.
 */
export async function enablePushOnThisDevice(): Promise<{ ok: boolean; token: string | null }> {
  const token = await getExpoPushToken();
  if (!token) return { ok: false, token: null };

  setRegisteredPushToken(token);
  try {
    await callNotify('register_token', {
      token,
      platform: Platform.OS,
      deviceName: Device.deviceName ?? Device.modelName ?? null,
    });
  } catch {
    // Registration is best-effort; in-app notifications still work.
  }
  return { ok: true, token };
}

export type PushPermissionState = 'granted' | 'denied' | 'undetermined';

export type PushDiagnostics = {
  /** Push can only ever arrive on a physical iOS/Android device. */
  supported: boolean;
  isDevice: boolean;
  isExpoGo: boolean;
  permission: PushPermissionState;
  canAskAgain: boolean;
  token: string | null;
  projectId: string | null;
  channel: { id: string; importance: string } | null;
};

const IMPORTANCE_LABEL: Record<number, string> = {
  [Notifications.AndroidImportance.UNSPECIFIED]: '未指定',
  [Notifications.AndroidImportance.NONE]: '無（不顯示）',
  [Notifications.AndroidImportance.MIN]: 'MIN（不出現在狀態列）',
  [Notifications.AndroidImportance.LOW]: 'LOW（無音效）',
  [Notifications.AndroidImportance.DEFAULT]: 'DEFAULT（有音效）',
  [Notifications.AndroidImportance.HIGH]: 'HIGH（橫幅 + 音效）',
  [Notifications.AndroidImportance.MAX]: 'MAX',
};

/** Reads the live push state of this device: permission, token, Android channel. */
export async function getPushDiagnostics(): Promise<PushDiagnostics> {
  if (Platform.OS === 'web') {
    return {
      supported: false,
      isDevice: false,
      isExpoGo: false,
      permission: 'undetermined',
      canAskAgain: false,
      token: null,
      projectId: expoProjectId(),
      channel: null,
    };
  }

  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const perms = await Notifications.getPermissionsAsync();
  const permission: PushPermissionState = perms.granted
    ? 'granted'
    : perms.status === Notifications.PermissionStatus.DENIED
      ? 'denied'
      : 'undetermined';

  let channel: PushDiagnostics['channel'] = null;
  if (Platform.OS === 'android') {
    await ensureAndroidChannel();
    const found = await Notifications.getNotificationChannelAsync('default');
    if (found) {
      channel = { id: found.id, importance: IMPORTANCE_LABEL[found.importance] ?? '未知' };
    }
  }

  let token = getRegisteredPushToken();
  if (!token && permission === 'granted') token = await getExpoPushToken();

  return {
    supported: Device.isDevice,
    isDevice: Device.isDevice,
    isExpoGo,
    permission,
    canAskAgain: perms.canAskAgain,
    token,
    projectId: expoProjectId(),
    channel,
  };
}

/** Opens the OS settings page for this app so a denied permission can be re-enabled. */
export async function openSystemNotificationSettings() {
  if (Platform.OS === 'web') return;
  try {
    await Linking.openSettings();
  } catch {
    // Some launchers block the intent; nothing else to fall back to.
  }
}

/**
 * Schedules a local notification carrying `link`, so notification-channel
 * behaviour and tap routing can be checked without going through the server.
 */
export async function scheduleLocalLinkTest(link: string, seconds = 6): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await ensureAndroidChannel();
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '深層連結測試',
        body: '點這則通知，App 應該直接打開對應畫面。',
        data: { link, type: 'test' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: 'default',
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Registers the device for push once signed in and routes taps to the right
 * screen. Web is a no-op (Expo push needs a native device).
 */
export function usePushNotifications() {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    // Signed out (or switched account): drop the old device registration first.
    if (!userId) {
      if (previousUserId.current) {
        previousUserId.current = null;
        void unregisterPushToken();
      }
      return undefined;
    }

    previousUserId.current = userId;
    // Fire-and-forget: the token is stored in-module, so a late resolve after
    // unmount is still correct for this signed-in account.
    void enablePushOnThisDevice();
    return undefined;
  }, [userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      const payload = readPayload(response.notification.request.content.data);
      if (payload.conversationId) {
        router.push({ pathname: '/messages/[id]', params: { id: payload.conversationId } });
        return;
      }
      openNotificationLink(payload.link);
    });

    return () => tapped.remove();
  }, []);
}
