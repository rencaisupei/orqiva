import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt } from '@/lib/backend';
import type { AppNotification, Conversation, Message, Profile } from '@/lib/types';

const CONVERSATION_SELECT =
  '*, store:stores(id, name, logo_url), product:products(id, title, cover_url, price), buyer:profiles!conversations_buyer_profile_fkey(id, display_name, avatar_url)';

export type ConversationRow = Conversation & {
  buyer: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null;
};

export function useConversations(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['conversations', userId],
    queryFn: async (): Promise<ConversationRow[]> => {
      const { data, error } = await bilt
        .from('conversations')
        .select(CONVERSATION_SELECT)
        .or(`buyer_id.eq.${userId!},seller_id.eq.${userId!}`)
        .order('last_message_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 15_000,
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['conversation', id],
    queryFn: async (): Promise<ConversationRow | null> => {
      const { data, error } = await bilt
        .from('conversations')
        .select(CONVERSATION_SELECT)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    enabled: !!conversationId,
    queryKey: ['messages', conversationId],
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await bilt
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId!)
        .order('created_at');
      if (error) throw new Error(error.message);
      return (data ?? []) as Message[];
    },
    refetchInterval: 6_000,
  });
}

/** Finds or creates the buyer↔store thread for a product and returns its id. */
export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      buyerId: string;
      storeId: string;
      sellerId: string | null;
      productId: string | null;
    }): Promise<string> => {
      let query = bilt
        .from('conversations')
        .select('id')
        .eq('buyer_id', input.buyerId)
        .eq('store_id', input.storeId);
      query = input.productId
        ? query.eq('product_id', input.productId)
        : query.is('product_id', null);

      const { data: existing } = await query.maybeSingle();
      if (existing) return existing.id;

      const { data, error } = await bilt
        .from('conversations')
        .insert({
          buyer_id: input.buyerId,
          store_id: input.storeId,
          seller_id: input.sellerId,
          product_id: input.productId,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { conversationId: string; senderId: string; body: string }) => {
      const { error } = await bilt.from('messages').insert({
        conversation_id: input.conversationId,
        sender_id: input.senderId,
        body: input.body,
      });
      if (error) throw new Error(error.message);

      await bilt
        .from('conversations')
        .update({
          last_message: input.body,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.conversationId);
    },
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ['messages', input.conversationId] });
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useNotifications(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['notifications', userId],
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await bilt
        .from('notifications')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as AppNotification[];
    },
  });
}

export function useUnreadNotificationCount(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['notifications-unread', userId],
    queryFn: async (): Promise<number> => {
      const { count, error } = await bilt
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .eq('read', false);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; id?: string }) => {
      let query = bilt.from('notifications').update({ read: true }).eq('user_id', input.userId);
      if (input.id) query = query.eq('id', input.id);
      else query = query.eq('read', false);
      const { error } = await query;
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      displayName: string;
      bio: string;
      phone: string;
      avatarUrl: string | null;
    }) => {
      const now = new Date().toISOString();
      const { error } = await bilt
        .from('profiles')
        .update({
          display_name: input.displayName,
          bio: input.bio,
          avatar_url: input.avatarUrl,
          updated_at: now,
        })
        .eq('id', input.userId);
      if (error) throw new Error(error.message);

      const { error: userError } = await bilt
        .from('users')
        .update({ phone: input.phone, updated_at: now })
        .eq('id', input.userId);
      if (userError) throw new Error(userError.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
