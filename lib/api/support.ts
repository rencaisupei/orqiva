import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt, callNotify } from '@/lib/backend';
import type { SupportCategory, SupportTicket, SupportTicketStatus } from '@/lib/types';

export type SupportTicketDraft = {
  userId: string | null;
  name: string;
  email: string;
  phone: string;
  category: SupportCategory;
  subject: string;
  message: string;
};

/** 聯絡我們：登入或未登入都能送出（未登入時 user_id 為空）。 */
export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: SupportTicketDraft): Promise<string> => {
      const { data, error } = await bilt
        .from('support_tickets')
        .insert({
          user_id: draft.userId,
          name: draft.name,
          email: draft.email,
          phone: draft.phone || null,
          category: draft.category,
          subject: draft.subject,
          message: draft.message,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['support'] });
    },
  });
}

export function useMySupportTickets(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['support', 'mine', userId],
    queryFn: async (): Promise<SupportTicket[]> => {
      const { data, error } = await bilt
        .from('support_tickets')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as SupportTicket[];
    },
  });
}

export function useAdminSupportTickets(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['support', 'admin'],
    queryFn: async (): Promise<SupportTicket[]> => {
      const { data, error } = await bilt
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as SupportTicket[];
    },
  });
}

export function useAdminOpenTicketCount(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['support', 'open-count'],
    queryFn: async (): Promise<number> => {
      const { count, error } = await bilt
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'closed');
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
}

/**
 * Admin reply. Runs through the `notify` function because the ticket owner also
 * gets an in-app notification and a push — rows RLS would not let the admin write.
 */
export function useAdminReplyTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: string; reply: string; status: SupportTicketStatus }) =>
      callNotify<{ ok: boolean }>('support_reply', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['support'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
