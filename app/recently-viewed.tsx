import { FlatList, Pressable, View } from 'react-native';
import { Button, Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { History } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { ProductCard } from '@/components/ProductCard';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useProductsByIds } from '@/lib/api/catalog';
import { BRAND } from '@/lib/brand';
import { formatNumber } from '@/lib/format';
import { useProductGrid } from '@/lib/layout';
import { useRecentlyViewedStore } from '@/lib/recentlyViewed';

/**
 * 最近瀏覽：只讀這台裝置上的紀錄（最多 20 筆，從不上傳）。
 * 原本掛在首頁的橫向欄位已移除，改成「我的 → 最近瀏覽」的獨立頁面。
 */
export default function RecentlyViewedScreen() {
  const ids = useRecentlyViewedStore((s) => s.ids);
  const hydrated = useRecentlyViewedStore((s) => s.hydrated);
  const clear = useRecentlyViewedStore((s) => s.clear);
  const { data: products, isLoading } = useProductsByIds(ids);
  const { isFavorite, onToggleFavorite } = useFavoriteToggle();
  const grid = useProductGrid();

  if (!hydrated || (ids.length > 0 && isLoading)) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  const list = products ?? [];

  if (list.length === 0) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          icon={<History size={26} color={BRAND.blue} />}
          title="還沒有瀏覽紀錄"
          description="看過的商品會出現在這裡，紀錄只儲存在這台裝置上。"
          action={
            <Button onPress={() => router.push('/products')}>
              <Button.Label>開始逛商品</Button.Label>
            </Button>
          }
        />
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <View className="bg-surface flex-row items-center justify-between gap-3 px-4 py-3">
        <Typography type="body-xs" color="muted" className="flex-1">
          共 {formatNumber(list.length)} 件 · 只儲存在這台裝置上，不會上傳
        </Typography>
        <Pressable hitSlop={6} onPress={clear}>
          <Typography type="body-xs" className="text-brand-orange" style={{ fontWeight: '600' }}>
            清除紀錄
          </Typography>
        </Pressable>
      </View>

      <FlatList
        key={grid.key}
        data={list}
        keyExtractor={(item) => item.id}
        numColumns={grid.columns}
        columnWrapperStyle={grid.columnWrapperStyle}
        contentContainerClassName="p-4 gap-3 pb-10"
        renderItem={({ item }) => (
          <View style={grid.itemStyle}>
            <ProductCard
              product={item}
              isFavorite={isFavorite(item.id)}
              onToggleFavorite={onToggleFavorite}
            />
          </View>
        )}
      />
    </View>
  );
}
