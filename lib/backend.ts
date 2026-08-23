import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { asyncStorage, createClient, webStorage } from '@biltme/backend';

import type {
  AccountResponses,
  CoinResponses,
  LogisticsNotifyResponses,
  LogisticsResponses,
  MaintenanceResponses,
  MarketResponses,
  ModerationResponses,
  NotifyResponses,
} from '@/lib/api/contracts';

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

/** Reads `error.context` without asserting a shape onto an unknown value. */
function errorContext(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && 'context' in error) return error.context;
  return null;
}

/** Pulls the `{ error: string }` message an edge function returns on failure. */
function errorMessage(body: unknown): string | null {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const value: unknown = body.error;
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return null;
}

/** Unwraps the `{ error }` body an edge function returns on failure. */
async function invokeError(error: unknown, fallback: string): Promise<Error> {
  const context = errorContext(error);
  if (context instanceof Response) {
    const body: unknown = await context.json().catch(() => null);
    const message = errorMessage(body);
    if (message) return new Error(message);
  }
  return new Error(fallback);
}

/**
 * Single invoke path for every edge function.
 *
 * The response type comes from the per-function action map in
 * `lib/api/contracts.ts`, so nothing here casts the body: `invoke<T>` types it
 * and a missing body is treated as a failure instead of being forced into `T`.
 */
async function invokeEdge<T>(
  fn: string,
  action: string,
  payload: Record<string, unknown>,
  fallback: string,
): Promise<T> {
  const { data, error } = await bilt.functions.invoke<T>(fn, {
    body: { action, ...payload },
  });

  if (error) throw await invokeError(error, fallback);
  if (data === null || data === undefined) throw new Error(fallback);

  return data;
}

/**
 * Calls the `market` edge function. Order creation, stock changes and
 * cross-user notifications run there with the service key.
 */
export function callMarket<A extends keyof MarketResponses>(
  action: A,
  payload: Record<string, unknown> = {},
): Promise<MarketResponses[A]> {
  return invokeEdge<MarketResponses[A]>('market', action, payload, '伺服器忙線中，請稍後再試');
}

export type LogisticsAction = keyof LogisticsResponses;

/**
 * Calls the `ecpay-logistics` edge function. All ECPay credentials and
 * CheckMacValue signing live there — never in the app bundle.
 */
export function callLogistics<A extends LogisticsAction>(
  action: A,
  payload: Record<string, unknown> = {},
): Promise<LogisticsResponses[A]> {
  return invokeEdge<LogisticsResponses[A]>(
    'ecpay-logistics',
    action,
    payload,
    '無法連線綠界物流服務，請稍後再試',
  );
}

export type NotifyAction = keyof NotifyResponses;

export type LogisticsNotifyAction = keyof LogisticsNotifyResponses;

/**
 * Calls the `logistics-notify` edge function: sends the buyer the shipped /
 * arrived notice when ECPay's own callback cannot (seller just created the
 * label, or the status was recovered by a sync). It decides server-side whether
 * a notice is actually due, so calling it after every sync is safe.
 */
export function callLogisticsNotify<A extends LogisticsNotifyAction>(
  action: A,
  payload: Record<string, unknown> = {},
): Promise<LogisticsNotifyResponses[A]> {
  return invokeEdge<LogisticsNotifyResponses[A]>(
    'logistics-notify',
    action,
    payload,
    '通知服務暫時無法使用，請稍後再試',
  );
}

/**
 * Calls the `notify` edge function: device tokens, chat messages and every
 * cross-user push notification are handled there with the service key.
 */
export function callNotify<A extends NotifyAction>(
  action: A,
  payload: Record<string, unknown> = {},
): Promise<NotifyResponses[A]> {
  return invokeEdge<NotifyResponses[A]>(
    'notify',
    action,
    payload,
    '推播服務暫時無法使用，請稍後再試',
  );
}

export type AccountAction = keyof AccountResponses;

/**
 * Calls the `account` edge function: in-app account deletion needs the service
 * key to remove the auth user, which the client can never do itself.
 */
export function callAccount<A extends AccountAction>(
  action: A,
  payload: Record<string, unknown> = {},
): Promise<AccountResponses[A]> {
  return invokeEdge<AccountResponses[A]>(
    'account',
    action,
    payload,
    '帳號服務暫時無法使用，請稍後再試',
  );
}

export type ModerationAction = keyof ModerationResponses;

/** Calls the `ai-moderation` edge function (OpenAI key stays server-side). */
export function callModeration<A extends ModerationAction>(
  action: A,
  payload: Record<string, unknown> = {},
): Promise<ModerationResponses[A]> {
  return invokeEdge<ModerationResponses[A]>(
    'ai-moderation',
    action,
    payload,
    'AI 審核服務暫時無法使用，請稍後再試',
  );
}

export type MaintenanceAction = keyof MaintenanceResponses;

export type CoinAction = keyof CoinResponses;

/**
 * Calls the `seller-coins` edge function: 極幣 balances, daily check-in, task
 * rewards and promotion redemptions. Every coin change is decided there with the
 * service key — the wallet and ledger tables have no client write policy, so the
 * app can never grant itself coins.
 */
export function callCoins<A extends CoinAction>(
  action: A,
  payload: Record<string, unknown> = {},
): Promise<CoinResponses[A]> {
  return invokeEdge<CoinResponses[A]>(
    'seller-coins',
    action,
    payload,
    '極幣服務暫時無法使用，請稍後再試',
  );
}

/**
 * Calls the `maintenance` edge function: the scheduled housekeeping run that
 * purges expired rows. Throttled server-side, so calling it when it is not due
 * is a cheap no-op.
 */
export function callMaintenance<A extends MaintenanceAction>(
  action: A,
  payload: Record<string, unknown> = {},
): Promise<MaintenanceResponses[A]> {
  return invokeEdge<MaintenanceResponses[A]>(
    'maintenance',
    action,
    payload,
    '維護服務暫時無法使用，請稍後再試',
  );
}
