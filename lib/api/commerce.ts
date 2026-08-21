import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt, callMarket } from '@/lib/backend';
import type { CartItem, Order, ProductListItem } from '@/lib/types';

export const SHIPPING_FEE = 60;

const CART_SELECT =
  '*, product:products(*, store:stores(id, name, logo_url, rating, rating_count, location))';

export function useCart(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['cart', userId],
    queryFn: async (): Promise<CartItem[]> => {
      const { data, error } = await bilt
        .from('cart_items')
        .select(CART_SELECT)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useCartCount(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['cart-count', userId],
    queryFn: async (): Promise<number> => {
      const { count, error } = await bilt
        .from('cart_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId!);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
}

function invalidateCart(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['cart'] });
  void qc.invalidateQueries({ queryKey: ['cart-count'] });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      productId: string;
      quantity: number;
      shippingMethod: string;
    }) => {
      const { data: existing } = await bilt
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', input.userId)
        .eq('product_id', input.productId)
        .maybeSingle();

      if (existing) {
        const row = existing;
        const { error } = await bilt
          .from('cart_items')
          .update({
            quantity: row.quantity + input.quantity,
            shipping_method: input.shippingMethod,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        if (error) throw new Error(error.message);
        return;
      }

      const { error } = await bilt.from('cart_items').insert({
        user_id: input.userId,
        product_id: input.productId,
        quantity: input.quantity,
        shipping_method: input.shippingMethod,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateCart(qc),
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      quantity?: number;
      selected?: boolean;
      shippingMethod?: string;
    }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof input.quantity === 'number') patch.quantity = input.quantity;
      if (typeof input.selected === 'boolean') patch.selected = input.selected;
      if (input.shippingMethod) patch.shipping_method = input.shippingMethod;
      const { error } = await bilt.from('cart_items').update(patch).eq('id', input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateCart(qc),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await bilt.from('cart_items').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateCart(qc),
  });
}

export function useSetAllSelected() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; selected: boolean }) => {
      const { error } = await bilt
        .from('cart_items')
        .update({ selected: input.selected, updated_at: new Date().toISOString() })
        .eq('user_id', input.userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateCart(qc),
  });
}

export function useFavoriteIds(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['favorite-ids', userId],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await bilt
        .from('favorites')
        .select('product_id')
        .eq('user_id', userId!);
      if (error) throw new Error(error.message);
      return ((data ?? []) as { product_id: string }[]).map((r) => r.product_id);
    },
  });
}

export function useFavorites(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['favorites', userId],
    queryFn: async (): Promise<ProductListItem[]> => {
      const { data, error } = await bilt
        .from('favorites')
        .select(
          'created_at, product:products(*, store:stores(id, name, logo_url, rating, rating_count, location))',
        )
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as { product: ProductListItem | null }[])
        .map((r) => r.product)
        .filter((p): p is ProductListItem => !!p);
    },
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; productId: string; isFavorite: boolean }) => {
      if (input.isFavorite) {
        const { error } = await bilt
          .from('favorites')
          .delete()
          .eq('user_id', input.userId)
          .eq('product_id', input.productId);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await bilt
        .from('favorites')
        .insert({ user_id: input.userId, product_id: input.productId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['favorite-ids'] });
      void qc.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
}

const ORDER_SELECT = '*, store:stores(id, name, logo_url), order_items(*)';

export function useMyOrders(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['orders', 'buyer', userId],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await bilt
        .from('orders')
        .select(ORDER_SELECT)
        .eq('buyer_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['order', id],
    queryFn: async (): Promise<Order | null> => {
      const { data, error } = await bilt
        .from('orders')
        .select(ORDER_SELECT)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
  });
}

export type CheckoutLine = { product_id: string; quantity: number; shipping_method: string };

export type CvsPickup = {
  logisticsSubType: string;
  storeId: string;
  storeName: string | null;
  storeAddress: string | null;
  storePhone: string | null;
};

export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      items: CheckoutLine[];
      recipientName: string;
      recipientPhone: string;
      shippingAddress: string;
      note: string;
      cvsPickup?: CvsPickup | null;
    }) => {
      return await callMarket<{ order_ids: string[] }>('place_order', {
        items: input.items,
        recipient_name: input.recipientName,
        recipient_phone: input.recipientPhone,
        shipping_address: input.shippingAddress,
        note: input.note,
        shipping_fee: SHIPPING_FEE,
        logistics_sub_type: input.cvsPickup?.logisticsSubType ?? null,
        cvs_store_id: input.cvsPickup?.storeId ?? null,
        cvs_store_name: input.cvsPickup?.storeName ?? null,
        cvs_store_address: input.cvsPickup?.storeAddress ?? null,
        cvs_store_phone: input.cvsPickup?.storePhone ?? null,
      });
    },
    onSuccess: () => {
      invalidateCart(qc);
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useSetOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { orderId: string; status: string }) => {
      await callMarket('set_order_status', { order_id: input.orderId, status: input.status });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order'] });
      void qc.invalidateQueries({ queryKey: ['seller-stats'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
