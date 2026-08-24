import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bilt, callLogistics, callModeration } from '@/lib/backend';
import { addRole } from '@/lib/session';
import type {
  ModerationResult,
  Order,
  OrderStatus,
  Product,
  ProductCondition,
  SellerShippingProfile,
  SellerStatistic,
  Store,
  StoreReview,
} from '@/lib/types';

/**
 * 賣家自己的綠界特店金鑰。存進 seller_ecpay_credentials（沒有任何 RLS 政策，
 * 只有 ecpay-logistics 這支 edge function 讀得到），前端只送不收。
 * hashKey / hashIv 留空 = 沿用已儲存的金鑰；三欄全空 = 改用平台金鑰。
 */
export type SellerEcpayInput = {
  merchantId: string;
  hashKey: string;
  hashIv: string;
};

/**
 * 賣家的寄件人資料（綠界 C2C 建單用）。
 * 存在獨立的 seller_shipping_profiles，RLS 只讓本人與管理員讀得到，
 * 因為 stores / profiles 是全站可讀的公開資料。
 */
export function useSellerShippingProfile(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['seller-shipping-profile', userId],
    queryFn: async (): Promise<SellerShippingProfile | null> => {
      const { data, error } = await bilt
        .from('seller_shipping_profiles')
        .select('*')
        .eq('user_id', userId!)
        .returns<SellerShippingProfile[]>()
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
  });
}

