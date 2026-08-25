import { useCallback, useMemo } from 'react';
import { router } from 'expo-router';

import { useBrandToast } from '@/components/brand/BrandToast';
import { useFavoriteIds, useToggleFavorite } from '@/lib/api/commerce';
import { useUserId } from '@/lib/session';

/**
 * Shared favourite state for product cards, with a sign-in redirect for guests.
 *
 * 心形是樂觀更新的（見 useToggleFavorite）：按下就變色，伺服器失敗才退回原狀
 * 並提示，所以呼叫端不需要自己處理 pending。
 */
export function useFavoriteToggle() {
  const userId = useUserId();
  const { toast } = useBrandToast();
  const { data: favoriteIds } = useFavoriteIds(userId);
  const toggle = useToggleFavorite();
  const toggleMutate = toggle.mutate;

  const ids = useMemo(() => new Set(favoriteIds ?? []), [favoriteIds]);

  const isFavorite = useCallback((productId: string) => ids.has(productId), [ids]);

  const onToggleFavorite = useCallback(
    (productId: string) => {
      if (!userId) {
        router.push('/auth/sign-in');
        return;
      }
      toggleMutate(
        { userId, productId, isFavorite: ids.has(productId) },
        {
          onError: () => toast.show({ variant: 'danger', label: '收藏沒有存成功，請稍後再試一次' }),
        },
      );
    },
    [userId, ids, toggleMutate, toast],
  );

  return { isFavorite, onToggleFavorite };
}
