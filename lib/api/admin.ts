import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt } from '@/lib/backend';
import type { Order, Product, Profile, Report, Role, Store, UserAccount } from '@/lib/types';

export type AdminOverview = {
  userCount: number;
  storeCount: number;
  productCount: number;
  orderCount: number;
  gmv: number;
  openReports: number;
};

export function useAdminOverview(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['admin', 'overview'],
    queryFn: async (): Promise<AdminOverview> => {
      const [users, stores, products, orders, reports] = await Promise.all([
        bilt.from('users').select('id', { count: 'exact', head: true }),
        bilt.from('stores').select('id', { count: 'exact', head: true }),
        bilt.from('products').select('id', { count: 'exact', head: true }),
        bilt.from('orders').select('total'),
        bilt.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);

      const orderRows = (orders.data ?? []) as { total: number }[];
      return {
        userCount: users.count ?? 0,
        storeCount: stores.count ?? 0,
        productCount: products.count ?? 0,
        orderCount: orderRows.length,
        gmv: orderRows.reduce((sum, o) => sum + o.total, 0),
        openReports: reports.count ?? 0,
      };
    },
  });
}

export type AdminUser = UserAccount & {
  is_suspended: boolean;
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null;
};

export function useAdminUsers(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['admin', 'users'],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await bilt
        .from('users')
        .select('*, profile:profiles!users_profile_fkey(id, display_name, avatar_url)')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useAdminStores(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['admin', 'stores'],
    queryFn: async (): Promise<Store[]> => {
      const { data, error } = await bilt
        .from('stores')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Store[];
    },
  });
}

export function useAdminProducts(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['admin', 'products'],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await bilt
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as Product[];
    },
  });
}

export function useAdminOrders(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['admin', 'orders'],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await bilt
        .from('orders')
        .select('*, store:stores(id, name, logo_url), order_items(*)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useAdminReports(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['admin', 'reports'],
    queryFn: async (): Promise<Report[]> => {
      const { data, error } = await bilt
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Report[];
    },
  });
}

export function useAdminSetProductStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { productId: string; status: 'active' | 'suspended' }) => {
      const { error } = await bilt
        .from('products')
        .update({ status: input.status, updated_at: new Date().toISOString() })
        .eq('id', input.productId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useAdminSetUserSuspended() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; suspended: boolean }) => {
      const { error } = await bilt
        .from('users')
        .update({ is_suspended: input.suspended, updated_at: new Date().toISOString() })
        .eq('id', input.userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

/** 管理員權限管理：授予或收回 admin / seller 角色（buyer 永遠保留）。 */
export function useAdminSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; role: Role; grant: boolean }) => {
      const { data, error: readError } = await bilt
        .from('users')
        .select('roles')
        .eq('id', input.userId)
        .maybeSingle();
      if (readError) throw new Error(readError.message);

      const current = new Set<Role>(data?.roles ?? ['buyer']);
      if (input.grant) current.add(input.role);
      else current.delete(input.role);
      current.add('buyer');

      const { error } = await bilt
        .from('users')
        .update({ roles: [...current], updated_at: new Date().toISOString() })
        .eq('id', input.userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useAdminResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await bilt
        .from('reports')
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .eq('id', reportId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      reporterId: string;
      targetType: 'product' | 'store' | 'user';
      targetId: string;
      reason: string;
    }) => {
      const { error } = await bilt.from('reports').insert({
        reporter_id: input.reporterId,
        target_type: input.targetType,
        target_id: input.targetId,
        reason: input.reason,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
    },
  });
}