async function saveShippingProfile(
  userId: string,
  senderName: string,
  senderCellPhone: string,
  ecpay?: SellerEcpayInput,
) {
  const { error } = await bilt.from('seller_shipping_profiles').upsert(
    {
      user_id: userId,
      sender_name: senderName.trim(),
      sender_cell_phone: senderCellPhone.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error(error.message);

  /*
   * 資料一存好就立刻對綠界物流 API 做一次狀態檢查（dry run），
   * 賣家不必自己按任何按鈕就會看到「已開通」或「審核中」。
   *
   * 有填自己的綠界特店金鑰時走 save_seller_credentials：它會先存進
   * seller_ecpay_credentials（service key only），再用那組金鑰試打一次。
   * 這一步的錯誤要往外丟，賣家才知道商店代號或金鑰格式不對；只有純狀態檢查
   * 失敗才忽略，避免網路問題讓整筆儲存看起來失敗。
   */
  if (ecpay) {
    await callLogistics('save_seller_credentials', {
      merchantId: ecpay.merchantId.trim(),
      hashKey: ecpay.hashKey.trim(),
      hashIv: ecpay.hashIv.trim(),
    });
    return;
  }

  try {
    await callLogistics('seller_verify', {});
  } catch {
    // 忽略：狀態留在上一次的結果，賣家中心可手動重新檢查。
  }
}

export function useMyStoreQuery(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['my-store', userId],
    queryFn: async (): Promise<Store | null> => {
      const { data, error } = await bilt
        .from('stores')
        .select('*')
        .eq('owner_id', userId!)
        .returns<Store[]>()
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
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
      senderName: string;
      senderCellPhone: string;
    }): Promise<Store> => {
      // 寄件人資料先寫，開店後每一張綠界物流單都直接取用這一筆。
      await saveShippingProfile(input.userId, input.senderName, input.senderCellPhone);

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
        .returns<Store[]>()
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
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-store'] });
      void qc.invalidateQueries({ queryKey: ['seller-shipping-profile'] });
      void qc.invalidateQueries({ queryKey: ['seller-logistics-status'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useUpdateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      storeId: string;
      name: string;
      description: string;
      location: string;
      logoUrl: string | null;
      senderName: string;
      senderCellPhone: string;
      /** 賣家自己的綠界特店金鑰。undefined = 不動既有設定。 */
      ecpay?: SellerEcpayInput;
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

      await saveShippingProfile(input.userId, input.senderName, input.senderCellPhone, input.ecpay);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-store'] });
      void qc.invalidateQueries({ queryKey: ['seller-shipping-profile'] });
      void qc.invalidateQueries({ queryKey: ['seller-logistics-status'] });
      void qc.invalidateQueries({ queryKey: ['seller-ecpay-settings'] });
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
        .order('created_at', { ascending: false })
        .returns<Product[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
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
    mutationFn: async (input: {
      userId: string;
      storeId: string;
      draft: ProductDraft;
    }): Promise<{ productId: string; moderation: ModerationResult | null }> => {
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
          moderation_status: 'pending',
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

      // AI 驗證審核：通過才會對買家公開，結果與通知都由審核函式寫入。
      let moderation: ModerationResult | null = null;
      try {
        moderation = await callModeration('moderate_product', { productId });
      } catch {
        // 審核服務暫時無法使用時商品留在「審核中」，管理員可在後台重新送審。
      }

      return { productId, moderation };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['seller-products'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['categories'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['moderation'] });
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
      const contentChanged = ['title', 'description', 'price', 'category_id'].some(
        (key) => key in input.patch,
      );

      const { error } = await bilt
        .from('products')
        .update({
          ...input.patch,
          ...(contentChanged ? { moderation_status: 'pending' } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.productId);
      if (error) throw new Error(error.message);

      // 內容改過就重新送 AI 審核，避免用審核過的舊內容夾帶新文案。
      if (contentChanged) {
        try {
          await callModeration('moderate_product', { productId: input.productId });
        } catch {
          // 審核服務暫時無法使用時商品留在「審核中」。
        }
      }
    },
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ['seller-products'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['product', input.productId] });
      void qc.invalidateQueries({ queryKey: ['moderation'] });
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
  /** Change vs yesterday in percent, or null when yesterday has no data to compare against. */
  viewsDelta: number | null;
  ordersDelta: number | null;
  revenueDelta: number | null;
  monthRevenue: number;
  productCount: number;
  pendingOrders: number;
  topProducts: Product[];
  trend: { date: string; revenue: number }[];
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function deltaPercent(today: number, yesterday: number): number | null {
  if (yesterday <= 0) return null;
  return Math.round(((today - yesterday) / yesterday) * 100);
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
          .order('stat_date')
          .returns<SellerStatistic[]>(),
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
          .limit(5)
          .returns<Product[]>(),
      ]);

      const stats = statsRes.data ?? [];
      const todayKey = iso(today);
      const yesterdayKey = iso(new Date(today.getTime() - 86_400_000));
      const todayRow = stats.find((s) => s.stat_date === todayKey);
      const yesterdayRow = stats.find((s) => s.stat_date === yesterdayKey);
      const monthRevenue = stats
        .filter((s) => s.stat_date >= iso(monthStart))
        .reduce((sum, s) => sum + s.revenue, 0);

      const trend: { date: string; revenue: number }[] = [];
      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(today.getTime() - i * 86_400_000);
        const key = iso(d);
        const row = stats.find((s) => s.stat_date === key);
        trend.push({ date: key.slice(5), revenue: row ? row.revenue : 0 });
      }

      return {
        todayViews: todayRow?.views ?? 0,
        todayOrders: todayRow?.orders_count ?? 0,
        todayRevenue: todayRow?.revenue ?? 0,
        viewsDelta: deltaPercent(todayRow?.views ?? 0, yesterdayRow?.views ?? 0),
        ordersDelta: deltaPercent(todayRow?.orders_count ?? 0, yesterdayRow?.orders_count ?? 0),
        revenueDelta: deltaPercent(todayRow?.revenue ?? 0, yesterdayRow?.revenue ?? 0),
        monthRevenue,
        productCount: productsRes.count ?? 0,
        pendingOrders: pendingRes.count ?? 0,
        topProducts: topRes.data ?? [],
        trend,
      };
    },
  });
}

/* ── 銷售儀表板（日／週／月 + 日期範圍） ───────────────────────── */

export type SalesGrain = 'day' | 'week' | 'month';

/** 一個時間區間（grain 決定寬度，count 決定看幾個區間）。 */
export type SalesRange = { grain: SalesGrain; count: number };

export type SalesBucket = {
  key: string;
  /** 圖表下方的短標籤（08/24、8/18、8月）。 */
  label: string;
  revenue: number;
  orders: number;
  views: number;
};

export type SalesTopProduct = {
  productId: string | null;
  title: string;
  imageUrl: string | null;
  quantity: number;
  revenue: number;
};

export type SalesReport = {
  buckets: SalesBucket[];
  revenue: number;
  orders: number;
  views: number;
  /** 與前一個等長期間相比的百分比；前期沒有資料時 null。 */
  revenueDelta: number | null;
  ordersDelta: number | null;
  viewsDelta: number | null;
  /** 平均客單價（已排除取消的訂單）。 */
  avgOrderValue: number;
  statusCounts: Record<OrderStatus, number>;
  topProducts: SalesTopProduct[];
  /** 「2026/07/26 ~ 2026/08/24」，讓賣家確認自己在看哪一段。 */
  rangeLabel: string;
  startsAt: string;
};

type ReportOrderLine = {
  product_id: string | null;
  title: string;
  quantity: number;
  unit_price: number;
  image_url: string | null;
};

type ReportOrder = {
  id: string;
  created_at: string;
  status: OrderStatus;
  total: number;
  order_items: ReportOrderLine[];
};

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 週一為一週的開始（台灣的習慣）。 */
function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  const weekday = (day.getDay() + 6) % 7;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - weekday);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** 本地日期的 YYYY-MM-DD（不要用 toISOString，那是 UTC，會把晚上的訂單算到隔天）。 */
function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 這個時間屬於哪一個區間，以及那個區間的起點。 */
function bucketStart(date: Date, grain: SalesGrain): Date {
  if (grain === 'week') return startOfWeek(date);
  if (grain === 'month') return startOfMonth(date);
  return startOfDay(date);
}

function bucketKey(date: Date, grain: SalesGrain): string {
  const start = bucketStart(date, grain);
  return grain === 'month'
    ? `${start.getFullYear()}-${pad(start.getMonth() + 1)}`
    : localDate(start);
}

function bucketLabel(start: Date, grain: SalesGrain): string {
  if (grain === 'month') return `${start.getMonth() + 1}月`;
  return `${pad(start.getMonth() + 1)}/${pad(start.getDate())}`;
}

/** 往前推 n 個區間的起點。 */
function shiftBucket(start: Date, grain: SalesGrain, steps: number): Date {
  if (grain === 'month') {
    return new Date(start.getFullYear(), start.getMonth() + steps, 1);
  }
  const days = grain === 'week' ? steps * 7 : steps;
  return new Date(start.getTime() + days * DAY_MS);
}

function periodStart(range: SalesRange, now: Date): Date {
  return shiftBucket(bucketStart(now, range.grain), range.grain, -(range.count - 1));
}

function formatRangeLabel(from: Date, to: Date): string {
  const show = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  return `${show(from)} ~ ${show(to)}`;
}

const EMPTY_STATUS_COUNTS: Record<OrderStatus, number> = {
  pending: 0,
  paid: 0,
  shipped: 0,
  completed: 0,
  cancelled: 0,
};

/**
 * 銷售報表：日／週／月的訂單數與營收、期間熱門商品、訂單狀態分佈。
 *
 * 營收與訂單數一律從 orders 算（排除已取消），不用 seller_statistics 的彙總值，
 * 這樣圖表上的數字與賣家自己在訂單頁看到的一致；seller_statistics 只用來取瀏覽數。
 * 為了算「與前期相比」，查詢範圍是兩倍期間，前半段只算總計、不畫進圖表。
 */
export function useSellerSalesReport(
  userId: string | null,
  storeId: string | null,
  range: SalesRange,
) {
  return useQuery({
    enabled: !!userId && !!storeId,
    queryKey: ['seller-stats', 'report', storeId, range.grain, range.count],
    queryFn: async (): Promise<SalesReport> => {
      const now = new Date();
      const start = periodStart(range, now);
      const prevStart = shiftBucket(start, range.grain, -range.count);

      const [ordersRes, statsRes] = await Promise.all([
        bilt
          .from('orders')
          .select(
            'id, created_at, status, total, order_items(product_id, title, quantity, unit_price, image_url)',
          )
          .eq('seller_id', userId!)
          .gte('created_at', prevStart.toISOString())
          .order('created_at', { ascending: true })
          .returns<ReportOrder[]>(),
        bilt
          .from('seller_statistics')
          .select('*')
          .eq('store_id', storeId!)
          .gte('stat_date', localDate(prevStart))
          .order('stat_date')
          .returns<SellerStatistic[]>(),
      ]);

      const orders = ordersRes.data ?? [];
      const stats = statsRes.data ?? [];

      /* 圖表的空桶先鋪好，沒有訂單的那一天也要留位置。 */
      const buckets: SalesBucket[] = [];
      const index = new Map<string, SalesBucket>();
      for (let i = 0; i < range.count; i += 1) {
        const bucketDate = shiftBucket(start, range.grain, i);
        const bucket: SalesBucket = {
          key: bucketKey(bucketDate, range.grain),
          label: bucketLabel(bucketDate, range.grain),
          revenue: 0,
          orders: 0,
          views: 0,
        };
        buckets.push(bucket);
        index.set(bucket.key, bucket);
      }

      const statusCounts = { ...EMPTY_STATUS_COUNTS };
      const topMap = new Map<string, SalesTopProduct>();
      let revenue = 0;
      let orderCount = 0;
      let prevRevenue = 0;
      let prevOrders = 0;

      for (const order of orders) {
        const created = new Date(order.created_at);
        const current = created >= start;
        const counts = order.status !== 'cancelled';

        if (current) {
          statusCounts[order.status] += 1;
          if (counts) {
            revenue += order.total;
            orderCount += 1;
            const bucket = index.get(bucketKey(created, range.grain));
            if (bucket) {
              bucket.revenue += order.total;
              bucket.orders += 1;
            }
            for (const line of order.order_items ?? []) {
              const key = line.product_id ?? line.title;
              const entry = topMap.get(key) ?? {
                productId: line.product_id,
                title: line.title,
                imageUrl: line.image_url,
                quantity: 0,
                revenue: 0,
              };
              entry.quantity += line.quantity;
              entry.revenue += line.unit_price * line.quantity;
              topMap.set(key, entry);
            }
          }
        } else if (counts) {
          prevRevenue += order.total;
          prevOrders += 1;
        }
      }

      /* 瀏覽數只有 seller_statistics 有（每天一列）。 */
      let views = 0;
      let prevViews = 0;
      const startKey = localDate(start);
      for (const row of stats) {
        if (row.stat_date >= startKey) {
          views += row.views;
          const bucket = index.get(bucketKey(new Date(`${row.stat_date}T00:00:00`), range.grain));
          if (bucket) bucket.views += row.views;
        } else {
          prevViews += row.views;
        }
      }

      const topProducts = Array.from(topMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      return {
        buckets,
        revenue,
        orders: orderCount,
        views,
        revenueDelta: deltaPercent(revenue, prevRevenue),
        ordersDelta: deltaPercent(orderCount, prevOrders),
        viewsDelta: deltaPercent(views, prevViews),
        avgOrderValue: orderCount > 0 ? Math.round(revenue / orderCount) : 0,
        statusCounts,
        topProducts,
        rangeLabel: formatRangeLabel(start, now),
        startsAt: start.toISOString(),
      };
    },
  });
}

export function useStoreReviews(storeId: string | null) {
  return useQuery({
    enabled: !!storeId,
    queryKey: ['store-reviews', storeId],
    queryFn: async (): Promise<StoreReview[]> => {
      const { data: products } = await bilt
        .from('products')
        .select('id')
        .eq('store_id', storeId!)
        .returns<{ id: string }[]>();
      const ids = (products ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data, error } = await bilt
        .from('reviews')
        .select(
          '*, profile:profiles!reviews_user_profile_fkey(id, display_name, avatar_url), product:products(id, title, cover_url)',
        )
        .in('product_id', ids)
        .order('created_at', { ascending: false })
        .limit(200)
        .returns<StoreReview[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
