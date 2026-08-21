import { useMutation, useQuery } from '@tanstack/react-query';

import { callAccount } from '@/lib/backend';

export type AccountDeletionSummary = {
  email: string | null;
  /** 買家身分還在進行中的訂單（待付款 / 備貨中 / 已出貨）。 */
  activeAsBuyer: number;
  /** 賣家身分還在進行中的訂單。 */
  activeAsSeller: number;
  ordersAsBuyer: number;
  ordersAsSeller: number;
  storeName: string | null;
  products: number;
  /** 必須逐字輸入的確認文字。 */
  confirmPhrase: string;
};

/** 刪除帳號前的影響評估（進行中訂單會阻擋刪除）。 */
export function useAccountDeletionSummary(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['account', 'deletion-summary'],
    queryFn: () => callAccount<AccountDeletionSummary>('deletion_summary'),
  });
}

/** 真正刪除帳號與個人資料，無法復原。 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (confirm: string) => callAccount<{ ok: boolean }>('delete_account', { confirm }),
  });
}
