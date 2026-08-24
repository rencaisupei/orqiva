export type Role = 'buyer' | 'seller' | 'admin';

export type UserAccount = {
  id: string;
  email: string | null;
  phone: string | null;
  roles: Role[];
  notify_messages: boolean;
  notify_orders: boolean;
  notify_moderation: boolean;
  /** 賣家的 J幣簽到提醒與入帳通知。 */
  notify_coins: boolean;
  /** 收藏商品降價時通知買家。 */
  notify_price_drop: boolean;
  /** 商品庫存低於賣家設定的門檻時通知賣家。 */
  notify_low_stock: boolean;
  created_at: string;
  updated_at: string;
};

export type NotificationPrefs = Pick<
  UserAccount,
  | 'notify_messages'
  | 'notify_orders'
  | 'notify_moderation'
  | 'notify_coins'
  | 'notify_price_drop'
  | 'notify_low_stock'
>;

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  icon: string;
  sort_order: number;
  /** false = closed for new listings (e.g. digital goods, which App Store rules push into IAP). */
  is_listable: boolean;
};

export type CategoryWithCount = Category & { product_count: number };

export type Store = {
  id: string;
  owner_id: string | null;
  name: string;
  logo_url: string | null;
  /** 店舖頁最上方的橫幅圖片（store-assets bucket）。 */
  banner_url: string | null;
  description: string | null;
  location: string;
  /** 營業時間，jsonb。格式由 parseBusinessHours 保證，舊資料為 null。 */
  business_hours: BusinessHours | null;
  rating: number;
  rating_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/* ── 店舖營業時間 ────────────────────────────────────────────── */

/** 一天的營業時段。from / to 為 24 小時制的 'HH:MM'。 */
export type BusinessHoursDay = { open: boolean; from: string; to: string };

/**
 * 營業時間。days 固定 7 筆，index 0 = 週日（與 Date.getDay() 對齊），
 * 顯示時用 WEEKDAY_ORDER 換成週一開頭。mode 'always' = 24 小時營業。
 */
export type BusinessHours = {
  mode: 'always' | 'weekly';
  days: BusinessHoursDay[];
  note: string;
};

/** index 0 = 週日，與 Date.getDay() 相同。 */
export const WEEKDAY_LABEL = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
/** 顯示順序：週一開頭。 */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  mode: 'always',
  days: Array.from({ length: 7 }, () => ({ open: true, from: '09:00', to: '21:00' })),
  note: '',
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(value: string) {
  const [h, m] = value.split(':');
  return Number(h) * 60 + Number(m);
}

/** jsonb → BusinessHours。格式不對就回 null，畫面一律當成「未設定」。 */
export function parseBusinessHours(value: unknown): BusinessHours | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<BusinessHours>;
  const mode = raw.mode === 'weekly' ? 'weekly' : raw.mode === 'always' ? 'always' : null;
  if (!mode) return null;
  const days = Array.isArray(raw.days) ? raw.days : [];
  if (days.length !== 7) return null;
  const parsed: BusinessHoursDay[] = [];
  for (const day of days) {
    const from = typeof day?.from === 'string' && TIME_RE.test(day.from) ? day.from : '09:00';
    const to = typeof day?.to === 'string' && TIME_RE.test(day.to) ? day.to : '21:00';
    parsed.push({ open: day?.open, from, to });
  }
  return { mode, days: parsed, note: typeof raw.note === 'string' ? raw.note.slice(0, 120) : '' };
}

/** 今天是否營業中，以及一句顯示用的說明。跨午夜（例如 18:00–02:00）也算得對。 */
export function businessHoursStatus(
  hours: BusinessHours | null,
  now = new Date(),
): { open: boolean; label: string } | null {
  if (!hours) return null;
  if (hours.mode === 'always') return { open: true, label: '24 小時營業' };

  const minutes = now.getHours() * 60 + now.getMinutes();
  const todayIndex = now.getDay();
  const today = hours.days[todayIndex];
  const yesterday = hours.days[(todayIndex + 6) % 7];

  const inRange = (day: BusinessHoursDay, at: number) => {
    if (!day.open) return false;
    const from = toMinutes(day.from);
    const to = toMinutes(day.to);
    return to > from ? at >= from && at < to : at >= from;
  };
  /* 昨天的時段跨過午夜時，凌晨仍算營業中。 */
  const spillOver = (day: BusinessHoursDay, at: number) => {
    if (!day.open) return false;
    const from = toMinutes(day.from);
    const to = toMinutes(day.to);
    return to <= from && at < to;
  };

  if (inRange(today, minutes) || spillOver(yesterday, minutes)) {
    return { open: true, label: `營業中 · 今日 ${today.from}–${today.to}` };
  }
  if (today.open && minutes < toMinutes(today.from)) {
    return { open: false, label: `休息中 · 今日 ${today.from} 開始營業` };
  }
  for (let step = 1; step <= 7; step++) {
    const day = hours.days[(todayIndex + step) % 7];
    if (day.open) {
      const label = step === 1 ? '明天' : WEEKDAY_LABEL[(todayIndex + step) % 7];
      return { open: false, label: `休息中 · ${label} ${day.from} 開始營業` };
    }
  }
  return { open: false, label: '暫停營業' };
}

/** 兩天的營業時段是否相同（同開／同關且時段一致），用於把連續同時段的天數合併成一行。 */
function sameBusinessHoursDay(a: BusinessHoursDay, b: BusinessHoursDay): boolean {
  return a.open === b.open && (!a.open || (a.from === b.from && a.to === b.to));
}

/** 把 7 天壓成幾行，例如「週一至週五 09:00–18:00」「週六 休息」。 */
export function businessHoursLines(hours: BusinessHours | null): string[] {
  if (!hours) return [];
  if (hours.mode === 'always') return ['每天 24 小時營業'];

  const lines: string[] = [];
  let start = 0;

  for (let i = 0; i < WEEKDAY_ORDER.length; i++) {
    const current = hours.days[WEEKDAY_ORDER[i]];
    const next = i + 1 < WEEKDAY_ORDER.length ? hours.days[WEEKDAY_ORDER[i + 1]] : null;
    if (next && sameBusinessHoursDay(current, next)) continue;
    const startLabel = WEEKDAY_LABEL[WEEKDAY_ORDER[start]];
    const endLabel = WEEKDAY_LABEL[WEEKDAY_ORDER[i]];
    const range = start === i ? startLabel : `${startLabel}至${endLabel}`;
    lines.push(current.open ? `${range} ${current.from}–${current.to}` : `${range} 休息`);
    start = i + 1;
  }
  return lines;
}

