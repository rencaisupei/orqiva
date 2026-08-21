import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { asyncStorage, createClient, webStorage } from '@biltme/backend';

const url = process.env.EXPO_PUBLIC_BILT_URL;
const anonKey = process.env.EXPO_PUBLIC_BILT_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing EXPO_PUBLIC_BILT_URL / EXPO_PUBLIC_BILT_ANON_KEY');
}

export const bilt = createClient(url, anonKey, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage() : asyncStorage(AsyncStorage),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

type MarketAction = 'place_order' | 'set_order_status' | 'track_view';

/**
 * Calls the `market` edge function. Order creation, stock changes and
 * cross-user notifications run there with the service key.
 */
export async function callMarket<T>(
  action: MarketAction,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await bilt.functions.invoke('market', {
    body: { action, ...payload },
  });

  if (error) {
    let message = '伺服器忙線中，請稍後再試';
    const context: unknown = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = (await context.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        // response body was not JSON — keep the generic message
      }
    }
    throw new Error(message);
  }

  return data as T;
}
