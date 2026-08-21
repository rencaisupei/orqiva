import { FlatList, Pressable, View } from 'react-native';
import { Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { MessagesSquare } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { SignInRequired } from '@/components/SignInRequired';
import { useConversations } from '@/lib/api/social';
import { BRAND } from '@/lib/brand';
import { relativeTime } from '@/lib/format';
import { useUserId } from '@/lib/session';

export default function MessagesScreen() {
  const userId = useUserId();
  const { data: conversations, isLoading } = useConversations(userId);

  if (!userId) {
    return (
      <View className="bg-background pt-safe flex-1">
        <SignInRequired
          title="登入後查看訊息"
          description="與買家或賣家直接聯絡，訂單細節不再靠猜。"
        />
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <View className="bg-surface pt-safe px-4 pb-3">
        <View className="pt-2">
          <Typography type="h4" className="text-navy" style={{ fontWeight: '700' }}>
            訊息
          </Typography>
          <Typography type="body-sm" color="muted">
            買家與賣家的對話都在這裡
          </Typography>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (
        <FlatList
          data={conversations ?? []}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 gap-2.5 pb-10"
          ListEmptyComponent={
            <EmptyState
              icon={<MessagesSquare size={26} color={BRAND.blue} />}
              title="還沒有任何對話"
              description="在商品頁點「聯絡賣家」就能開始聊聊。"
            />
          }
          renderItem={({ item }) => {
            const isBuyer = item.buyer_id === userId;
            const title = isBuyer
              ? (item.store?.name ?? '極貨網賣家')
              : (item.buyer?.display_name ?? '買家');
            return (
              <Pressable
                className="bg-surface flex-row items-center gap-3 rounded-2xl p-3"
                onPress={() => router.push({ pathname: '/messages/[id]', params: { id: item.id } })}
              >
                <AppImage
                  uri={item.product?.cover_url ?? item.store?.logo_url ?? null}
                  className="h-12 w-12 rounded-xl"
                />
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
                      {title}
                    </Typography>
                    <Typography type="body-xs" color="muted">
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
      )}
    </View>
  );
}
