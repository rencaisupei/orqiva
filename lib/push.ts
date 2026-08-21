import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { callNotify } from '@/lib/backend';
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

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;

  try {
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data;
  } catch {
    // Expo Go without a project id, or no network — push simply stays off.
    return null;
  }
}

/**
 * Registers the device for push once signed in and routes taps to the right
 * screen. Web is a no-op (Expo push needs a native device).
 */
export function usePushNotifications() {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || Platform.OS === 'web') return undefined;

    let cancelled = false;
    void (async () => {
      const token = await getExpoPushToken();
      if (!token || cancelled) return;
      tokenRef.current = token;
      try {
        await callNotify('register_token', {
          token,
          platform: Platform.OS,
          deviceName: Device.deviceName ?? Device.modelName ?? null,
        });
      } catch {
        // Registration is best-effort; in-app notifications still work.
      }
    })();

    return () => {
      cancelled = true;
    };
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
