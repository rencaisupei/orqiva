import { Platform } from 'react-native';
import { create } from 'zustand';
import type { Session } from '@biltme/backend';

import { bilt } from '@/lib/backend';
import { unregisterPushToken } from '@/lib/pushToken';
import type { Profile, Role, UserAccount } from '@/lib/types';

type SessionState = {
  ready: boolean;
  session: Session | null;
  account: UserAccount | null;
  profile: Profile | null;
  init: () => () => void;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

async function ensureRows(session: Session, displayName?: string) {
  const user = session.user;
  const fallbackName = displayName?.trim() || user.email?.split('@')[0] || '極貨網會員';

  // profiles must exist first — users.id references profiles.id.
  await bilt
    .from('profiles')
    .upsert(
      { id: user.id, display_name: fallbackName },
      { onConflict: 'id', ignoreDuplicates: true },
    );

  await bilt
    .from('users')
    .upsert(
      { id: user.id, email: user.email ?? null },
      { onConflict: 'id', ignoreDuplicates: true },
    );
}

async function fetchRows(userId: string) {
  const [{ data: account }, { data: profile }] = await Promise.all([
    bilt.from('users').select('*').eq('id', userId).returns<UserAccount[]>().maybeSingle(),
    bilt.from('profiles').select('*').eq('id', userId).returns<Profile[]>().maybeSingle(),
  ]);
  return {
    account: account ?? null,
    profile: profile ?? null,
  };
}

export const useSessionStore = create<SessionState>((set, get) => ({
  ready: false,
  session: null,
  account: null,
  profile: null,

  init: () => {
    void (async () => {
      const { data } = await bilt.auth.getSession();
      const session = data.session;
      if (session) {
        await ensureRows(session);
        const rows = await fetchRows(session.user.id);
        set({ session, ...rows, ready: true });
      } else {
        set({ session: null, account: null, profile: null, ready: true });
      }
    })();

    const { data: sub } = bilt.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        set({ session: null, account: null, profile: null, ready: true });
        return;
      }
      // Defer database work out of the auth callback: supabase-js serialises auth
      // calls, and awaiting inside the listener can deadlock the client.
      setTimeout(() => {
        void (async () => {
          await ensureRows(session);
          const rows = await fetchRows(session.user.id);
          set({ session, ...rows, ready: true });
        })();
      }, 0);
    });

    return () => sub.subscription.unsubscribe();
  },

  reload: async () => {
    const session = get().session;
    if (!session) return;
    const rows = await fetchRows(session.user.id);
    set(rows);
  },

  signOut: async () => {
    // Detach the device from this account first — the notify function needs the
    // still-valid session token to delete the push registration.
    await unregisterPushToken();
    await bilt.auth.signOut();
    set({ session: null, account: null, profile: null });
  },
}));

export function useUserId(): string | null {
  return useSessionStore((s) => s.session?.user.id ?? null);
}

export function useIsSignedIn(): boolean {
  return useSessionStore((s) => s.session !== null);
}

const EMPTY_ROLES: Role[] = [];

export function useRoles(): Role[] {
  return useSessionStore((s) => s.account?.roles ?? EMPTY_ROLES);
}

export function useIsSeller(): boolean {
  return useSessionStore((s) => (s.account?.roles ?? []).includes('seller'));
}

export function useIsAdmin(): boolean {
  return useSessionStore((s) => (s.account?.roles ?? []).includes('admin'));
}

/** The admin console is web-only; the mobile app never exposes it. */
export const ADMIN_CONSOLE_IS_WEB = Platform.OS === 'web';

/** True only for an admin account viewing the web build. */
export function useIsAdminConsole(): boolean {
  const isAdmin = useIsAdmin();
  return ADMIN_CONSOLE_IS_WEB && isAdmin;
}

/** Adds a role to the signed-in account (a user can be buyer and seller at once). */
export async function addRole(role: Role) {
  const state = useSessionStore.getState();
  const userId = state.session?.user.id;
  if (!userId) throw new Error('請先登入');
  const roles = new Set<Role>(state.account?.roles ?? ['buyer']);
  if (roles.has(role)) return;
  roles.add(role);
  const { error } = await bilt
    .from('users')
    .update({ roles: [...roles], updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new Error(error.message);
  await state.reload();
}
