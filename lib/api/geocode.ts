import { useQuery } from '@tanstack/react-query';

import type { GeocodeHit } from '@/lib/api/contracts';
import { callGeocode } from '@/lib/backend';

export type { GeocodeHit };

/**
 * 地址 → 座標。候選地址由精確到粗略排序，伺服器回第一個查到的結果。
 *
 * 結果在伺服器端有永久快取（含「查不到」），所以這裡 staleTime 設為 Infinity
 * 並關掉重試：同一個地址在一次 App 生命週期內只會問一次。
 */
export function useGeocode(queries: string[]) {
  const list = queries.filter((query) => query.trim().length >= 3);
  return useQuery({
    enabled: list.length > 0,
    retry: false,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    queryKey: ['geocode', list.join('|')],
    queryFn: (): Promise<GeocodeHit> => callGeocode(list),
  });
}
