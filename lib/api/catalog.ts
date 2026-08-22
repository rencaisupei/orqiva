import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt, callMarket } from '@/lib/backend';
import type {
  Category,
  CategoryWithCount,
  ProductDetail,
  ProductFilters,
  ProductListItem,
  Review,
  SortKey,
  Store,
} from '@/lib/types';

const LIST_SELECT = '*, store:stores(id, name, logo_url, rating, rating_count, location)';

/** Sort key → the column and direction PostgREST should order by. */
const SORT_COLUMN: Record<SortKey, { column: string; ascending: boolean }> = {
  newest: { column: 'created_at', ascending: false },
  popular: { column: 'sold_count', ascending: false },
  price_asc: { column: 'price', ascending: true },
  price_desc: { column: 'price', ascending: false },
  rating: { column: 'rating', ascending: false },
};

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<CategoryWithCount[]> => {
      // is_listable = false categories are retired (digital/virtual goods) and stay out of
      // both browsing and the seller listing flow.
      const [{ data: categories, error }, { data: productRows }] = await Promise.all([
        bilt
          .from('categories')
          .select('*')
          .eq('is_listable', true)
          .order('sort_order')
          .returns<Category[]>(),
        bilt
          .from('products')
          .select('category_id')
          .eq('status', 'active')
          .returns<{ category_id: string | null }[]>(),
      ]);
      if (error) throw new Error(error.message);

      const counts = new Map<string, number>();
      for (const row of productRows ?? []) {
        if (!row.category_id) continue;
        counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
      }

      return (categories ?? []).map((c) => ({
        ...c,
        product_count: counts.get(c.id) ?? 0,
      }));
    },
    staleTime: 60_000,
  });
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async (): Promise<ProductListItem[]> => {
      let query = bilt.from('products').select(LIST_SELECT).eq('status', 'active');

      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.storeId) query = query.eq('store_id', filters.storeId);
      if (filters.sellerId) query = query.eq('seller_id', filters.sellerId);
      if (filters.condition) query = query.eq('condition', filters.condition);
      if (filters.location) query = query.eq('location', filters.location);
      if (typeof filters.minPrice === 'number') query = query.gte('price', filters.minPrice);
      if (typeof filters.maxPrice === 'number') query = query.lte('price', filters.maxPrice);
      if (typeof filters.minRating === 'number') query = query.gte('rating', filters.minRating);
      if (filters.shipping) query = query.contains('shipping_methods', [filters.shipping]);
      if (filters.q?.trim()) {
        const term = filters.q.trim().replaceAll(',', ' ');
        query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
      }

      const sort = SORT_COLUMN[filters.sort ?? 'newest'];
      query = query.order(sort.column, { ascending: sort.ascending });
      if (filters.limit) query = query.limit(filters.limit);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['product', id],
    queryFn: async (): Promise<ProductDetail | null> => {
      const { data, error } = await bilt
        .from('products')
        .select(
          `${LIST_SELECT}, category:categories(id, name, slug), product_images(id, url, sort_order)`,
        )
        .eq('id', id!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
  });
}

export function useStore(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['store', id],
    queryFn: async (): Promise<Store | null> => {
      const { data, error } = await bilt
        .from('stores')
        .select('*')
        .eq('id', id!)
        .returns<Store[]>()
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
  });
}

export function useProductReviews(productId: string | undefined) {
  return useQuery({
    enabled: !!productId,
    queryKey: ['reviews', productId],
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await bilt
        .from('reviews')
        .select('*, profile:profiles!reviews_user_profile_fkey(id, display_name, avatar_url)')
        .eq('product_id', productId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useTrackProductView() {
  return useMutation({
    mutationFn: async (productId: string) => {
      await callMarket('track_view', { product_id: productId });
    },
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      productId: string;
      orderId: string | null;
      orderItemId: string | null;
      userId: string;
      rating: number;
      comment: string;
    }) => {
      const { error } = await bilt.from('reviews').insert({
        product_id: input.productId,
        order_id: input.orderId,
        user_id: input.userId,
        rating: input.rating,
        comment: input.comment,
      });
      if (error) throw new Error(error.message);

      if (input.orderItemId) {
        await bilt.from('order_items').update({ reviewed: true }).eq('id', input.orderItemId);
      }

      // Recalculate the product aggregate from the real review rows.
      const { data: rows } = await bilt
        .from('reviews')
        .select('rating')
        .eq('product_id', input.productId)
        .returns<{ rating: number }[]>();
      const ratings = (rows ?? []).map((r) => r.rating);
      if (ratings.length > 0) {
        const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        await bilt
          .from('products')
          .update({ rating: Number(avg.toFixed(2)), rating_count: ratings.length })
          .eq('id', input.productId);
      }
    },
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ['reviews', input.productId] });
      void qc.invalidateQueries({ queryKey: ['product', input.productId] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
