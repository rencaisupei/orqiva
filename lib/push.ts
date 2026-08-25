import { useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';

import { bilt, callNotify } from '@/lib/backend';
import { requestFocus } from '@/lib/focus';
import { useModeStore } from '@/lib/mode';
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
  const link: unknown = 'link' in data ? data.link : undefined;
  const type: unknown = 'type' in data ? data.type : undefined;
  const conversationId: unknown = 'conversationId' in data ? data.conversationId : undefined;
  return {
    link: typeof link === 'string' ? link : undefined,
    type: typeof type === 'string' ? type : undefined,
    conversationId: typeof conversationId === 'string' ? conversationId : undefined,
  };
}

/**
 * 訂單編號（market 的 orderNo()：JHW + 日期 + 6 碼）。賣家的新訂單／狀態更新通知
 * 連到的是「訂單管理」整頁，編號只出現在標題與內文裡，所以從文字取出來當作
 * 要指出哪一筆的依據 —— 抓不到就只是單純落在分頁上，不會出錯。
 */
const ORDER_NO_RE = /\bJHW\d{8,}\b/;

/** `/seller/orders?focus=<id>` 這種連結的解析；沒有 focus 就回 null。 */
function parseLink(link: string): { path: string; focus: string | null } {
  const [path, query = ''] = link.split('?');
  const found = /(?:^|&)focus=([^&]+)/.exec(query);
  return { path, focus: found ? decodeURIComponent(found[1]) : null };
}

function enterSellerInterface() {
  const state = useModeStore.getState();
  if (state.mode !== 'seller') state.setMode('seller');
}

/**
 * 賣家的分頁目的地：切分頁（不疊新畫面），需要的話先登記要指出哪一列。
 * 分頁畫面留在記憶體裡，所以回到那一頁時底部導覽與頁首都不會消失。
 */
function openSellerTab(
  href: '/seller' | '/seller/market' | '/seller/orders' | '/seller/messages' | '/seller/account',
  focus?: { key: 'seller-orders' | 'seller-messages'; token: string | null },
) {
  enterSellerInterface();
  if (focus?.token) requestFocus(focus.key, focus.token);
  router.navigate(href);
}

/**
 * 商品管理是推入的頁面（自己有頁首與底部導覽），所以先讓賣家中心分頁就位，
 * 返回鍵才會回到賣家介面而不是買家首頁。
 */
function openSellerProducts(productId: string | null) {
  enterSellerInterface();
  if (productId) requestFocus('seller-products', productId);
  router.navigate('/seller');
  router.push('/seller/products');
}

/**
 * 訊息通知：先切到「我在這條對話裡的身分」對應的訊息分頁，再打開對話本身，
 * 這樣對話頁的返回鍵會回到訊息分頁（而不是隨便一個畫面）。
 */
async function openConversation(conversationId: string) {
  const userId = useSessionStore.getState().session?.user.id ?? null;
  let sellerSide = useModeStore.getState().mode === 'seller';

  if (userId) {
    const { data } = await bilt
      .from('conversations')
      .select('buyer_id, seller_id')
      .eq('id', conversationId)
      .maybeSingle();
    const row = data;
    if (row) sellerSide = row.buyer_id !== userId && row.seller_id === userId;
  }

  if (sellerSide) {
    openSellerTab('/seller/messages', { key: 'seller-messages', token: conversationId });
  } else {
    requestFocus('buyer-messages', conversationId);
    router.navigate('/messages');
  }
  router.push({ pathname: '/messages/[id]', params: { id: conversationId } });
}

/**
 * 把通知的連結對到畫面。`text`（標題 + 內文）用來找出通知指的是哪一筆訂單。
 *
 * 賣家的通知一律落在賣家分頁上並指出相關的那一列，不在最上面疊一個新畫面。
 */
export function openNotificationLink(link: string | null | undefined, text?: string | null) {
  if (!link) return;
  const { path, focus } = parseLink(link);
  const orderNo = text ? (ORDER_NO_RE.exec(text)?.[0] ?? null) : null;

  const chat = /^\/messages\/([^/]+)$/.exec(path);
  if (chat) {
    void openConversation(chat[1]);
    return;
  }

  const order = /^\/orders\/([^/]+)$/.exec(path);
  if (order) {
    router.push({ pathname: '/orders/[id]', params: { id: order[1] } });
    return;
  }

  const product = /^\/products\/([^/]+)$/.exec(path);
  if (product) {
    router.push({ pathname: '/products/[id]', params: { id: product[1] } });
    return;
  }

  /* 低庫存提醒指向商品：落在商品管理清單並標示那一件，不直接跳進編輯表單。 */
  const sellerEdit = /^\/seller\/edit\/([^/]+)$/.exec(path);
  if (sellerEdit) {
    openSellerProducts(sellerEdit[1]);
    return;
  }

  switch (path) {
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
    case '/messages':
      router.navigate('/messages');
      break;
    case '/seller':
      openSellerTab('/seller');
      break;
    case '/seller/orders':
      // 新訂單／狀態更新：切到賣家訂單分頁，並捲到通知裡那一筆訂單。
      openSellerTab('/seller/orders', { key: 'seller-orders', token: focus ?? orderNo });
      break;
    case '/seller/messages':
      openSellerTab('/seller/messages', { key: 'seller-messages', token: focus });
      break;
    case '/seller/products':
      openSellerProducts(focus);
      break;
    case '/seller/coins':
      router.push('/seller/coins');
      break;
    case '/seller/promote':
      router.push('/seller/promote');
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
  const fromExtra: unknown = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;
  return Constants.easConfig?.projectId ?? null;
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
      const content = response.notification.request.content;
      const payload = readPayload(content.data);
      const text = [content.title, content.body].filter(Boolean).join(' ');
      if (payload.conversationId) {
        void openConversation(payload.conversationId);
        return;
      }
      openNotificationLink(payload.link, text);
    });

    return () => tapped.remove();
  }, []);
}
