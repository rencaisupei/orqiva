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

/** Unwraps the `{ error }` body an edge function returns on failure. */
async function invokeError(error: unknown, fallback: string): Promise<Error> {
  let message = fallback;
  const context: unknown = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    try {
      const body = (await context.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // response body was not JSON — keep the generic message
    }
  }
  return new Error(message);
}

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

  if (error) throw await invokeError(error, '伺服器忙線中，請稍後再試');

  return data as T;
}

export type LogisticsAction =
  | 'get_settings'
  | 'save_settings'
  | 'verify'
  | 'map_url'
  | 'map_result'
  | 'create'
  | 'sync';

/**
 * Calls the `ecpay-logistics` edge function. All ECPay credentials and
 * CheckMacValue signing live there — never in the app bundle.
 */
export async function callLogistics<T>(
  action: LogisticsAction,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await bilt.functions.invoke('ecpay-logistics', {
    body: { action, ...payload },
  });

  if (error) throw await invokeError(error, '無法連線綠界物流服務，請稍後再試');

  return data as T;
}
