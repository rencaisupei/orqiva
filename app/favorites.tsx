import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { HeartOff } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { FavoriteCard } from '@/components/FavoriteCard';
import { SelectPill } from '@/components/SelectPill';
import { SignInRequired } from '@/components/SignInRequired';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useFavorites } from '@/lib/api/commerce';
import { BRAND } from '@/lib/brand';
import { formatNumber, formatPrice } from '@/lib/format';
import { useProductGrid } from '@/lib/layout';
import { useUserId } from '@/lib/session';
import { priceDrop } from '@/lib/types';

type Filter = 'all' | 'drops';

export default function FavoritesScreen() {
  const userId = useUserId();
  const { data: favorites, isLoading } = useFavorites(userId);
  const { isFavorite, onToggleFavorite } = useFavoriteToggle();
  const { refreshing, onRefresh } = usePullToRefresh();
  const [filter, setFilter] = useState<Filter>('all');
  const grid = useProductGrid();

  const list = useMemo(() => favorites ?? [], [favorites]);

  /* 降價 = 現價比收藏當下的價格低（與降價通知同一個基準）。 */
  const drops = useMemo(
    () => list.filter((item) => priceDrop(item.product.price, item.watch_price) !== null),
    [list],
  );
  const savings = drops.reduce(
    (sum, item) => sum + (priceDrop(item.product.price, item.watch_price)?.amount ?? 0),
    0,
  );

  const shown = filter === 'drops' ? drops : list;

  if (!userId) {
    return <SignInRequired title="登入後查看收藏" />;
  }

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      {list.length > 0 ? (
        <View className="bg-surface gap-2 px-4 py-3">
          <View className="flex-row flex-wrap gap-2">
            <SelectPill
              size="sm"
              tone="soft"
              label={`全部 ${formatNumber(list.length)}`}
              selected={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            {drops.length > 0 ? (
              <SelectPill
                size="sm"
                tone="soft"
                label={`降價中 ${formatNumber(drops.length)}`}
                selected={filter === 'drops'}
                onPress={() => setFilter('drops')}
              />
            ) : null}
          </View>
          <Typography type="body-xs" color="muted">
            {drops.length > 0
              ? `收藏的商品有 ${formatNumber(drops.length)} 件降價，合計便宜 ${formatPrice(savings)}`
              : '收藏的商品降價時會通知你，也可以點分享把商品傳給好友'}
          </Typography>
        </View>
      ) : null}

      <FlatList
        key={grid.key}
        data={shown}
        keyExtractor={(item) => item.product.id}
        numColumns={grid.columns}
        columnWrapperStyle={grid.columnWrapperStyle}
        contentContainerClassName="p-4 gap-3 pb-10"
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          filter === 'drops' ? (
            <EmptyState
              icon={<HeartOff size={26} color={BRAND.blue} />}
              title="目前沒有降價的收藏"
              description="收藏的商品降價時，我們會發通知給你。"
              action={
                <Button variant="secondary" onPress={() => setFilter('all')}>
                  <Button.Label>看全部收藏</Button.Label>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<HeartOff size={26} color={BRAND.blue} />}
              title="還沒有收藏商品"
              description="看到喜歡的商品，點右下角愛心就會出現在這裡。"
              action={
                <Button onPress={() => router.push('/products')}>
                  <Button.Label>開始探索</Button.Label>
                </Button>
              }
            />
          )
        }
        renderItem={({ item }) => (
          <View style={grid.itemStyle}>
            <FavoriteCard
              item={item}
              isFavorite={isFavorite(item.product.id)}
              onToggleFavorite={onToggleFavorite}
            />
          </View>
        )}
      />
    </View>
  );
}