export type StoreSummary = Pick<
  Store,
  'id' | 'name' | 'logo_url' | 'rating' | 'rating_count' | 'location'
>;

export type ProductCondition = 'new' | 'used';
export type ProductStatus = 'active' | 'draft' | 'suspended';

/* ── AI 驗證審核 ────────────────────────────────────────────── */

export type ModerationStatus = 'pending' | 'approved' | 'flagged' | 'rejected';

export const MODERATION_STATUS_LABEL: Record<ModerationStatus, string> = {
  pending: '審核中',
  approved: '審核通過',
  flagged: '待人工覆核',
  rejected: '審核未通過',
};

export type ModerationVerdict = 'approved' | 'flagged' | 'rejected';

export type ModerationReview = {
  id: string;
  target_type: 'product' | 'message' | 'report';
  target_id: string;
  owner_id: string | null;
  verdict: ModerationVerdict;
  risk_score: number;
  labels: string[];
  summary: string;
  suggestion: string | null;
  engine: 'openai' | 'rules' | 'admin';
  model: string | null;
  created_at: string;
};

export type MessageFlag = {
  id: string;
  message_id: string;
  conversation_id: string;
  sender_id: string | null;
  risk_score: number;
  labels: string[];
  reason: string;
  excerpt: string | null;
  status: 'open' | 'reviewed' | 'dismissed';
  created_at: string;
};

export type ModerationResult = {
  verdict: ModerationVerdict;
  risk: number;
  labels: string[];
  summary: string;
  suggestion: string;
  engine: 'openai' | 'rules';
};

export type MessageScanResult = {
  flagged: boolean;
  risk: number;
  labels?: string[];
  summary?: string;
  suggestion?: string;
};

export type Product = {
  id: string;
  store_id: string;
  seller_id: string | null;
  category_id: string | null;
  title: string;
  description: string;
  price: number;
  original_price: number | null;
  stock: number;
  /** 低庫存提醒門檻；0 = 賣家關閉提醒。 */
  low_stock_threshold: number;
  /** 上一次發出低庫存提醒的時間；庫存回到門檻以上時由伺服器清空。 */
  low_stock_notified_at: string | null;
  condition: ProductCondition;
  location: string;
  shipping_methods: string[];
  specs: Record<string, string>;
  status: ProductStatus;
  moderation_status: ModerationStatus;
  moderation_risk: number;
  moderation_labels: string[];
  moderation_summary: string | null;
  moderation_engine: string | null;
  moderation_model: string | null;
  moderated_at: string | null;
  rating: number;
  rating_count: number;
  sold_count: number;
  view_count: number;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductListItem = Product & {
  store: StoreSummary | null;
  /**
   * 賣家用J幣兌換的「商品置頂」。不是資料庫欄位，而是列表查詢時對照
   * product_boosts（只有伺服器寫得進去）標記出來的，所以賣家無法自己造假。
   */
  is_boosted?: boolean;
};

export type ProductDetail = ProductListItem & {
  category: Pick<Category, 'id' | 'name' | 'slug'> | null;
  product_images: { id: string; url: string; sort_order: number }[];
};

export type CartItem = {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  shipping_method: string;
  selected: boolean;
  product: ProductListItem | null;
};

/**
 * 願望清單的一列。`watch_price` 是收藏當下（或上一次通知後）的價格，
 * 降價巡邏就是拿它跟現價比；null 代表巡邏還沒建立基準價。
 */
export type FavoriteItem = {
  product: ProductListItem;
  watch_price: number | null;
  price_notified_at: string | null;
  created_at: string;
};

export type PriceDrop = { amount: number; percent: number };

/** 現價比基準價低多少。沒有基準價或沒有降價時回 null。 */
export function priceDrop(price: number, watchPrice: number | null): PriceDrop | null {
  if (watchPrice === null || watchPrice <= 0 || price >= watchPrice) return null;
  const amount = watchPrice - price;
  return { amount, percent: Math.round((amount / watchPrice) * 100) };
}

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  title: string;
  unit_price: number;
  quantity: number;
  /** 這一列的數量折扣（階梯式批量折扣），由伺服器計算。 */
  discount: number;
  image_url: string | null;
  reviewed: boolean;
};

export type Order = {
  id: string;
  order_no: string;
  buyer_id: string;
  store_id: string | null;
  seller_id: string | null;
  status: OrderStatus;
  subtotal: number;
  shipping_fee: number;
  /** 數量折扣（階梯式批量折扣）合計。 */
  bulk_discount: number;
  /** 折扣碼折抵金額。 */
  discount: number;
  coupon_id: string | null;
  coupon_code: string | null;
  total: number;
  shipping_method: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  shipping_address: string | null;
  note: string | null;
  /* 綠界物流：超商取貨付款（CVS）或黑貓宅急便貨到付款（HOME） */
  shipping_provider: 'manual' | 'ecpay';
  logistics_type: string | null;
  logistics_sub_type: string | null;
  /* 宅配貨到付款的收件地址（黑貓建單需要 ReceiverZipCode / ReceiverAddress） */
  receiver_zip_code: string | null;
  receiver_city: string | null;
  receiver_address: string | null;
  cvs_store_id: string | null;
  cvs_store_name: string | null;
  cvs_store_address: string | null;
  cvs_store_phone: string | null;
  logistics_status: string | null;
  logistics_shipment_no: string | null;
  logistics_validation_no: string | null;
  logistics_id: string | null;
  /** 黑貓宅急便的託運單號（BookingNote），賣家列印託運單用。 */
  logistics_booking_note: string | null;
  created_at: string;
  updated_at: string;
  store: Pick<Store, 'id' | 'name' | 'logo_url'> | null;
  order_items: OrderItem[];
};

