import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt, callLogistics } from '@/lib/backend';
import type {
  LogisticsEvent,
  LogisticsOrder,
  LogisticsPublicConfig,
  LogisticsSettings,
  LogisticsSubType,
  SellerLogisticsStatus,
} from '@/lib/types';

/*
 * The response shapes live in lib/api/contracts.ts next to every other edge
 * function contract; re-exported here so existing imports keep working.
 */
export type {
  AdminLogisticsPayload,
  MapSelection,
  SellerEcpaySettings,
  SellerVerifyResult,
} from '@/lib/api/contracts';

export function useSellerEcpaySettings(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['seller-ecpay-settings', userId],
    queryFn: () => callLogistics('seller_settings', {}),
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
    mutationFn: (input?: { userId?: string }) => callLogistics('seller_verify', input ?? {}),
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

/** Admin only: full logistics settings plus which environments have keys installed. */
export function useAdminLogistics(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['logistics', 'admin-settings'],
    queryFn: () => callLogistics('get_settings'),
  });
}

export function useSaveLogisticsSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<LogisticsSettings>) => callLogistics('save_settings', { patch }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['logistics'] });
    },
  });
}

export function useVerifyLogistics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callLogistics('verify'),
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
      callLogistics('map_url', input),
  });
}

/** Reads back the store the buyer picked in the browser (pull-only, call on focus). */
export function useMapSelection() {
  return useMutation({
    mutationFn: (token: string) => callLogistics('map_result', { token }).then((r) => r.result),
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
      callLogistics('create', input),
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
    mutationFn: (orderId: string) => callLogistics('sync', { orderId }),
    onSuccess: (_data, orderId) => {
      void qc.invalidateQueries({ queryKey: ['logistics', 'order', orderId] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}

export type ShipmentSyncResult = { synced: number; failed: number };

/**
 * 一次向綠界更新多筆訂單的貨態（訂單列表的「同步出貨狀態」）。
 * 綠界的查詢 API 一次只吃一張物流單，所以逐筆送出；單筆失敗不會中斷其他訂單，
 * 全部失敗才丟錯，讓畫面能顯示原因。
 */
export function useSyncShipments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderIds: string[]): Promise<ShipmentSyncResult> => {
      let synced = 0;
      let failed = 0;
      for (const orderId of orderIds) {
        try {
          await callLogistics('sync', { orderId });
          synced += 1;
        } catch {
          failed += 1;
        }
      }
      if (synced === 0 && failed > 0) {
        throw new Error('目前無法向綠界查詢貨態，請稍後再試一次。');
      }
      return { synced, failed };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['logistics'] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
