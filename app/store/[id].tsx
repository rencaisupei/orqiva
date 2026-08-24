import { useMemo, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { Avatar, Button, Spinner, Typography, useToast } from 'heroui-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Clock, MapPin, MessageCircle } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { ProductCard } from '@/components/ProductCard';
import { SelectPill } from '@/components/SelectPill';
import { StarRating } from '@/components/StarRating';
import { StoreCoupons } from '@/components/StoreCoupons';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useCategories, useProducts, useStore } from '@/lib/api/catalog';
import { useStorePromotion } from '@/lib/api/coins';
import { useStartConversation } from '@/lib/api/social';
import { BRAND } from '@/lib/brand';
import { formatDate } from '@/lib/format';
import { useUserId } from '@/lib/session';
import {
  STORE_BADGE_LABEL,
  businessHoursLines,
  businessHoursStatus,
  parseBusinessHours,
  toStoreBadgeKind,
} from '@/lib/types';

const ALL = 'all';

export default function StoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const { toast } = useToast();
  const { data: store, isLoading } = useStore(id);
  const { data: products } = useProducts({ storeId: id, sort: 'newest' });
  const { data: categories } = useCategories();
  const { data: promotion } = useStorePromotion(id);
  const { isFavorite, onToggleFavorite } = useFavoriteToggle();
  const startConversation = useStartConversation();
  const [categoryId, setCategoryId] = useState<string>(ALL);

  /*
   * 店內分類膠囊：只列出這間店真的有商品的分類，順序沿用平台分類的 sort_order，
   * 數量直接從已載入的商品算，不再多打一次查詢。
   */
  const tabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products ?? []) {
      if (!product.category_id) continue;
      counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
    }
    const list = (categories ?? [])
      .filter((category) => counts.has(category.id))
      .map((category) => ({
        id: category.id,
        label: `${category.name} ${counts.get(category.id)}`,
      }));
    return [{ id: ALL, label: `全部 ${(products ?? []).length}` }, ...list];
  }, [products, categories]);

  const visible = useMemo(() => {
    const list = products ?? [];
    if (categoryId === ALL) return list;
    return list.filter((product) => product.category_id === categoryId);
  }, [products, categoryId]);

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

  const badge = toStoreBadgeKind(promotion?.badge_kind);
  const hours = parseBusinessHours(store.business_hours);
  const hoursStatus = businessHoursStatus(hours);
  const hoursLines = businessHoursLines(hours);

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
        data={visible}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerClassName="p-4 gap-3 pb-10"
        ListHeaderComponent={
          <View className="mb-1 gap-3">
            {store.banner_url ? (
              <AppImage uri={store.banner_url} className="h-36 w-full rounded-2xl" />
            ) : null}

            <View className="bg-surface gap-3 rounded-2xl p-4">
              <View className="flex-row items-center gap-3">
                <Avatar size="lg" alt={store.name}>
                  {store.logo_url ? <Avatar.Image source={{ uri: store.logo_url }} /> : null}
                  <Avatar.Fallback />
                </Avatar>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Typography
                      type="h6"
                      numberOfLines={1}
                      className="text-navy shrink"
                      style={{ fontWeight: '700' }}
                    >
                      {store.name}
                    </Typography>
                    {/* 賣家用J幣兌換的徽章。只有伺服器寫得進 store_promotions。 */}
                    {badge ? (
                      <View className="bg-brand-orange shrink-0 rounded-full px-2 py-0.5">
                        <Typography
                          type="body-xs"
                          className="text-white"
                          style={{ fontWeight: '700' }}
                        >
                          {STORE_BADGE_LABEL[badge]}
                        </Typography>
                      </View>
                    ) : null}
                  </View>
                  <View className="flex-row items-center gap-2">
                    <StarRating rating={store.rating} count={store.rating_count} />
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

              {/* 營業時間：賣家在店舖設定選「不顯示」時 hours 為 null，整塊不出現。 */}
              {hoursStatus ? (
                <View className="border-border gap-1 rounded-2xl border p-3">
                  <View className="flex-row items-center gap-2">
                    <Clock size={14} color={hoursStatus.open ? BRAND.blue : BRAND.muted} />
                    <Typography
                      type="body-sm"
                      className={hoursStatus.open ? 'text-brand-blue flex-1' : 'text-muted flex-1'}
                      style={{ fontWeight: '600' }}
                    >
                      {hoursStatus.label}
                    </Typography>
                  </View>
                  {hoursLines.map((line) => (
                    <Typography key={line} type="body-xs" color="muted">
                      {line}
                    </Typography>
                  ))}
                  {hours?.note ? (
                    <Typography type="body-xs" color="muted">
                      {hours.note}
                    </Typography>
                  ) : null}
                </View>
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

            <StoreCoupons storeId={store.id} />

            {/* 店內分類篩選：只有兩個以上分類時才值得佔一行。 */}
            {tabs.length > 2 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2 py-1"
              >
                {tabs.map((tab) => (
                  <SelectPill
                    key={tab.id}
                    size="sm"
                    tone="soft"
                    label={tab.label}
                    selected={categoryId === tab.id}
                    onPress={() => setCategoryId(tab.id)}
                  />
                ))}
              </ScrollView>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          categoryId === ALL ? (
            <EmptyState
              title="這間店舖還沒有商品"
              description="賣家正在準備上架，稍後再回來看看。"
            />
          ) : (
            <EmptyState
              title="這個分類沒有商品"
              description="換一個分類，或看看店舖的全部商品。"
              action={
                <Button variant="secondary" onPress={() => setCategoryId(ALL)}>
                  <Button.Label>看全部商品</Button.Label>
                </Button>
              }
            />
          )
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