/* ── 階梯式批量折扣 ──────────────────────────────────────────── */

/** 一個數量門檻。percent 是整列金額的折扣百分比（1~90），與 DB check 相同。 */
export type BulkTier = {
  id?: string;
  product_id?: string;
  min_quantity: number;
  percent: number;
};

export const MAX_BULK_TIERS = 4;
export const MIN_BULK_QUANTITY = 2;
export const MAX_BULK_QUANTITY = 999;
export const MIN_BULK_PERCENT = 1;
export const MAX_BULK_PERCENT = 90;

/** 由大到小排序，方便取「目前命中的門檻」。 */
export function sortBulkTiers(tiers: BulkTier[]): BulkTier[] {
  return [...tiers].sort((a, b) => b.min_quantity - a.min_quantity);
}

/** 目前數量命中的門檻，沒有就 null。 */
export function activeBulkTier(tiers: BulkTier[], quantity: number): BulkTier | null {
  return sortBulkTiers(tiers).find((tier) => quantity >= tier.min_quantity) ?? null;
}

/** 再多買幾件就能進下一階；已在最高階回 null。 */
export function nextBulkTier(tiers: BulkTier[], quantity: number): BulkTier | null {
  const ascending = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);
  return ascending.find((tier) => quantity < tier.min_quantity) ?? null;
}

/**
 * 這一列的折扣金額。與 market edge function 的 bulkDiscountFor 必須一致
 * （整列金額乘上百分比後向下取整），否則畫面與訂單金額會差一元。
 */
export function bulkDiscountFor(price: number, quantity: number, tiers: BulkTier[]): number {
  const tier = activeBulkTier(tiers, quantity);
  if (!tier) return 0;
  const discount = Math.floor((price * quantity * tier.percent) / 100);
  return Math.max(0, Math.min(discount, price * quantity));
}

/** 賣家設定階梯時的檢查，回傳錯誤訊息或 null。 */
export function validateBulkTiers(tiers: BulkTier[]): string | null {
  if (tiers.length > MAX_BULK_TIERS) return `最多只能設定 ${MAX_BULK_TIERS} 個數量門檻。`;
  const seen = new Set<number>();
  for (const tier of tiers) {
    if (
      !Number.isInteger(tier.min_quantity) ||
      tier.min_quantity < MIN_BULK_QUANTITY ||
      tier.min_quantity > MAX_BULK_QUANTITY
    ) {
      return `數量門檻需為 ${MIN_BULK_QUANTITY}~${MAX_BULK_QUANTITY} 件的整數。`;
    }
    if (tier.percent < MIN_BULK_PERCENT || tier.percent > MAX_BULK_PERCENT) {
      return `折扣需在 ${MIN_BULK_PERCENT}~${MAX_BULK_PERCENT}% 之間。`;
    }
    if (seen.has(tier.min_quantity)) return '同一個數量門檻只能設定一次。';
    seen.add(tier.min_quantity);
  }
  const ascending = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);
  for (let i = 1; i < ascending.length; i++) {
    if (ascending[i].percent <= ascending[i - 1].percent) {
      return '買越多要折越多：數量門檻越高的折扣百分比必須更大。';
    }
  }
  return null;
}

/* ── 賣家優惠券 ──────────────────────────────────────────────── */

export type CouponKind = 'percent' | 'fixed' | 'free_shipping';

export const COUPON_KIND_LABEL: Record<CouponKind, string> = {
  percent: '百分比折扣',
  fixed: '固定金額',
  free_shipping: '免運費',
};

export const COUPON_KINDS: CouponKind[] = ['percent', 'fixed', 'free_shipping'];

/** 折扣碼：4~20 碼英數字，一律以大寫儲存與比對。 */
export const COUPON_CODE_RE = /^[A-Z0-9]{4,20}$/;

export function normalizeCouponCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
}

export function validateCouponCode(value: string): string | null {
  return COUPON_CODE_RE.test(normalizeCouponCode(value)) ? null : '折扣碼請填 4~20 碼英文或數字。';
}

export type Coupon = {
  id: string;
  store_id: string;
  seller_id: string | null;
  code: string;
  title: string;
  kind: CouponKind;
  /** percent: 折扣百分比（1~90）；fixed: 折抵金額；free_shipping: 不使用。 */
  value: number;
  /** 百分比折扣的折抵上限，null = 不設限。 */
  max_discount: number | null;
  min_spend: number;
  /** null = 不限總使用次數。 */
  usage_limit: number | null;
  /** null = 同一位買家可重複使用。 */
  per_user_limit: number | null;
  used_count: number;
  /** 空陣列 = 全店適用。 */
  product_ids: string[];
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CouponState = 'live' | 'scheduled' | 'expired' | 'used_up' | 'disabled';

export const COUPON_STATE_LABEL: Record<CouponState, string> = {
  live: '進行中',
  scheduled: '尚未開始',
  expired: '已過期',
  used_up: '已用完',
  disabled: '已停用',
};

export function couponState(coupon: Coupon, now = Date.now()): CouponState {
  if (!coupon.is_active) return 'disabled';
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) return 'used_up';
  if (new Date(coupon.starts_at).getTime() > now) return 'scheduled';
  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) return 'expired';
  return 'live';
}

/** 買家看得到的券只有進行中的。 */
export function isCouponLive(coupon: Coupon, now = Date.now()): boolean {
  return couponState(coupon, now) === 'live';
}

/** 這張券是否適用於某件商品（空的 product_ids 代表全店）。 */
export function couponCoversProduct(coupon: Coupon, productId: string): boolean {
  return coupon.product_ids.length === 0 || coupon.product_ids.includes(productId);
}

export type Review = {
  id: string;
  product_id: string;
  order_id: string | null;
  user_id: string;
  rating: number;
  comment: string;
  /** 買家上傳的實拍照片（public bucket `review-images` 的網址）。 */
  images: string[];
  created_at: string;
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null;
  /** 賣家的公開回覆；null = 還沒回覆。只有 notify 函式寫得進去。 */
  seller_reply: string | null;
  seller_reply_at: string | null;
  seller_reply_by: string | null;
};

