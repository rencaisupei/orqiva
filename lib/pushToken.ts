import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { callNotify } from '@/lib/backend';

/**
 * Push-token bookkeeping kept in its own module so `lib/session.ts` can detach
 * the device on sign-out without importing `lib/push.ts` (which reads the
 * session store and would create an import cycle).
 */
let registeredToken: string | null = null;

export function setRegisteredPushToken(token: string | null) {
  registeredToken = token;
}

export function getRegisteredPushToken() {
  return registeredToken;
}

/** Mirrors the unread count on the app icon badge (no-op on web). */
export async function setAppBadgeCount(count: number) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    // Badge support is optional per platform/launcher.
  }
}

/**
 * Detaches this device from the account that is signing out, so the next person
 * using the phone does not receive the previous user's messages and orders.
 * Must run while the session token is still valid.
 */
export async function unregisterPushToken() {
  const token = registeredToken;
  registeredToken = null;

  if (Platform.OS === 'web') return;

  await setAppBadgeCount(0);
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // Not supported on every platform; ignore.
  }
  if (!token) return;
  try {
    await callNotify('unregister_token', { token });
  } catch {
    // Best-effort: the backend also drops tokens rejected by Expo push.
  }
}
