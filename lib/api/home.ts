import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchDealProducts, fetchProducts, PRODUCT_LIST_SELECT } from '@/lib/api/catalog';
import { bilt } from '@/lib/backend';
import type { AdBanner, HomeAutoKind, HomeSection, ProductListItem, SortKey } from '@/lib/types';

/** One resolved home section: the admin's settings row plus the products to draw. */
export type HomeFeedSection = { section: HomeSection; products: ProductListItem[] };

const AUTO_SORT: Record<Exclude<HomeAutoKind, 'deals'>, SortKey> = {
  popular: 'popular',
  rating: 'rating',
  newest: 'newest',
  price_asc: 'price_asc',
};

/**
 * 自動欄位的內容規則。`deals` 需要在記憶體裡比較原價與現價，其餘直接交給
 * PostgREST 排序；`rating` 額外要求 4 星以上，與後台標示的說明一致。
 */
async function fetchAutoProducts(kind: HomeAutoKind, limit: number): Promise<ProductListItem[]> {
  if (kind === 'deals') return await fetchDealProducts(limit);
  return await fetchProducts({
    sort: AUTO_SORT[kind],
    limit,
    ...(kind === 'rating' ? { minRating: 4 } : null),
  });
}

type ManualItemRow = {
  section_key: string;
  product_id: string;
  sort_order: number;
};

/**
 * 首頁欄位：先讀 home_sections（管理員決定顯示哪幾區、順序與標題），
 * 再依每一區的來源取商品 —— 自動區走排序規則，人工區只取管理員審核過的
 * home_section_items，而且下架或被停權的商品會自動消失。
 */
export function useHomeFeed() {
  return useQuery({
    queryKey: ['home', 'feed'],
    staleTime: 60_000,
    queryFn: async (): Promise<HomeFeedSection[]> => {
      const { data: sectionRows, error } = await bilt
        .from('home_sections')
        .select('*')
        .eq('is_visible', true)
        .order('sort_order')
        .returns<HomeSection[]>();
      if (error) throw new Error(error.message);

      const sections = sectionRows ?? [];
      const manualKeys = sections.filter((s) => s.source === 'manual').map((s) => s.key);

      const manualByKey = new Map<string, ProductListItem[]>();
      if (manualKeys.length > 0) {
        const { data: itemRows, error: itemError } = await bilt
          .from('home_section_items')
          .select('section_key, product_id, sort_order')
          .in('section_key', manualKeys)
          .order('sort_order')
          .returns<ManualItemRow[]>();
        if (itemError) throw new Error(itemError.message);

        const rows = itemRows ?? [];
        const productIds = [...new Set(rows.map((row) => row.product_id))];

        // 只讀上架中的商品，所以下架／停權的挑選會自動從首頁掉出去。
        const { data: productRows, error: productError } = await bilt
          .from('products')
          .select(PRODUCT_LIST_SELECT)
          .eq('status', 'active')
          .in('id', productIds)
          .returns<ProductListItem[]>();
        if (productError) throw new Error(productError.message);

        const byId = new Map((productRows ?? []).map((product) => [product.id, product]));
        for (const row of rows) {
          const product = byId.get(row.product_id);
          if (!product) continue;
          const list = manualByKey.get(row.section_key) ?? [];
          list.push(product);
          manualByKey.set(row.section_key, list);
        }
      }

      const resolved = await Promise.all(
        sections.map(async (section): Promise<HomeFeedSection> => {
          if (section.source === 'manual') {
            return {
              section,
              products: (manualByKey.get(section.key) ?? []).slice(0, section.item_limit),
            };
          }
          return {
            section,
            products: await fetchAutoProducts(section.auto_kind, section.item_limit),
          };
        }),
      );

      return resolved;
    },
  });
}