/** 賣家分析頁用的評價：多帶商品資訊，因為一間店有很多商品。 */
export type StoreReview = Review & {
  product: Pick<Product, 'id' | 'title' | 'cover_url'> | null;
};

/** 一到五星各有幾筆，用來畫評價分佈。 */
export function ratingBreakdown(reviews: Pick<Review, 'rating'>[]): number[] {
  const buckets = [0, 0, 0, 0, 0];
  for (const review of reviews) {
    const index = Math.min(5, Math.max(1, Math.round(review.rating))) - 1;
    buckets[index] += 1;
  }
  return buckets;
}

export const MAX_REVIEW_IMAGES = 5;

/** 賣家回覆的字數上限（與 notify 函式的 MAX_REPLY_LENGTH 一致）。 */
export const MAX_REVIEW_REPLY = 500;

/** 低庫存門檻的上限，避免賣家誤填成庫存數字。 */
export const MAX_LOW_STOCK_THRESHOLD = 999;

/** 這件商品目前是否低於賣家設定的提醒門檻（門檻 0 = 關閉提醒）。 */
export function isLowStock(product: Pick<Product, 'stock' | 'low_stock_threshold'>): boolean {
  return product.low_stock_threshold > 0 && product.stock <= product.low_stock_threshold;
}

export type Conversation = {
  id: string;
  buyer_id: string;
  seller_id: string | null;
  store_id: string;
  product_id: string | null;
  last_message: string | null;
  last_message_at: string;
  store: Pick<Store, 'id' | 'name' | 'logo_url'> | null;
  product: Pick<Product, 'id' | 'title' | 'cover_url' | 'price'> | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type NotificationType =
  | 'new_order'
  | 'order_status'
  | 'seller_reply'
  | 'product_sold'
  | 'product_published'
  | 'system'
  | 'message'
  | 'moderation'
  | 'support'
  | 'logistics'
  | 'price_drop'
  | 'low_stock';

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

export type SellerStatistic = {
  id: string;
  store_id: string;
  stat_date: string;
  views: number;
  orders_count: number;
  revenue: number;
};

export type ReportSeverity = 'low' | 'medium' | 'high' | 'critical';

export const REPORT_SEVERITY_LABEL: Record<ReportSeverity, string> = {
  low: '輕微',
  medium: '一般',
  high: '高風險',
  critical: '緊急',
};

export type Report = {
  id: string;
  reporter_id: string;
  target_type: 'product' | 'store' | 'user';
  target_id: string;
  reason: string;
  status: 'open' | 'reviewing' | 'resolved';
  severity: ReportSeverity | null;
  ai_summary: string | null;
  ai_labels: string[];
  suggested_action: string | null;
  triaged_at: string | null;
  created_at: string;
};

/* ── 客服工單（聯絡我們）──────────────────────────────────────── */

export type SupportCategory =
  | 'order'
  | 'payment'
  | 'logistics'
  | 'account'
  | 'product'
  | 'report'
  | 'other';

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  order: '訂單問題',
  payment: '付款問題',
  logistics: '物流與取貨',
  account: '帳號與登入',
  product: '商品與上架',
  report: '檢舉與申訴',
  other: '其他',
};

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  'order',
  'payment',
  'logistics',
  'account',
  'product',
  'report',
  'other',
];

/** Narrows a picker value onto the union; unknown values become null. */
export function toSupportCategory(value: string): SupportCategory | null {
  return SUPPORT_CATEGORIES.find((item) => item === value) ?? null;
}

export type SupportTicketStatus = 'open' | 'in_progress' | 'closed';

export const SUPPORT_STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: '待處理',
  in_progress: '處理中',
  closed: '已結案',
};

export type SupportTicket = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SortKey = 'newest' | 'popular' | 'price_asc' | 'price_desc' | 'rating';

export type ProductFilters = {
  categoryId?: string;
  storeId?: string;
  sellerId?: string;
  q?: string;
  sort?: SortKey;
  minPrice?: number;
  maxPrice?: number;
  condition?: ProductCondition;
  location?: string;
  minRating?: number;
  shipping?: string;
  limit?: number;
};

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: '最新' },
  { key: 'popular', label: '熱門' },
  { key: 'price_asc', label: '價格低到高' },
  { key: 'price_desc', label: '價格高到低' },
  { key: 'rating', label: '評價最高' },
];

/** Narrows a `?sort=` query param onto the union; anything else falls back to 最新. */
export function toSortKey(value: string | undefined): SortKey {
  return SORT_OPTIONS.find((option) => option.key === value)?.key ?? 'newest';
}

export const SHIPPING_METHODS = ['宅配', '超商取貨', '面交'] as const;

/* ── 綠界 (ECPay) 物流：超商取貨付款 + 黑貓宅急便貨到付款 ─────────── */

/**
 * 只保留支援「貨到付款（代收貨款）」的四種物流。
 * 綠界 C2C 的 OK 超商與中華郵政不支援代收貨款，所以不再提供。
 *
 * 超商是 C2C 店到店（LogisticsType = CVS），黑貓宅急便是宅配（LogisticsType = HOME）。
 */
export type CvsSubType = 'UNIMARTC2C' | 'FAMIC2C' | 'HILIFEC2C';
export type HomeSubType = 'TCAT';
export type LogisticsSubType = CvsSubType | HomeSubType;

export const CVS_SUB_TYPES: CvsSubType[] = ['UNIMARTC2C', 'FAMIC2C', 'HILIFEC2C'];
export const HOME_SUB_TYPES: HomeSubType[] = ['TCAT'];
export const LOGISTICS_SUB_TYPES: LogisticsSubType[] = [...CVS_SUB_TYPES, ...HOME_SUB_TYPES];

/** 物流商名稱（後台、物流面板用）。 */
export const LOGISTICS_SUB_TYPE_LABEL: Record<LogisticsSubType, string> = {
  UNIMARTC2C: '7-ELEVEN 交貨便',
  FAMIC2C: '全家店到店',
  HILIFEC2C: '萊爾富店到店',
  TCAT: '黑貓宅急便',
};

