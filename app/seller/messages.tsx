import { useMemo } from 'react';
import { View } from 'react-native';
import { Typography } from 'heroui-native';

import { ConversationList } from '@/components/ConversationList';
import { SellerTabBar } from '@/components/SellerTabBar';
import { SignInRequired } from '@/components/SignInRequired';
import { useConversations } from '@/lib/api/social';
import { useUserId } from '@/lib/session';

/** 賣家訊息：只列出買家找上門的對話（我不是買家的那些），與買家分頁完全分開。 */
export default function SellerMessagesScreen() {
  const userId = useUserId();
  const { data: conversations, isLoading } = useConversations(userId);

  const sellerThreads = useMemo(
    () => (conversations ?? []).filter((item) => item.buyer_id !== userId),
    [conversations, userId],
  );

  if (!userId) {
    return (
      <View className="bg-background pt-safe flex-1">
        <SignInRequired title="登入後查看買家訊息" />
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <View className="bg-surface pt-safe px-4 pb-3">
        <View className="pt-2">
          <Typography type="h4" className="text-navy" style={{ fontWeight: '700' }}>
            買家訊息
          </Typography>
          <Typography type="body-sm" color="muted">
            回覆得快，成交機會就高
          </Typography>
        </View>
      </View>

      <ConversationList
        conversations={sellerThreads}
        isLoading={isLoading}
        userId={userId}
        emptyTitle="還沒有買家來訊"
        emptyDescription="買家在商品頁點「聯絡賣家」後，對話會出現在這裡。"
      />

      <SellerTabBar />
    </View>
  );
}
