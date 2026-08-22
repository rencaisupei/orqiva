import { useMutation, useQuery } from '@tanstack/react-query';

import { callAccount } from '@/lib/backend';

export type { AccountDeletionSummary } from '@/lib/api/contracts';

/** 刪除帳號前的影響評估（進行中訂單會阻擋刪除）。 */
export function useAccountDeletionSummary(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['account', 'deletion-summary'],
    queryFn: () => callAccount('deletion_summary'),
  });
}

/** 真正刪除帳號與個人資料，無法復原。 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (confirm: string) => callAccount('delete_account', { confirm }),
  });
}
