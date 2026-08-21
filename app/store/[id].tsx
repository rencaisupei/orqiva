import { FlatList, View } from 'react-native';
import { Avatar, Button, Spinner, Typography, useToast } from 'heroui-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MapPin, MessageCircle } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { ProductCard } from '@/components/ProductCard';
import { StarRating } from '@/components/StarRating';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useProducts, useStore } from '@/lib/api/catalog';
import { useStartConversation } from '@/lib/api/social';
import { BRAND } from '@/lib/brand';
import { formatDate } from '@/lib/format';
import { useUserId } from '@/lib/session';

export default function StoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const { toast } = useToast();
  const { data: store, isLoading } = useStore(id);
  const { data: products } = useProducts({ storeId: id, sort: 'newest' });
  const { isFavorite, onToggleFavorite } = useFavoriteToggle();
  const startConversation = useStartConversation();

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (!store) {
    return (
      <View className="bg-background flex-1">
        <EmptyState title="找不到這間店舖" />
      </View>
    );
  }

  const contactSeller = () => {
    if (!userId) {
      router.push('/auth/sign-in');
      return;
    }
    startConversation.mutate(
      { buyerId: userId, storeId: store.id, sellerId: store.owner_id, productId: null },
      {
        onSuccess: (conversationId) =>
          router.push({ pathname: '/messages/[id]', params: { id: conversationId } }),
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  return (
    <View className="bg-background flex-1">
      <FlatList
        data={products ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerClassName="p-4 gap-3 pb-10"
        ListHeaderComponent={
          <View className="bg-surface mb-1 gap-3 rounded-2xl p-4">
            <View className="flex-row items-center gap-3">
              <Avatar size="lg" alt={store.name}>
                {store.logo_url ? <Avatar.Image source={{ uri: store.logo_url }} /> : null}
                <Avatar.Fallback />
              </Avatar>
              <View className="flex-1">
                <Typography type="h6" className="text-navy" style={{ fontWeight: '700' }}>
                  {store.name}
                </Typography>
                <View className="flex-row items-center gap-2">
                  <StarRating rating={Number(store.rating)} count={store.rating_count} />
                  <View className="flex-row items-center gap-1">
                    <MapPin size={11} color={BRAND.muted} />
                    <Typography type="body-xs" color="muted">
                      {store.location}
                    </Typography>
                  </View>
                </View>
                <Typography type="body-xs" color="muted">
                  開店時間 {formatDate(store.created_at)}
                </Typography>
              </View>
            </View>

            {store.description ? (
              <Typography type="body-sm" color="muted">
                {store.description}
              </Typography>
            ) : null}

            <Button variant="secondary" size="sm" className="self-start" onPress={contactSeller}>
              <View className="flex-row items-center gap-1.5">
                <MessageCircle size={14} color={BRAND.navy} />
                <Typography type="body-sm" className="text-navy">
                  聯絡賣家
                </Typography>
              </View>
            </Button>
          </View>
        }
        ListEmptyComponent={
          <EmptyState title="這間店舖還沒有商品" description="賣家正在準備上架，稍後再回來看看。" />
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
