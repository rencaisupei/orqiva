import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Input, Spinner, Typography, useToast } from 'heroui-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { SignInRequired } from '@/components/SignInRequired';
import { useConversation, useMessages, useSendMessage } from '@/lib/api/social';
import { BRAND } from '@/lib/brand';
import { formatPrice, relativeTime } from '@/lib/format';
import { useUserId } from '@/lib/session';
import type { Message } from '@/lib/types';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const { toast } = useToast();
  const listRef = useRef<FlatList<Message>>(null);

  const { data: conversation, isLoading } = useConversation(id);
  const { data: messages } = useMessages(id);
  const sendMessage = useSendMessage();
  const [draft, setDraft] = useState('');

  if (!userId) {
    return <SignInRequired title="登入後才能聊天" />;
  }

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (!conversation) {
    return (
      <View className="bg-background flex-1">
        <EmptyState title="找不到這個對話" />
      </View>
    );
  }

  const isBuyer = conversation.buyer_id === userId;
  const counterpartName = isBuyer
    ? (conversation.store?.name ?? '極貨網賣家')
    : (conversation.buyer?.display_name ?? '買家');

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    sendMessage.mutate(
      { conversationId: conversation.id, senderId: userId, body },
      {
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="border-border bg-surface border-b px-4 py-3">
        <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
          {counterpartName}
        </Typography>
        {conversation.product ? (
          <Pressable
            className="bg-background mt-2 flex-row items-center gap-3 rounded-xl p-2"
            onPress={() =>
              router.push({ pathname: '/products/[id]', params: { id: conversation.product!.id } })
            }
          >
            <AppImage uri={conversation.product.cover_url} className="h-11 w-11 rounded-lg" />
            <View className="flex-1">
              <Typography type="body-xs" numberOfLines={1} className="text-navy">
                {conversation.product.title}
              </Typography>
              <Typography
                type="body-xs"
                className="text-brand-orange"
                style={{ fontWeight: '600' }}
              >
                {formatPrice(conversation.product.price)}
              </Typography>
            </View>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={messages ?? []}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-4 gap-2.5"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <EmptyState title="開始你的第一句話" description="詢問庫存、規格或面交時間都可以。" />
        }
        renderItem={({ item }) => {
          const mine = item.sender_id === userId;
          return (
            <View className={mine ? 'items-end' : 'items-start'}>
              <View
                className="max-w-[80%] rounded-2xl px-3.5 py-2.5"
                style={{ backgroundColor: mine ? BRAND.blue : BRAND.white }}
              >
                <Typography type="body-sm" className={mine ? 'text-white' : 'text-navy'}>
                  {item.body}
                </Typography>
              </View>
              <Typography type="body-xs" color="muted" className="mt-0.5">
                {relativeTime(item.created_at)}
              </Typography>
            </View>
          );
        }}
      />

      <View className="border-border bg-surface pb-safe-offset-2 flex-row items-center gap-2 border-t px-3 py-2.5">
        <View className="flex-1">
          <Input
            placeholder="輸入訊息…"
            value={draft}
            onChangeText={setDraft}
            returnKeyType="send"
            onSubmitEditing={send}
          />
        </View>
        <Pressable
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: draft.trim() ? BRAND.blue : BRAND.border }}
          disabled={!draft.trim() || sendMessage.isPending}
          onPress={send}
          accessibilityLabel="送出"
        >
          <Send size={18} color={BRAND.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
