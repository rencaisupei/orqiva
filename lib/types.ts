export type Role = 'buyer' | 'seller' | 'admin';

export type UserAccount = {
  id: string;
  email: string | null;
  phone: string | null;
  roles: Role[];
  notify_messages: boolean;
  notify_orders: boolean;
  notify_moderation: boolean;
  created_at: string;
  updated_at: string;
};

export type NotificationPrefs = Pick<
  UserAccount,
  'notify_messages' | 'notify_orders' | 'notify_moderation'
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
  description: string | null;
  location: string;
  rating: number;
  rating_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

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

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  title: string;
  unit_price: number;
  quantity: number;
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
  total: number;
  shipping_method: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  shipping_address: string | null;
  note: string | null;
  /* 綠界超商取貨付款 */
  shipping_provider: 'manual' | 'ecpay';
  logistics_sub_type: string | null;
  cvs_store_id: string | null;
  cvs_store_name: string | null;
  cvs_store_address: string | null;
  cvs_store_phone: string | null;
  logistics_status: string | null;
  logistics_shipment_no: string | null;
  logistics_validation_no: string | null;
  logistics_id: string | null;
  created_at: string;
  updated_at: string;
  store: Pick<Store, 'id' | 'name' | 'logo_url'> | null;
  order_items: OrderItem[];
};

export type Review = {
  id: string;
  product_id: string;
  order_id: string | null;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null;
};

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
  | 'logistics';

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

export const SHIPPING_METHODS = ['宅配', '超商取貨', '面交'] as const;

/* ── 綠界 (ECPay) C2C 超商取貨付款 ─────────────────────────────── */

export type LogisticsSubType = 'UNIMARTC2C' | 'FAMIC2C' | 'HILIFEC2C' | 'OKMARTC2C';

export const LOGISTICS_SUB_TYPE_LABEL: Record<LogisticsSubType, string> = {
  UNIMARTC2C: '7-ELEVEN 交貨便',
  FAMIC2C: '全家店到店',
  HILIFEC2C: '萊爾富店到店',
  OKMARTC2C: 'OK 店到店',
};

/** 綠界測試環境的固定門市代號，方便在 stage 直接測完整流程。 */
export const LOGISTICS_TEST_STORE_ID: Record<LogisticsSubType, string> = {
  UNIMARTC2C: '131386',
  FAMIC2C: '006598',
  HILIFEC2C: '007564',
  OKMARTC2C: '1328',
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

export type LogisticsVerifyResult = {
  ok: boolean;
  environment: LogisticsEnvironment;
  reason?: string;
  message?: string;
  apiHost?: string;
  merchantId?: string;
  /** 'env' = 專案環境變數的金鑰；'ecpay_test' = 綠界公用測試特店。 */
  credentialSource?: 'env' | 'ecpay_test';
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

export const LOCATIONS = [
  '台北市',
  '新北市',
  '桃園市',
  '台中市',
  '台南市',
  '高雄市',
  '新竹市',
  '其他',
] as const;

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待付款',
  paid: '備貨中',
  shipped: '已出貨',
  completed: '已完成',
  cancelled: '已取消',
};