/** 結帳頁的貨到付款選項名稱。 */
export const COD_OPTION_LABEL: Record<LogisticsSubType, string> = {
  UNIMARTC2C: '7-11 取貨付款',
  FAMIC2C: '全家 取貨付款',
  HILIFEC2C: '萊爾富 取貨付款',
  TCAT: '黑貓宅急便 貨到付款',
};

export function isCvsSubType(value: string | null | undefined): value is CvsSubType {
  return CVS_SUB_TYPES.some((item) => item === value);
}

export function isHomeSubType(value: string | null | undefined): value is HomeSubType {
  return HOME_SUB_TYPES.some((item) => item === value);
}

/** 綠界的 LogisticsType：超商是 CVS，黑貓宅急便是 HOME。 */
export function logisticsTypeOf(subType: LogisticsSubType): 'CVS' | 'HOME' {
  return isHomeSubType(subType) ? 'HOME' : 'CVS';
}

export function toCvsSubType(value: string | null | undefined): CvsSubType | null {
  return isCvsSubType(value) ? value : null;
}

/* ── 代收貨款金額限制 ─────────────────────────────────────────── */

/** 超商取貨付款：商品金額 + 運費須在 31 ~ 20,000 元之間。 */
export const CVS_COD_MIN = 31;
export const CVS_COD_MAX = 20_000;
/** 黑貓宅急便貨到付款的代收金額上限。 */
export const HOME_COD_MAX = 99_999;

export const CVS_COD_RANGE_HINT =
  '💡 提醒：超商取貨付款總金額限制為 NT$ 31 ~ $ 20,000，超出此限制請選用其他配送方式。';

/**
 * 貨到付款的金額檢查（商品金額 + 運費）。null = 可以送出。
 * 與 market / ecpay-logistics 兩支伺服器函式用同一組上下限，避免綠界建單才被擋。
 */
export function codAmountError(subType: LogisticsSubType, total: number): string | null {
  if (isHomeSubType(subType)) {
    return total > HOME_COD_MAX
      ? `黑貓宅急便貨到付款代收金額上限為 NT$ ${HOME_COD_MAX.toLocaleString('en-US')}`
      : null;
  }
  if (total < CVS_COD_MIN || total > CVS_COD_MAX) return CVS_COD_RANGE_HINT;
  return null;
}

/**
 * Narrows a stored text column (`orders.logistics_sub_type` and friends) onto the
 * union at runtime; anything unrecognised becomes null instead of being asserted.
 */
export function toLogisticsSubType(value: string | null | undefined): LogisticsSubType | null {
  return LOGISTICS_SUB_TYPES.find((item) => item === value) ?? null;
}

/** 綠界測試環境的固定門市代號，方便在 stage 直接測完整流程。 */
export const LOGISTICS_TEST_STORE_ID: Record<CvsSubType, string> = {
  UNIMARTC2C: '131386',
  FAMIC2C: '006598',
  HILIFEC2C: '007564',
};

export type LogisticsEnvironment = 'stage' | 'production';

export type LogisticsStatus =
  | 'draft'
  | 'requested'
  | 'created'
  | 'in_transit'
  | 'arrived'
  | 'picked_up'
  | 'returned'
  | 'cancelled'
  | 'failed';

export const LOGISTICS_STATUS_LABEL: Record<LogisticsStatus, string> = {
  draft: '尚未送出',
  requested: '已送出綠界',
  created: '物流單已建立',
  in_transit: '運送中',
  arrived: '已到店，可取貨',
  picked_up: '買家已取貨',
  returned: '已退回',
  cancelled: '已取消',
  failed: '建立失敗',
};

export const LOGISTICS_STATUSES: LogisticsStatus[] = [
  'draft',
  'requested',
  'created',
  'in_transit',
  'arrived',
  'picked_up',
  'returned',
  'cancelled',
  'failed',
];

/**
 * Narrows `orders.logistics_status` (a plain text column kept in sync by the
 * ECPay callback and the sync action) onto the union; unknown text becomes null.
 */
export function toLogisticsStatus(value: string | null | undefined): LogisticsStatus | null {
  return LOGISTICS_STATUSES.find((item) => item === value) ?? null;
}

/**
 * 買家看得懂的出貨階段：把綠界九種貨態收斂成訂單列表可以篩選的幾個桶。
 * `awaiting` 也涵蓋「還沒建立物流單」的超商取貨訂單。
 */
export type ShipmentStage =
  | 'awaiting'
  | 'created'
  | 'in_transit'
  | 'arrived'
  | 'picked_up'
  | 'issue';

export const SHIPMENT_STAGE_LABEL: Record<ShipmentStage, string> = {
  awaiting: '待出貨',
  created: '已建單',
  in_transit: '運送中',
  arrived: '待取貨',
  picked_up: '已取貨',
  issue: '退回／異常',
};

const SHIPMENT_STAGE_BY_STATUS: Record<LogisticsStatus, ShipmentStage> = {
  draft: 'awaiting',
  requested: 'awaiting',
  created: 'created',
  in_transit: 'in_transit',
  arrived: 'arrived',
  picked_up: 'picked_up',
  returned: 'issue',
  cancelled: 'issue',
  failed: 'issue',
};

export function shipmentStage(status: LogisticsStatus | null): ShipmentStage {
  return status ? SHIPMENT_STAGE_BY_STATUS[status] : 'awaiting';
}

/** 這筆訂單是不是走綠界超商取貨（宅配訂單沒有貨態可同步）。 */
export function isCvsOrder(order: Pick<Order, 'shipping_provider' | 'cvs_store_id'>): boolean {
  return order.shipping_provider === 'ecpay' || !!order.cvs_store_id;
}

/**
 * 出貨之後才值得自動向綠界查貨態：必須是超商取貨、已經拿到寄貨編號
 * （代表賣家真的建了物流單），而且貨還在途中。
 */
export function isAutoSyncableShipment(
  order: Pick<
    Order,
    'shipping_provider' | 'cvs_store_id' | 'logistics_shipment_no' | 'logistics_status'
  >,
): boolean {
  if (!isCvsOrder(order)) return false;
  if (!order.logistics_shipment_no) return false;
  return isTrackableShipment(toLogisticsStatus(order.logistics_status));
}

