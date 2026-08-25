import { useMemo } from 'react';
import { View } from 'react-native';
import { Typography } from 'heroui-native';

import { ConversationList } from '@/components/ConversationList';
import { SignInRequired } from '@/components/SignInRequired';
import { useConversations } from '@/lib/api/social';
import { useUserId } from '@/lib/session';

/** 買家訊息：只列出「我以買家身分」開的對話，賣家收到的訊息在賣家介面。 */
export default function MessagesScreen() {
  const userId = useUserId();
  const { data: conversations, isLoading } = useConversations(userId);

  const buyerThreads = useMemo(
    () => (conversations ?? []).filter((item) => item.buyer_id === userId),
    [conversations, userId],
  );

  if (!userId) {
    return (
      <View className="bg-background pt-safe flex-1">
        <SignInRequired title="登入後查看訊息" description="和賣家直接聯絡，訂單細節不再靠猜。" />
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
            你和賣家的對話
          </Typography>
        </View>
      </View>

      <ConversationList
        conversations={buyerThreads}
        isLoading={isLoading}
        userId={userId}
        focusKey="buyer-messages"
        emptyTitle="還沒有任何對話"
        emptyDescription="在商品頁點「聯絡賣家」就能開始聊聊。"
      />
    </View>
  );
}
