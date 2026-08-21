import { FlatList, View } from 'react-native';
import { Button, Spinner } from 'heroui-native';
import { router } from 'expo-router';
import { HeartOff } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { ProductCard } from '@/components/ProductCard';
import { SignInRequired } from '@/components/SignInRequired';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useFavorites } from '@/lib/api/commerce';
import { BRAND } from '@/lib/brand';
import { useUserId } from '@/lib/session';

export default function FavoritesScreen() {
  const userId = useUserId();
  const { data: favorites, isLoading } = useFavorites(userId);
  const { isFavorite, onToggleFavorite } = useFavoriteToggle();

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
      <FlatList
        data={favorites ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerClassName="p-4 gap-3 pb-10"
        ListEmptyComponent={
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
        }
        renderItem={({ item }) => (
          <View className="flex-1">
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