/** 廣告輪播：RLS 只回傳上架中且在起訖時間內的橫幅。 */
export function useAdBanners() {
  return useQuery({
    queryKey: ['home', 'banners'],
    staleTime: 60_000,
    queryFn: async (): Promise<AdBanner[]> => {
      const { data, error } = await bilt
        .from('ad_banners')
        .select('*')
        .order('sort_order')
        .returns<AdBanner[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/* ── 後台：首頁內容管理 ── */

export function useAdminHomeSections(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['admin', 'home-sections'],
    queryFn: async (): Promise<HomeSection[]> => {
      const { data, error } = await bilt
        .from('home_sections')
        .select('*')
        .order('sort_order')
        .returns<HomeSection[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export type HomeSectionPatch = Partial<
  Pick<
    HomeSection,
    'title' | 'subtitle' | 'source' | 'auto_kind' | 'layout' | 'item_limit' | 'is_visible'
  >
> & { sort_order?: number };

export function useSaveHomeSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; patch: HomeSectionPatch; userId: string }) => {
      const { error } = await bilt
        .from('home_sections')
        .update({ ...input.patch, updated_at: new Date().toISOString(), updated_by: input.userId })
        .eq('key', input.key);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'home-sections'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

export type AdminHomeSectionItem = {
  id: string;
  section_key: string;
  product_id: string;
  sort_order: number;
  product: Pick<ProductListItem, 'id' | 'title' | 'price' | 'cover_url' | 'status'> | null;
};

export function useAdminHomeSectionItems(sectionKey: string | null) {
  return useQuery({
    enabled: !!sectionKey,
    queryKey: ['admin', 'home-section-items', sectionKey],
    queryFn: async (): Promise<AdminHomeSectionItem[]> => {
      const { data, error } = await bilt
        .from('home_section_items')
        .select(
          'id, section_key, product_id, sort_order, product:products(id, title, price, cover_url, status)',
        )
        .eq('section_key', sectionKey!)
        .order('sort_order')
        .returns<AdminHomeSectionItem[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useAddHomeSectionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sectionKey: string;
      productId: string;
      userId: string;
      nextSortOrder: number;
    }) => {
      const { error } = await bilt.from('home_section_items').insert({
        section_key: input.sectionKey,
        product_id: input.productId,
        sort_order: input.nextSortOrder,
        created_by: input.userId,
      });
      if (error) {
        throw new Error(
          error.code === '23505' || error.message.includes('duplicate')
            ? '這個商品已經在這一區了'
            : error.message,
        );
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'home-section-items'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

export function useRemoveHomeSectionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await bilt.from('home_section_items').delete().eq('id', itemId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'home-section-items'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

/** 上下移動一筆人工挑選的商品：把兩列的 sort_order 互換。 */
export function useSwapHomeSectionItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      a: { id: string; sort_order: number };
      b: { id: string; sort_order: number };
    }) => {
      const first = await bilt
        .from('home_section_items')
        .update({ sort_order: input.b.sort_order })
        .eq('id', input.a.id);
      if (first.error) throw new Error(first.error.message);
      const second = await bilt
        .from('home_section_items')
        .update({ sort_order: input.a.sort_order })
        .eq('id', input.b.id);
      if (second.error) throw new Error(second.error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'home-section-items'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

/* ── 後台：廣告輪播 ── */

export function useAdminAdBanners(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['admin', 'ad-banners'],
    queryFn: async (): Promise<AdBanner[]> => {
      const { data, error } = await bilt
        .from('ad_banners')
        .select('*')
        .order('sort_order')
        .returns<AdBanner[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export type AdBannerInput = Pick<
  AdBanner,
  | 'title'
  | 'subtitle'
  | 'image_url'
  | 'link_type'
  | 'link_value'
  | 'cta_label'
  | 'is_active'
  | 'sort_order'
>;

export function useSaveAdBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; values: AdBannerInput; userId: string }) => {
      if (input.id) {
        const { error } = await bilt
          .from('ad_banners')
          .update({ ...input.values, updated_at: new Date().toISOString() })
          .eq('id', input.id);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await bilt
        .from('ad_banners')
        .insert({ ...input.values, created_by: input.userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'ad-banners'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

export function useDeleteAdBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await bilt.from('ad_banners').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'ad-banners'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}
