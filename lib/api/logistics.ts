import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt, callLogistics } from '@/lib/backend';
import type {
  LogisticsEvent,
  LogisticsOrder,
  LogisticsPublicConfig,
  LogisticsSettings,
  LogisticsSubType,
  LogisticsVerifyResult,
} from '@/lib/types';

export type AdminLogisticsPayload = {
  settings: LogisticsSettings;
  callbackUrl: string;
  apiHost: string;
  supportedSubTypes: LogisticsSubType[];
  /** 物流 API 的檢查碼演算法（綠界規定 MD5；SHA256 只用於金流 AIO API）。 */
  checkMacAlgorithm: string;
  /** 綠界文件公開的 C2C 測試特店代號。 */
  testAccountMerchantId: string;
  /** 寄件人資料來源；固定為 seller_shipping_profiles（每個賣家自己填）。 */
  senderSource: string;
  credentials: {
    stage: { ready: boolean; merchantId: string | null; source: 'env' | 'ecpay_test' };
    production: { ready: boolean; merchantId: string | null; source: 'env' | 'ecpay_test' };
  };
};

/** Admin only: full logistics settings plus which environments have keys installed. */
export function useAdminLogistics(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['logistics', 'admin-settings'],
    queryFn: () => callLogistics<AdminLogisticsPayload>('get_settings'),
  });
}

export function useSaveLogisticsSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<LogisticsSettings>) =>
      callLogistics<{ settings: LogisticsSettings }>('save_settings', { patch }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['logistics'] });
    },
  });
}

export function useVerifyLogistics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callLogistics<LogisticsVerifyResult>('verify'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['logistics', 'admin-settings'] });
    },
  });
}

/** Anyone: which convenience stores checkout may offer right now. */
export function useLogisticsConfig() {
  return useQuery({
    queryKey: ['logistics', 'public-config'],
    staleTime: 60_000,
    queryFn: async (): Promise<LogisticsPublicConfig> => {
      const { data, error } = await bilt.rpc('logistics_public_config');
      if (error) throw new Error(error.message);
      return (
        (data as LogisticsPublicConfig | null) ?? {
          provider: 'ecpay',
          environment: 'stage',
          is_enabled: false,
          enabled_sub_types: [],
          is_collection_enabled: true,
        }
      );
    },
  });
}

/** Opens the ECPay store map: returns the URL to hand to the system browser. */
export function useStoreMapUrl() {
  return useMutation({
    mutationFn: (input: { logisticsSubType: LogisticsSubType; orderId?: string }) =>
      callLogistics<{ token: string; url: string }>('map_url', input),
  });
}

export type MapSelection = {
  token: string;
  status: 'pending' | 'selected' | 'expired';
  store_id: string | null;
  store_name: string | null;
  store_address: string | null;
  store_phone: string | null;
  logistics_sub_type: LogisticsSubType;
};

/** Reads back the store the buyer picked in the browser (pull-only, call on focus). */
export function useMapSelection() {
  return useMutation({
    mutationFn: (token: string) =>
      callLogistics<{ result: MapSelection }>('map_result', { token }).then((r) => r.result),
  });
}

export function useLogisticsOrder(orderId: string | undefined) {
  return useQuery({
    enabled: !!orderId,
    queryKey: ['logistics', 'order', orderId],
    queryFn: async (): Promise<LogisticsOrder | null> => {
      const { data, error } = await bilt
        .from('logistics_orders')
        .select('*')
        .eq('order_id', orderId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as LogisticsOrder | null) ?? null;
    },
  });
}

export function useLogisticsEvents(logisticsOrderId: string | undefined) {
  return useQuery({
    enabled: !!logisticsOrderId,
    queryKey: ['logistics', 'events', logisticsOrderId],
    queryFn: async (): Promise<LogisticsEvent[]> => {
      const { data, error } = await bilt
        .from('logistics_events')
        .select('*')
        .eq('logistics_order_id', logisticsOrderId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as LogisticsEvent[];
    },
  });
}

/** Seller: push the order to ECPay and get the 寄貨編號 back. */
export function useCreateLogisticsOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: string; logisticsSubType?: LogisticsSubType }) =>
      callLogistics<{
        ok: boolean;
        status: string;
        merchantTradeNo: string;
        shipmentNo: string | null;
        validationNo: string | null;
        rtnMsg: string | null;
      }>('create', input),
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ['logistics', 'order', input.orderId] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order', input.orderId] });
    },
  });
}

/** Pulls the latest shipment status from ECPay. */
export function useSyncLogisticsOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => callLogistics<{ status: string }>('sync', { orderId }),
    onSuccess: (_data, orderId) => {
      void qc.invalidateQueries({ queryKey: ['logistics', 'order', orderId] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}