export function isTrackableShipment(status: LogisticsStatus | null): boolean {
  return (
    status === 'requested' ||
    status === 'created' ||
    status === 'in_transit' ||
    status === 'arrived'
  );
}

/** 平台系統設定：維護模式與全站公告，所有人都讀得到，只有管理員能改。 */
export type AppSettings = {
  id: string;
  maintenance_enabled: boolean;
  maintenance_title: string;
  maintenance_message: string;
  maintenance_started_at: string | null;
  /** 排程維護：開啟後在 starts_at ~ ends_at 之間自動進入維護，時間到自動解除。 */
  maintenance_schedule_enabled: boolean;
  maintenance_starts_at: string | null;
  maintenance_ends_at: string | null;
  /** 排程開始前多少分鐘顯示預告橫幅。 */
  maintenance_notice_minutes: number;
  announcement_enabled: boolean;
  announcement_message: string;
  min_supported_version: string | null;
  /** 自動清理：關閉後就不會再有任何背景清理，資料會一直累積。 */
  cleanup_enabled: boolean;
  /** 兩次清理最短間隔（小時，1~168）。 */
  cleanup_interval_hours: number;
  /** 已讀通知與失效推播裝置保留天數。 */
  cleanup_notification_days: number;
  /** 歷史紀錄（貨態、審核、已結案檢舉、久放購物車）保留天數。 */
  cleanup_history_days: number;
  cleanup_last_run_at: string | null;
  /** 有值代表某一次清理正在進行（5 分鐘後視為逾時可接手）。 */
  cleanup_running_since: string | null;
  cleanup_last_total: number;
  /** 自動審核：關閉後 AI 只在賣家送審那一刻跑一次，佇列要靠人工清。 */
  auto_review_enabled: boolean;
  /** 兩次自動巡邏最短間隔（小時，1~168）。 */
  auto_review_interval_hours: number;
  /** 風險分數 ≤ 這個值的待覆核商品自動放行（0~100）。 */
  auto_approve_max_risk: number;
  /** 風險分數 ≥ 這個值的待覆核商品自動退回；101 = 不自動退回。 */
  auto_reject_min_risk: number;
  auto_review_last_run_at: string | null;
  /** 有值代表某一次自動巡邏正在進行（5 分鐘後視為逾時可接手）。 */
  auto_review_running_since: string | null;
  auto_review_last_total: number;
  /** 收藏降價巡邏：關閉後買家不會再收到收藏商品的降價通知。 */
  price_watch_enabled: boolean;
  /** 兩次降價巡邏最短間隔（小時，1~168）。 */
  price_watch_interval_hours: number;
  /** 至少跌這個百分比才通知（1~90），避免一塊錢也發推播。 */
  price_watch_min_drop_percent: number;
  price_watch_last_run_at: string | null;
  /** 有值代表某一次巡邏正在進行（5 分鐘後視為逾時可接手）。 */
  price_watch_running_since: string | null;
  price_watch_last_total: number;
  updated_at: string;
  updated_by: string | null;
};

export type LogisticsSettings = {
  id: string;
  provider: string;
  environment: LogisticsEnvironment;
  is_enabled: boolean;
  enabled_sub_types: LogisticsSubType[];
  is_collection_enabled: boolean;
  /** 測試環境改用綠界公開的 C2C 測試特店（2000933）；正式環境永遠用自己的金鑰。 */
  use_test_credentials: boolean;
  /**
   * 已停用的平台寄件人欄位。物流單的 SenderName / SenderCellPhone 一律取自
   * seller_shipping_profiles（賣家自己填的本名與手機），這些欄位不再送給綠界。
   */
  sender_name: string | null;
  sender_phone: string | null;
  sender_cell_phone: string | null;
  sender_zip_code: string | null;
  sender_address: string | null;
  return_store_ids: Partial<Record<LogisticsSubType, string>>;
  default_goods_name: string;
  temperature: string;
  specification: string;
  scheduled_pickup_time: string;
  platform_id: string | null;
  last_verified_at: string | null;
  last_verify_result: LogisticsVerifyResult | Record<string, never>;
  created_at: string;
  updated_at: string;
};

/* ── 賣家寄件人資料（綠界 C2C SenderName / SenderCellPhone）──── */

/**
 * 每個賣家自己的寄件人身分。個資，只有本人與管理員讀得到
 * （放在 seller_shipping_profiles，而不是全站可讀的 stores / profiles）。
 */
export type SellerShippingProfile = {
  user_id: string;
  sender_name: string;
  sender_cell_phone: string;
  /** 黑貓宅急便（宅配）建單必填的寄件地址；超商店到店不需要。 */
  sender_zip_code: string | null;
  sender_address: string | null;
  created_at: string;
  updated_at: string;
  /* 綠界 C2C 取貨付款開通狀態，由 ecpay-logistics 的 seller_verify 寫入 */
  is_logistics_active: boolean;
  verification_status: SellerVerificationStatus;
  verification_reason: string | null;
  verification_message: string | null;
  last_checked_at: string | null;
  verified_at: string | null;
};

/**
 * 賣家的超商取貨付款開通狀態。
 * unverified = 寄件人資料還沒填；pending = 等綠界／平台開通；
 * active = 可以收取貨付款訂單；failed = 檢查時出錯（金鑰或連線）。
 */
export type SellerVerificationStatus = 'unverified' | 'pending' | 'active' | 'failed';

/**
 * seller_logistics_status：不含個資的公開鏡像，買家端用它判斷要不要提供取貨付款。
 * 沒有對應列 = 尚未完成驗證，一律視為未開通。
 */
export type SellerLogisticsStatus = {
  user_id: string;
  is_logistics_active: boolean;
  verification_status: SellerVerificationStatus;
  checked_at: string | null;
  updated_at: string;
};

/** 商品／購物車裡代表超商取貨的配送方式字串。 */
export const CVS_SHIPPING_METHOD = '超商取貨';

