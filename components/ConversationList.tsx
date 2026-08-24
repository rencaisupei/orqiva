import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { MessagesSquare } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { protectBrand } from '@/components/brand/BrandText';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import type { ConversationRow } from '@/lib/api/social';
import { BRAND } from '@/lib/brand';
import { relativeTime } from '@/lib/format';

type Props = {
  conversations: ConversationRow[];
  isLoading: boolean;
  /** 目前登入的人：決定每一列要顯示店名（買家視角）還是買家名稱（賣家視角）。 */
  userId: string;
  emptyTitle: string;
  emptyDescription: string;
};

/** 對話列表本體。買家分頁與賣家介面各自篩選資料，共用同一份列樣式。 */
export function ConversationList({
  conversations,
  isLoading,
  userId,
  emptyTitle,
  emptyDescription,
}: Props) {
  const { refreshing, onRefresh } = usePullToRefresh();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1"
      data={conversations}
      keyExtractor={(item) => item.id}
      contentContainerClassName="p-4 gap-2.5 pb-10"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={BRAND.blue}
          colors={[BRAND.blue]}
        />
      }
      ListEmptyComponent={
        <EmptyState
          icon={<MessagesSquare size={26} color={BRAND.blue} />}
          title={emptyTitle}
          description={emptyDescription}
        />
      }
      renderItem={({ item }) => {
        const isBuyerSide = item.buyer_id === userId;
        const title = isBuyerSide
          ? (item.store?.name ?? '極貨網賣家')
          : (item.buyer?.display_name ?? '買家');
        return (
          <Pressable
            className="bg-surface flex-row items-center gap-3 rounded-2xl p-3"
            onPress={() => router.push({ pathname: '/messages/[id]', params: { id: item.id } })}
          >
            <AppImage
              uri={
                isBuyerSide
                  ? (item.product?.cover_url ?? item.store?.logo_url ?? null)
                  : (item.buyer?.avatar_url ?? item.product?.cover_url ?? null)
              }
              className="h-12 w-12 rounded-xl"
            />
            <View className="flex-1">
              <View className="flex-row items-center justify-between gap-2">
                <Typography
                  type="body-sm"
                  numberOfLines={1}
                  className="text-navy flex-1"
                  style={{ fontWeight: '600' }}
                >
                  {protectBrand(title)}
                </Typography>
                <Typography type="body-xs" color="muted" numberOfLines={1}>
                  {relativeTime(item.last_message_at)}
                </Typography>
              </View>
              {item.product ? (
                <Typography type="body-xs" color="muted" numberOfLines={1}>
                  關於：{item.product.title}
                </Typography>
              ) : null}
              <Typography type="body-sm" color="muted" numberOfLines={1}>
                {item.last_message ?? '開始聊聊吧'}
              </Typography>
            </View>
          </Pressable>
        );
      }}
    />
  );
}
