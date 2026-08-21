import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt } from '@/lib/backend';
import { addRole } from '@/lib/session';
import type { Order, Product, ProductCondition, SellerStatistic, Store } from '@/lib/types';

export function useMyStoreQuery(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['my-store', userId],
    queryFn: async (): Promise<Store | null> => {
      const { data, error } = await bilt
        .from('stores')
        .select('*')
        .eq('owner_id', userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Store | null) ?? null;
    },
  });
}

export function useCreateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      name: string;
      description: string;
      location: string;
      logoUrl: string | null;
    }): Promise<Store> => {
      const { data, error } = await bilt
        .from('stores')
        .insert({
          owner_id: input.userId,
          name: input.name,
          description: input.description,
          location: input.location,
          logo_url: input.logoUrl,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      await addRole('seller');
      await bilt.from('notifications').insert({
        user_id: input.userId,
        type: 'system',
        title: '賣家中心已開通',
        body: `店舖「${input.name}」建立成功，現在可以開始上架商品。`,
        link: '/seller',
      });
      return data as Store;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-store'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useUpdateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      storeId: string;
      name: string;
      description: string;
      location: string;
      logoUrl: string | null;
    }) => {
      const { error } = await bilt
        .from('stores')
        .update({
          name: input.name,
          description: input.description,
          location: input.location,
          logo_url: input.logoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.storeId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-store'] });
      void qc.invalidateQueries({ queryKey: ['store'] });
    },
  });
}

export function useSellerProducts(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['seller-products', userId],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await bilt
        .from('products')
        .select('*')
        .eq('seller_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Product[];
    },
  });
}

export type ProductDraft = {
  title: string;
  description: string;
  categoryId: string | null;
  price: number;
  originalPrice: number | null;
  stock: number;
  condition: ProductCondition;
  location: string;
  shippingMethods: string[];
  specs: Record<string, string>;
  images: string[];
  status: 'active' | 'draft';
};

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; storeId: string; draft: ProductDraft }) => {
      const { draft } = input;
      const { data, error } = await bilt
        .from('products')
        .insert({
          store_id: input.storeId,
          seller_id: input.userId,
          category_id: draft.categoryId,
          title: draft.title,
          description: draft.description,
          price: draft.price,
          original_price: draft.originalPrice,
          stock: draft.stock,
          condition: draft.condition,
          location: draft.location,
          shipping_methods: draft.shippingMethods,
          specs: draft.specs,
          status: draft.status,
          cover_url: draft.images[0] ?? null,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);

      const productId = data.id;
      if (draft.images.length > 0) {
        const { error: imgError } = await bilt
          .from('product_images')
          .insert(
            draft.images.map((url, index) => ({ product_id: productId, url, sort_order: index })),
          );
        if (imgError) throw new Error(imgError.message);
      }

      await bilt.from('notifications').insert({
        user_id: input.userId,
        type: 'product_published',
        title: '商品已成功上架',
        body: `「${draft.title}」已上架，買家現在可以看到這件商品。`,
        link: '/seller/products',
      });

      return productId;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['seller-products'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['categories'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      productId: string;
      patch: Partial<{
        title: string;
        description: string;
        price: number;
        original_price: number | null;
        stock: number;
        status: 'active' | 'draft' | 'suspended';
        category_id: string | null;
        condition: ProductCondition;
        location: string;
        shipping_methods: string[];
        specs: Record<string, string>;
      }>;
    }) => {
      const { error } = await bilt
        .from('products')
        .update({ ...input.patch, updated_at: new Date().toISOString() })
        .eq('id', input.productId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ['seller-products'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['product', input.productId] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await bilt.from('products').delete().eq('id', productId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['seller-products'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useSellerOrders(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['orders', 'seller', userId],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await bilt
        .from('orders')
        .select('*, store:stores(id, name, logo_url), order_items(*)')
        .eq('seller_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export type SellerDashboard = {
  todayViews: number;
  todayOrders: number;
  todayRevenue: number;
  monthRevenue: number;
  productCount: number;
  pendingOrders: number;
  topProducts: Product[];
  trend: { date: string; revenue: number }[];
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function useSellerDashboard(userId: string | null, storeId: string | null) {
  return useQuery({
    enabled: !!userId && !!storeId,
    queryKey: ['seller-stats', storeId],
    queryFn: async (): Promise<SellerDashboard> => {
      const today = new Date();
      const iso = isoDate;
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const weekStart = new Date(today.getTime() - 6 * 86_400_000);

      const [statsRes, productsRes, pendingRes, topRes] = await Promise.all([
        bilt
          .from('seller_statistics')
          .select('*')
          .eq('store_id', storeId!)
          .gte('stat_date', iso(monthStart < weekStart ? monthStart : weekStart))
          .order('stat_date'),
        bilt.from('products').select('id', { count: 'exact', head: true }).eq('seller_id', userId!),
        bilt
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', userId!)
          .in('status', ['pending', 'paid']),
        bilt
          .from('products')
          .select('*')
          .eq('seller_id', userId!)
          .order('sold_count', { ascending: false })
          .limit(5),
      ]);

      const stats = (statsRes.data ?? []) as SellerStatistic[];
      const todayKey = iso(today);
      const todayRow = stats.find((s) => s.stat_date === todayKey);
      const monthRevenue = stats
        .filter((s) => s.stat_date >= iso(monthStart))
        .reduce((sum, s) => sum + Number(s.revenue), 0);

      const trend: { date: string; revenue: number }[] = [];
      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(today.getTime() - i * 86_400_000);
        const key = iso(d);
        const row = stats.find((s) => s.stat_date === key);
        trend.push({ date: key.slice(5), revenue: row ? Number(row.revenue) : 0 });
      }

      return {
        todayViews: todayRow?.views ?? 0,
        todayOrders: todayRow?.orders_count ?? 0,
        todayRevenue: Number(todayRow?.revenue ?? 0),
        monthRevenue,
        productCount: productsRes.count ?? 0,
        pendingOrders: pendingRes.count ?? 0,
        topProducts: (topRes.data ?? []) as Product[],
        trend,
      };
    },
  });
}

export function useStoreReviews(storeId: string | null) {
  return useQuery({
    enabled: !!storeId,
    queryKey: ['store-reviews', storeId],
    queryFn: async () => {
      const { data: products } = await bilt.from('products').select('id').eq('store_id', storeId!);
      const ids = ((products ?? []) as { id: string }[]).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data, error } = await bilt
        .from('reviews')
        .select('*, profile:profiles!reviews_user_profile_fkey(id, display_name, avatar_url)')
        .in('product_id', ids)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
