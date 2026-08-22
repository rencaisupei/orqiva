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
  | 'seller_status'
  | 'seller_verify'
  | 'seller_settings'
  | 'save_seller_credentials'
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

export type NotifyAction =
  | 'register_token'
  | 'unregister_token'
  | 'send_message'
  | 'support_reply'
  | 'push_test';

/**
 * Calls the `notify` edge function: device tokens, chat messages and every
 * cross-user push notification are handled there with the service key.
 */
export async function callNotify<T>(
  action: NotifyAction,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await bilt.functions.invoke('notify', {
    body: { action, ...payload },
  });

  if (error) throw await invokeError(error, '推播服務暫時無法使用，請稍後再試');

  return data as T;
}

export type AccountAction = 'deletion_summary' | 'delete_account';

/**
 * Calls the `account` edge function: in-app account deletion needs the service
 * key to remove the auth user, which the client can never do itself.
 */
export async function callAccount<T>(
  action: AccountAction,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await bilt.functions.invoke('account', {
    body: { action, ...payload },
  });

  if (error) throw await invokeError(error, '帳號服務暫時無法使用，請稍後再試');

  return data as T;
}

export type ModerationAction =
  | 'moderate_product'
  | 'admin_decide'
  | 'scan_message'
  | 'resolve_flag'
  | 'triage_report';

/** Calls the `ai-moderation` edge function (OpenAI key stays server-side). */
export async function callModeration<T>(
  action: ModerationAction,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await bilt.functions.invoke('ai-moderation', {
    body: { action, ...payload },
  });

  if (error) throw await invokeError(error, 'AI 審核服務暫時無法使用，請稍後再試');

  return data as T;
}
