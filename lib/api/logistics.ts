import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt, callLogistics } from '@/lib/backend';
import type {
  LogisticsEvent,
  LogisticsOrder,
  LogisticsPublicConfig,
  LogisticsSettings,
  LogisticsSubType,
  LogisticsVerifyResult,
  SellerLogisticsStatus,
  SellerVerificationStatus,
} from '@/lib/types';

export type SellerVerifyResult = {
  ok: boolean;
  userId: string;
  isActive: boolean;
  status: SellerVerificationStatus;
  reason: string;
  message: string;
  senderReady: boolean;
  /** true = 用賣家自己的綠界特店金鑰驗證，false = 退回平台金鑰。 */
  hasOwnCredentials: boolean;
  credentialSource: 'env' | 'ecpay_test' | 'seller' | null;
  merchantId: string | null;
  checkedAt: string;
};

/** 賣家的寄件人 + 綠界特店設定。HashKey / HashIV 只回「有沒有設定」，不回內容。 */
export type SellerEcpaySettings = {
  sender: { name: string; cellPhone: string };
  ecpay: {
    merchantId: string;
    hasHashKey: boolean;
    hasHashIv: boolean;
    updatedAt: string | null;
  };
  status: {
    isActive: boolean;
    verificationStatus: SellerVerificationStatus;
    message: string | null;
    lastCheckedAt: string | null;
  };
  platform: {
    isEnabled: boolean;
    environment: 'stage' | 'production';
    apiHost: string;
    fallbackReady: boolean;
  };
};

export function useSellerEcpaySettings(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['seller-ecpay-settings', userId],
    queryFn: () => callLogistics<SellerEcpaySettings>('seller_settings', {}),
  });
}

/**
 * 對綠界物流 API 做一次 dry-run，確認這位賣家能不能提供超商取貨付款，
 * 並把結果寫進 seller_shipping_profiles（含說明）與公開鏡像 seller_logistics_status。
 * 不帶 userId 就是檢查自己；管理員可以指定其他賣家。
 */
export function useVerifySellerLogistics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input?: { userId?: string }) =>
      callLogistics<SellerVerifyResult>('seller_verify', input ?? {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['seller-shipping-profile'] });
      void qc.invalidateQueries({ queryKey: ['seller-logistics-status'] });
      void qc.invalidateQueries({ queryKey: ['seller-ecpay-settings'] });
    },
  });
}

/**
 * 買家端：一次讀多個賣家的開通狀態（公開鏡像表，不含任何個資）。
 * 回傳 map，查不到的賣家代表尚未完成驗證。
 */
export function useSellerLogisticsStatuses(sellerIds: (string | null | undefined)[]) {
  const ids = [...new Set(sellerIds.filter((id): id is string => !!id))];
  const cacheKey = [...ids].sort((a, b) => a.localeCompare(b)).join(',');

  return useQuery({
    enabled: ids.length > 0,
    queryKey: ['seller-logistics-status', cacheKey],
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, SellerLogisticsStatus>> => {
      const { data, error } = await bilt
        .from('seller_logistics_status')
        .select('*')
        .in('user_id', ids)
        .returns<SellerLogisticsStatus[]>();
      if (error) throw new Error(error.message);
      const map: Record<string, SellerLogisticsStatus> = {};
      for (const row of data ?? []) map[row.user_id] = row;
      return map;
    },
  });
}

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
  /** 有填自己綠界特店金鑰的賣家數（那些訂單會用賣家自己的帳號建單）。 */
  sellerCredentialCount: number;
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
      const { data, error } = await bilt
        .rpc('logistics_public_config')
        .returns<LogisticsPublicConfig[]>()
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (
        data ?? {
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
        .returns<LogisticsOrder[]>()
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
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
        .order('created_at', { ascending: false })
        .returns<LogisticsEvent[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
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