/** 賣家端狀態文案（與 ecpay-logistics 的 SELLER_MESSAGES 對應）。 */
export const SELLER_LOGISTICS_ACTIVE_LABEL = '✅ 超商取貨付款功能已開通！';
export const SELLER_LOGISTICS_PENDING_LABEL =
  '⚠️ 您的綠界帳號目前正在官方審核中（預計 2-3 個工作天），審核完成後系統將自動為您開啟取貨付款功能，您目前仍可正常上架商品。';

/** 買家端看到的說明：這位賣家還不能提供取貨付款。 */
export const CVS_SELLER_INACTIVE_HINT = '此賣家的超商取貨付款尚在綠界審核中，目前只能選擇宅配。';

/** 綠界 C2C 寄件人姓名：本名 2~5 個字（退貨需憑本人身分證領取）。null = 通過。 */
export function validateSenderName(value: string): string | null {
  const name = value.trim();
  if (!name) return '請填寫寄件人姓名（本名）';
  if (name.length < 2 || name.length > 5)
    return '寄件人姓名需為 2~5 個字的本名，請勿填公司或店舖名稱';
  return null;
}

/** 綠界 C2C 寄件人手機：09 開頭 10 碼。null = 通過。 */
export function validateSenderCellPhone(value: string): string | null {
  const phone = value.trim();
  if (!phone) return '請填寫寄件人手機';
  if (!/^09\d{8}$/.test(phone)) return '寄件人手機需為 09 開頭的 10 碼數字';
  return null;
}

/**
 * 綠界超商取貨的收件人姓名只接受中文本名（到店取貨要核對證件），
 * 英文字母、數字、空白、表情符號、標點都會被超商系統退掉。
 * 涵蓋常用漢字、擴充 A 區與相容漢字，長度以字元數計 2~5。
 */
const CHINESE_NAME_RE = /^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]{2,5}$/;

export const RECEIVER_NAME_ERROR = '請輸入 2-5 字的真實中文姓名，以免無法在超商取貨。';
export const RECEIVER_CELL_PHONE_ERROR = '請輸入正確的 10 碼台灣手機號碼 (如: 0912345678)。';

/** 超商取貨收件人姓名：2~5 個中文字。null = 通過。 */
export function validateReceiverName(value: string): string | null {
  return CHINESE_NAME_RE.test(value.trim()) ? null : RECEIVER_NAME_ERROR;
}

/** 超商取貨收件人手機：09 開頭 10 碼數字。null = 通過。 */
export function validateReceiverCellPhone(value: string): string | null {
  return /^09\d{8}$/.test(value.trim()) ? null : RECEIVER_CELL_PHONE_ERROR;
}

/* ── 宅配貨到付款的收件地址 ───────────────────────────────────── */

export const RECEIVER_ZIP_ERROR = '請填寫 3~5 碼的郵遞區號（例如 100 或 10058）。';

/** 宅配收件郵遞區號：3~5 碼數字。null = 通過。 */
export function validateReceiverZipCode(value: string): string | null {
  return /^\d{3,5}$/.test(value.trim()) ? null : RECEIVER_ZIP_ERROR;
}

/** 宅配收件縣市：至少 2 個字（例如「臺北市中正區」）。null = 通過。 */
export function validateReceiverCity(value: string): string | null {
  return value.trim().length >= 2 ? null : '請填寫收件的縣市與地區。';
}

/** 宅配詳細地址：至少 5 個字，需含路名門牌。null = 通過。 */
export function validateReceiverAddress(value: string): string | null {
  return value.trim().length >= 5 ? null : '請填寫詳細地址（路名、門牌與樓層）。';
}

export type LogisticsVerifyResult = {
  ok: boolean;
  environment: LogisticsEnvironment;
  reason?: string;
  message?: string;
  apiHost?: string;
  merchantId?: string;
  /** 'env' = 專案環境變數的金鑰；'ecpay_test' = 綠界公用測試特店。 */
  credentialSource?: 'env' | 'ecpay_test';
  /** 這次驗證後一併重算開通狀態的賣家數量。 */
  sellersChecked?: number;
  sellersActive?: number;
  raw?: string;
};

export type LogisticsPublicConfig = {
  provider: string;
  environment: LogisticsEnvironment;
  is_enabled: boolean;
  enabled_sub_types: LogisticsSubType[];
  is_collection_enabled: boolean;
};

export type LogisticsOrder = {
  id: string;
  order_id: string;
  provider: string;
  environment: LogisticsEnvironment;
  merchant_trade_no: string;
  merchant_trade_date: string | null;
  logistics_type: string;
  logistics_sub_type: LogisticsSubType;
  is_collection: boolean;
  goods_amount: number;
  collection_amount: number;
  goods_name: string;
  status: LogisticsStatus;
  receiver_store_id: string | null;
  receiver_store_name: string | null;
  receiver_store_address: string | null;
  receiver_store_phone: string | null;
  return_store_id: string | null;
  receiver_name: string | null;
  receiver_cell_phone: string | null;
  receiver_email: string | null;
  receiver_zip_code: string | null;
  receiver_address: string | null;
  sender_name: string | null;
  ecpay_logistics_id: string | null;
  shipment_no: string | null;
  validation_no: string | null;
  booking_note: string | null;
  rtn_code: string | null;
  rtn_msg: string | null;
  logistics_status_code: string | null;
  created_at: string;
  updated_at: string;
};

export type LogisticsEvent = {
  id: string;
  logistics_order_id: string | null;
  merchant_trade_no: string | null;
  source: string;
  rtn_code: string | null;
  rtn_msg: string | null;
  logistics_status: string | null;
  created_at: string;
};

/*
 * All 22 Taiwanese cities/counties, ordered north → south → east → outlying
 * islands. Written with 台 (not 臺) so the values keep matching the rows that
 * already exist in `products.location` / `stores.location`.
 */
export const LOCATIONS = [
  '基隆市',
  '台北市',
  '新北市',
  '桃園市',
  '新竹市',
  '新竹縣',
  '苗栗縣',
  '台中市',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義市',
  '嘉義縣',
  '台南市',
  '高雄市',
  '屏東縣',
  '宜蘭縣',
  '花蓮縣',
  '台東縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
  '其他',
] as const;

