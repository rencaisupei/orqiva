import { useCallback, useMemo } from 'react';
import { router } from 'expo-router';

import { useFavoriteIds, useToggleFavorite } from '@/lib/api/commerce';
import { useUserId } from '@/lib/session';

/** Shared favourite state for product cards, with a sign-in redirect for guests. */
export function useFavoriteToggle() {
  const userId = useUserId();
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
      toggleMutate({ userId, productId, isFavorite: ids.has(productId) });
    },
    [userId, ids, toggleMutate],
  );

  return { isFavorite, onToggleFavorite };
}
