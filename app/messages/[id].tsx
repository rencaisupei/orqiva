import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Input, Spinner, Typography, useToast } from 'heroui-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ban, Flag, Send, ShieldAlert } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { SignInRequired } from '@/components/SignInRequired';
import { useCreateReport } from '@/lib/api/admin';
import {
  useBlockedUserIds,
  useBlockUser,
  useConversation,
  useMessages,
  useSendMessage,
  useUnblockUser,
} from '@/lib/api/social';
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
  const { data: blockedIds } = useBlockedUserIds(userId);
  const sendMessage = useSendMessage();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const createReport = useCreateReport();
  const [draft, setDraft] = useState('');
  const [riskNotice, setRiskNotice] = useState<string | null>(null);

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
  const counterpartId = isBuyer ? conversation.seller_id : conversation.buyer_id;
  const isBlocked = !!counterpartId && (blockedIds ?? []).includes(counterpartId);

  const toggleBlock = () => {
    if (!counterpartId) {
      toast.show({ variant: 'danger', label: '這個賣家還沒有綁定帳號，請改用檢舉' });
      return;
    }
    const input = { blockerId: userId, blockedId: counterpartId };
    if (isBlocked) {
      unblockUser.mutate(input, {
        onSuccess: () => toast.show({ variant: 'success', label: '已解除封鎖' }),
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      });
      return;
    }
    blockUser.mutate(
      { ...input, reason: '使用者於聊天室封鎖' },
      {
        onSuccess: () =>
          toast.show({ variant: 'success', label: '已封鎖，雙方都不能再傳訊息給對方' }),
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  const reportCounterpart = () => {
    if (!counterpartId) {
      toast.show({ variant: 'danger', label: '這個賣家還沒有綁定帳號，無法檢舉' });
      return;
    }
    createReport.mutate(
      {
        reporterId: userId,
        targetType: 'user',
        targetId: counterpartId,
        reason: `聊天室檢舉：對話 ${conversation.id}`,
      },
      {
        onSuccess: () => toast.show({ variant: 'success', label: '已送出檢舉，平台會盡快處理' }),
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    sendMessage.mutate(
      { conversationId: conversation.id, body },
      {
        onSuccess: (result) => {
          // AI 風險掃描：命中時提醒雙方留在平台內完成交易。
          if (result.moderation?.flagged) {
            setRiskNotice(
              result.moderation.suggestion ??
                '這則訊息可能涉及站外交易或付款風險，請在極貨網平台內完成交易。',
            );
          }
        },
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
        <View className="flex-row items-center gap-2">
          <Typography
            type="body"
            numberOfLines={1}
            className="text-navy flex-1"
            style={{ fontWeight: '600' }}
          >
            {counterpartName}
          </Typography>
          <Pressable
            className="bg-surface-secondary h-8 shrink-0 flex-row items-center gap-1 rounded-full px-2.5"
            onPress={reportCounterpart}
            accessibilityLabel="檢舉這位使用者"
          >
            <Flag size={13} color={BRAND.muted} />
            <Typography type="body-xs" color="muted">
              檢舉
            </Typography>
          </Pressable>
          <Pressable
            className="bg-surface-secondary h-8 shrink-0 flex-row items-center gap-1 rounded-full px-2.5"
            onPress={toggleBlock}
            accessibilityLabel={isBlocked ? '解除封鎖' : '封鎖這位使用者'}
          >
            <Ban size={13} color={isBlocked ? BRAND.blue : BRAND.muted} />
            <Typography type="body-xs" color="muted">
              {isBlocked ? '已封鎖' : '封鎖'}
            </Typography>
          </Pressable>
        </View>
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

      <View className="border-border bg-surface pb-safe-offset-2 border-t px-3 py-2.5">
        {isBlocked ? (
          <View className="flex-row items-center gap-2 px-1 py-1">
            <Ban size={16} color={BRAND.muted} />
            <Typography type="body-xs" color="muted" className="flex-1">
              你已封鎖這位使用者，雙方都無法再傳送訊息。
            </Typography>
            <Pressable
              className="bg-brand-blue-soft h-8 items-center justify-center rounded-full px-3"
              onPress={toggleBlock}
            >
              <Typography type="body-xs" className="text-brand-blue" style={{ fontWeight: '600' }}>
                解除封鎖
              </Typography>
            </Pressable>
          </View>
        ) : (
          <>
            {riskNotice ? (
              <Pressable
                className="mb-2 flex-row items-start gap-2 rounded-xl px-3 py-2"
                style={{ backgroundColor: BRAND.orangeSoft }}
                onPress={() => setRiskNotice(null)}
                accessibilityLabel="關閉安全提醒"
              >
                <ShieldAlert size={16} color={BRAND.orange} />
                <Typography type="body-xs" className="text-navy flex-1">
                  {riskNotice}
                </Typography>
              </Pressable>
            ) : null}
            <View className="flex-row items-center gap-2">
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
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