/* ─────────────────────────────────────────────────────────────
 * 首頁欄位（限時特賣／熱門推薦／好評推薦…）與廣告輪播
 *
 * 每個欄位都由 home_sections 這一列決定：要不要顯示、標題、順序，
 * 以及內容是「系統自動」（auto_kind 決定排序規則）或「管理員挑選」
 * （home_section_items 裡審核過的商品）。
 * ───────────────────────────────────────────────────────────── */

export type HomeSectionSource = 'auto' | 'manual';
export type HomeAutoKind = 'deals' | 'popular' | 'rating' | 'newest' | 'price_asc';
export type HomeSectionLayout = 'rail' | 'grid';

export type HomeSection = {
  key: string;
  title: string;
  subtitle: string;
  source: HomeSectionSource;
  auto_kind: HomeAutoKind;
  layout: HomeSectionLayout;
  item_limit: number;
  is_visible: boolean;
  sort_order: number;
  updated_at: string;
  updated_by: string | null;
};

export const HOME_SOURCE_LABEL: Record<HomeSectionSource, string> = {
  auto: '系統自動',
  manual: '管理員挑選',
};

export const HOME_AUTO_KIND_LABEL: Record<HomeAutoKind, string> = {
  deals: '降價最多',
  popular: '賣最好',
  rating: '評價 4 星以上',
  newest: '最新上架',
  price_asc: '價格由低到高',
};

export const HOME_AUTO_KINDS: HomeAutoKind[] = [
  'deals',
  'popular',
  'rating',
  'newest',
  'price_asc',
];

/** 自動欄位的「查看全部」要帶哪個排序；人工挑選的欄位沒有對應排序。 */
export const HOME_AUTO_SORT: Record<HomeAutoKind, SortKey> = {
  deals: 'newest',
  popular: 'popular',
  rating: 'rating',
  newest: 'newest',
  price_asc: 'price_asc',
};

export type HomeSectionItem = {
  id: string;
  section_key: string;
  product_id: string;
  sort_order: number;
  created_at: string;
};

export type AdBannerLinkType = 'none' | 'product' | 'store' | 'category' | 'search';

export const AD_BANNER_LINK_LABEL: Record<AdBannerLinkType, string> = {
  none: '不連結',
  product: '商品',
  store: '店舖',
  category: '分類',
  search: '搜尋關鍵字',
};

export const AD_BANNER_LINK_TYPES: AdBannerLinkType[] = [
  'none',
  'product',
  'store',
  'category',
  'search',
];

/** 廣告版位：首頁輪播、開啟 App 的彈出廣告，或兩邊都出現。 */
export type AdBannerPlacement = 'carousel' | 'popup' | 'both';

export const AD_BANNER_PLACEMENT_LABEL: Record<AdBannerPlacement, string> = {
  carousel: '首頁輪播',
  popup: '開啟時彈出',
  both: '兩邊都放',
};

export const AD_BANNER_PLACEMENTS: AdBannerPlacement[] = ['carousel', 'popup', 'both'];

export type AdBanner = {
  id: string;
  title: string;
  subtitle: string;
  image_url: string | null;
  link_type: AdBannerLinkType;
  link_value: string | null;
  cta_label: string;
  placement: AdBannerPlacement;
  is_active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

/** 這張橫幅要不要出現在首頁輪播。 */
export function isCarouselBanner(banner: AdBanner): boolean {
  return banner.placement !== 'popup';
}

/** 這張橫幅要不要當成開啟 App 的彈出廣告。 */
export function isPopupBanner(banner: AdBanner): boolean {
  return banner.placement === 'popup' || banner.placement === 'both';
}

/** 上架中且在起訖時間內；買家端的 RLS 也是同一條規則。 */
export function isBannerLive(banner: AdBanner, now = Date.now()): boolean {
  if (!banner.is_active) return false;
  if (banner.starts_at && new Date(banner.starts_at).getTime() > now) return false;
  if (banner.ends_at && new Date(banner.ends_at).getTime() < now) return false;
  return true;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待付款',
  paid: '備貨中',
  shipped: '已出貨',
  completed: '已完成',
  cancelled: '已取消',
};

/* ── J幣（賣家專屬點數） ─────────────────────────────────────── */

/** 幣的名字。只有賣家賺得到、也只能用在推廣，不能折抵買東西。 */
export const COIN_NAME = 'J幣';

export type CoinTxKind = 'checkin' | 'task' | 'views' | 'sales' | 'redeem' | 'refund' | 'admin';

export const COIN_TX_KIND_LABEL: Record<CoinTxKind, string> = {
  checkin: '每日簽到',
  task: '任務獎勵',
  views: '瀏覽回饋',
  sales: '成交回饋',
  redeem: '兌換推廣',
  refund: '退回J幣',
  admin: '平台調整',
};

export type CoinRedemptionKind = 'ad_slot' | 'product_boost' | 'store_badge';

export const COIN_REDEMPTION_KIND_LABEL: Record<CoinRedemptionKind, string> = {
  ad_slot: '首頁廣告版位',
  product_boost: '商品置頂曝光',
  store_badge: '店舖徽章',
};

export type CoinRedemptionStatus = 'pending' | 'active' | 'rejected' | 'expired';

export const COIN_REDEMPTION_STATUS_LABEL: Record<CoinRedemptionStatus, string> = {
  pending: '待審核',
  active: '進行中',
  rejected: '未通過',
  expired: '已結束',
};

export type StoreBadgeKind = 'flash' | 'star' | 'preferred';

export const STORE_BADGE_LABEL: Record<StoreBadgeKind, string> = {
  flash: '限時特賣店',
  star: '熱門好評店',
  preferred: '嚴選優質店',
};

/** 公開鏡像表：買家看得到店舖徽章，但只有伺服器寫得進去。 */
export type StorePromotion = {
  store_id: string;
  badge_kind: 'none' | StoreBadgeKind;
  badge_expires_at: string | null;
};

export function toStoreBadgeKind(value: string | null | undefined): StoreBadgeKind | null {
  if (value === 'flash' || value === 'star' || value === 'preferred') return value;
  return null;
}
