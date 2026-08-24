import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt, callMarket } from '@/lib/backend';
import type { CartItem, FavoriteItem, Order, ProductListItem } from '@/lib/types';

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

/** Adds one line to the cart, merging with an existing row for the same product. */
async function upsertCartItem(input: {
  userId: string;
  productId: string;
  quantity: number;
  shippingMethod: string;
}) {
  const { data: existing } = await bilt
    .from('cart_items')
    .select('id, quantity')
    .eq('user_id', input.userId)
    .eq('product_id', input.productId)
    .returns<{ id: string; quantity: number }[]>()
    .maybeSingle();

  if (existing) {
    const { error } = await bilt
      .from('cart_items')
      .update({
        quantity: existing.quantity + input.quantity,
        shipping_method: input.shippingMethod,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
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
      await upsertCartItem(input);
    },
    onSuccess: () => invalidateCart(qc),
  });
}

export type ReorderResult = { added: number; skipped: number };

/**
 * "再買一次": puts every still-buyable line of a past order back in the cart.
 * Sold-out / delisted lines are counted in `skipped` so the screen can say what
 * was left behind instead of silently dropping it.
 */
export function useReorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; order: Order }): Promise<ReorderResult> => {
      const lines = input.order.order_items.filter((line) => !!line.product_id);
      if (lines.length === 0) throw new Error('這筆訂單的商品都已下架，無法再次購買。');

      const ids = [...new Set(lines.map((line) => line.product_id!))];
      const { data, error } = await bilt
        .from('products')
        .select('id, stock, status, shipping_methods')
        .in('id', ids)
        .returns<{ id: string; stock: number; status: string; shipping_methods: string[] }[]>();
      if (error) throw new Error(error.message);

      const byId = new Map((data ?? []).map((product) => [product.id, product]));
      let added = 0;
      let skipped = 0;

      for (const line of lines) {
        const product = byId.get(line.product_id!);
        if (!product || product.status !== 'active' || product.stock <= 0) {
          skipped += 1;
          continue;
        }
        const shippingMethod = product.shipping_methods.includes(input.order.shipping_method)
          ? input.order.shipping_method
          : (product.shipping_methods[0] ?? '宅配');
        await upsertCartItem({
          userId: input.userId,
          productId: product.id,
          quantity: Math.min(Math.max(1, line.quantity), product.stock),
          shippingMethod,
        });
        added += 1;
      }

      if (added === 0) throw new Error('這些商品目前都已下架或缺貨，無法再次購買。');
      return { added, skipped };
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
        .eq('user_id', userId!)
        .returns<{ product_id: string }[]>();
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.product_id);
    },
  });
}

export function useFavorites(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['favorites', userId],
    queryFn: async (): Promise<FavoriteItem[]> => {
      const { data, error } = await bilt
        .from('favorites')
        .select(
          'created_at, watch_price, price_notified_at, product:products(*, store:stores(id, name, logo_url, rating, rating_count, location))',
        )
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .returns<
          {
            created_at: string;
            watch_price: number | null;
            price_notified_at: string | null;
            product: ProductListItem | null;
          }[]
        >();
      if (error) throw new Error(error.message);
      return (data ?? [])
        .filter((row): row is typeof row & { product: ProductListItem } => row.product !== null)
        .map((row) => ({
          product: row.product,
          watch_price: row.watch_price,
          price_notified_at: row.price_notified_at,
          created_at: row.created_at,
        }));
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

      /* 收藏當下的價格就是降價通知的基準價。巡邏也會補上缺的基準價，
         這裡先寫是為了「收藏後馬上降價」也能被抓到。 */
      const { data: product } = await bilt
        .from('products')
        .select('price')
        .eq('id', input.productId)
        .returns<{ price: number }[]>()
        .maybeSingle();

      const { error } = await bilt.from('favorites').insert({
        user_id: input.userId,
        product_id: input.productId,
        watch_price: product?.price ?? null,
      });
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
      /** 折扣碼；伺服器會重新驗證與計算折抵金額。 */
      couponCode?: string | null;
    }) => {
      return await callMarket('place_order', {
        items: input.items,
        recipient_name: input.recipientName,
        recipient_phone: input.recipientPhone,
        shipping_address: input.shippingAddress,
        note: input.note,
        shipping_fee: SHIPPING_FEE,
        coupon_code: input.couponCode ?? null,
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
      void qc.invalidateQueries({ queryKey: ['coupons'] });
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
