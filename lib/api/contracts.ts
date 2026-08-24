/**
 * Response contracts for every edge function action.
 *
 * `bilt.functions.invoke` hands back `any`, so without these maps each call site
 * had to assert its own shape (`data as T`) and nothing checked the two sides
 * agreed. Each helper in `lib/backend.ts` is keyed by action name, so passing an
 * unknown action is a compile error and the result type is derived from the
 * action instead of being asserted by hand.
 *
 * Keep this file free of runtime imports: `lib/backend.ts` imports it, so any
 * module that imports backend would otherwise pull in a cycle.
 */
import type {
  AdBannerPlacement,
  CoinRedemptionKind,
  CoinRedemptionStatus,
  CoinTxKind,
  CouponKind,
  LogisticsSettings,
  LogisticsSubType,
  LogisticsVerifyResult,
  MessageScanResult,
  ModerationResult,
  ProductListItem,
  ReportSeverity,
  SellerVerificationStatus,
  StoreBadgeKind,
} from '@/lib/types';

/**
 * Body of an action whose result the app never reads (fire-and-forget writes).
 * Deliberately not a made-up shape — the function returns a JSON object and the
 * app treats it as opaque.
 */
export type EdgeJson = Record<string, unknown>;

/* ── ecpay-logistics ─────────────────────────────────────────── */

export type SellerVerifyResult = {
  ok: boolean;
  userId: string;
  isActive: boolean;
  status: SellerVerificationStatus;
  reason: string;
  message: string;
  senderReady: boolean;
  /** true = 用賣家自己的綠界特店金鑰驗證，false = 退回平台金鑰。 */
  hasOwnCredentials: boolean;
  credentialSource: 'env' | 'ecpay_test' | 'seller' | null;
  merchantId: string | null;
  checkedAt: string;
};

/** 賣家的寄件人 + 綠界特店設定。HashKey / HashIV 只回「有沒有設定」，不回內容。 */
export type SellerEcpaySettings = {
  /** zipCode / address 只有黑貓宅急便建單需要（司機上門收件的地址）。 */
  sender: { name: string; cellPhone: string; zipCode: string; address: string };
  ecpay: {
    merchantId: string;
    hasHashKey: boolean;
    hasHashIv: boolean;
    updatedAt: string | null;
  };
  status: {
    isActive: boolean;
    verificationStatus: SellerVerificationStatus;
    message: string | null;
    lastCheckedAt: string | null;
  };
  platform: {
    isEnabled: boolean;
    environment: 'stage' | 'production';
    apiHost: string;
    fallbackReady: boolean;
    /** 平台目前開放的貨到付款方式，賣家據此知道要不要填寄件地址。 */
    enabledSubTypes: LogisticsSubType[];
  };
};

export type AdminLogisticsPayload = {
  settings: LogisticsSettings;
  callbackUrl: string;
  apiHost: string;
  supportedSubTypes: LogisticsSubType[];
  /** 超商（CVS）與宅配（HOME）各自支援的方式，以及代收金額上下限。 */
  cvsSubTypes: LogisticsSubType[];
  homeSubTypes: LogisticsSubType[];
  codLimits: { cvs: { min: number; max: number }; home: { min: number; max: number } };
  /** 物流 API 的檢查碼演算法（綠界規定 MD5；SHA256 只用於金流 AIO API）。 */
  checkMacAlgorithm: string;
  /** 綠界文件公開的 C2C 測試特店代號。 */
  testAccountMerchantId: string;
  /** 寄件人資料來源；固定為 seller_shipping_profiles（每個賣家自己填）。 */
  senderSource: string;
  /** 有填自己綠界特店金鑰的賣家數（那些訂單會用賣家自己的帳號建單）。 */
  sellerCredentialCount: number;
  credentials: {
    stage: { ready: boolean; merchantId: string | null; source: 'env' | 'ecpay_test' };
    production: { ready: boolean; merchantId: string | null; source: 'env' | 'ecpay_test' };
  };
};

export type MapSelection = {
  token: string;
  status: 'pending' | 'selected' | 'expired';
  store_id: string | null;
  store_name: string | null;
  store_address: string | null;
  store_phone: string | null;
  logistics_sub_type: LogisticsSubType;
};

export type LogisticsCreateResult = {
  ok: boolean;
  status: string;
  merchantTradeNo: string;
  shipmentNo: string | null;
  validationNo: string | null;
  rtnMsg: string | null;
};

/* ── account ─────────────────────────────────────────────────── */

export type AccountDeletionSummary = {
  email: string | null;
  /** 買家身分還在進行中的訂單（待付款 / 備貨中 / 已出貨）。 */
  activeAsBuyer: number;
  /** 賣家身分還在進行中的訂單。 */
  activeAsSeller: number;
  ordersAsBuyer: number;
  ordersAsSeller: number;
  storeName: string | null;
  products: number;
  /** 必須逐字輸入的確認文字。 */
  confirmPhrase: string;
};

/* ── ai-moderation ───────────────────────────────────────────── */

/**
 * 自動審核巡邏的逐項結果。`count` 是這一輪真的處理掉幾筆（不是還剩幾筆）。
 */
export type AutoReviewTask = {
  key: string;
  label: string;
  count: number;
  error: string | null;
};

export type AutoReviewResult = {
  ok: boolean;
  /** false = 這次沒有真的執行（未到期／已停用／另一個執行中）。 */
  ran: boolean;
  skipped: 'disabled' | 'not_due' | 'locked' | null;
  startedAt: string | null;
  durationMs: number;
  nextDueAt: string | null;
  total: number;
  /** 只有管理員拿得到逐項明細，一般觸發者只會收到 ran / nextDueAt。 */
  tasks: AutoReviewTask[];
};

export type AutoReviewRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  trigger: 'auto' | 'admin';
  total_actions: number;
  duration_ms: number | null;
  tasks: AutoReviewTask[];
  error: string | null;
};

export type AutoReviewStatus = {
  enabled: boolean;
  intervalHours: number;
  /** 風險分數 ≤ 這個值自動放行。 */
  approveMaxRisk: number;
  /** 風險分數 ≥ 這個值自動退回；101 代表關閉自動退回。 */
  rejectMinRisk: number;
  lastRunAt: string | null;
  lastTotal: number;
  nextDueAt: string | null;
  dueNow: boolean;
  running: boolean;
  /** 現在等著被自動處理的筆數，讓管理員知道下一輪會做什麼。 */
  pending: { key: string; label: string; rows: number }[];
  recentRuns: AutoReviewRun[];
};

/* ── maintenance ─────────────────────────────────────────────── */

export type CleanupTaskResult = {
  key: string;
  label: string;
  deleted: number;
  error: string | null;
};

export type CleanupRunResult = {
  ok: boolean;
  /** false = 這次沒有真的執行（未到期／已停用／另一個執行中）。 */
  ran: boolean;
  skipped: 'disabled' | 'not_due' | 'locked' | null;
  startedAt: string | null;
  durationMs: number;
  nextDueAt: string | null;
  totalDeleted: number;
  /** 只有管理員拿得到逐項明細，一般觸發者只會收到 ran / nextDueAt。 */
  tasks: CleanupTaskResult[];
};

export type MaintenanceRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  trigger: 'auto' | 'admin' | 'schedule';
  total_deleted: number;
  duration_ms: number | null;
  tasks: CleanupTaskResult[];
  error: string | null;
};

export type MaintenanceStatus = {
  enabled: boolean;
  intervalHours: number;
  lastRunAt: string | null;
  nextDueAt: string | null;
  dueNow: boolean;
  retention: {
    notificationDays: number;
    historyDays: number;
  };
  /** 目前可清理的估計筆數，讓管理員知道下一次會處理多少。 */
  pending: { key: string; label: string; rows: number }[];
  recentRuns: MaintenanceRun[];
};

/* ── seller-coins ────────────────────────────────────────────── */

export type CoinWalletState = {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  streak: number;
  lastCheckinOn: string | null;
  checkedInToday: boolean;
  /** 今天（或下一次）簽到會拿到的J幣，含連續天數加成。 */
  nextCheckinCoins: number;
};

export type CoinTaskKey = 'list_product' | 'ship_order' | 'reply_message' | 'complete_order';

export type CoinTaskState = {
  key: CoinTaskKey;
  label: string;
  hint: string;
  coins: number;
  /** 伺服器用真實資料判斷的完成狀態，前端無法假造。 */
  done: boolean;
  claimed: boolean;
};

export type CoinTransaction = {
  id: string;
  kind: CoinTxKind;
  amount: number;
  balanceAfter: number;
  title: string;
  detail: string | null;
  createdAt: string;
};

export type CoinRedemption = {
  id: string;
  kind: CoinRedemptionKind;
  status: CoinRedemptionStatus;
  cost: number;
  days: number;
  placement: AdBannerPlacement;
  badgeKind: StoreBadgeKind | null;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  productId: string | null;
  productTitle: string | null;
  storeName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

/** 價目表由伺服器回傳，畫面不自己寫價格，避免兩邊對不上。 */
export type CoinPricing = {
  ad: Record<AdBannerPlacement, number>;
  adMaxDays: number;
  boost: number;
  boostMaxDays: number;
  badges: { kind: StoreBadgeKind; label: string; cost: number; days: number }[];
  checkin: { base: number; bonus: number; max: number };
  views: { per: number; cap: number };
  salesRate: number;
};

export type CoinSummary = {
  hasStore: boolean;
  storeName: string | null;
  wallet: CoinWalletState;
  tasks: CoinTaskState[];
  transactions: CoinTransaction[];
  redemptions: CoinRedemption[];
  pricing: CoinPricing;
  /** 台灣時區的今天，任務與簽到都以這一天為準。 */
  today: string;
};

/* ── market ──────────────────────────────────────────────────── */

/**
 * Server-side coupon試算. The edge function is the only place that decides a
 * discount, so the checkout screen shows exactly what `place_order` will write.
 */
export type CouponPreview = {
  code: string;
  title: string;
  kind: CouponKind;
  value: number;
  store_id: string;
  discount: number;
  /** 伺服器同一次試算算出的階梯數量折扣合計，App 用來對帳。 */
  bulk_discount: number;
};

/* ── geocode ─────────────────────────────────────────────────── */

/**
 * 地址 → 座標。查不到時 found 為 false（而不是丟錯），因為訂單頁只是少一張地圖，
 * 其餘配送資訊照樣顯示。
 */
export type GeocodeHit =
  | { found: true; latitude: number; longitude: number; label: string | null; matched?: string }
  | { found: false };

/* ── action → response maps ──────────────────────────────────── */

export type MarketResponses = {
  place_order: { order_ids: string[] };
  set_order_status: { ok: boolean };
  track_view: { ok: boolean };
  preview_coupon: CouponPreview;
};

export type LogisticsResponses = {
  get_settings: AdminLogisticsPayload;
  save_settings: { settings: LogisticsSettings };
  verify: LogisticsVerifyResult;
  seller_status: EdgeJson;
  seller_verify: SellerVerifyResult;
  seller_settings: SellerEcpaySettings;
  save_seller_credentials: EdgeJson;
  map_url: { token: string; url: string };
  map_result: { result: MapSelection };
  create: LogisticsCreateResult;
  sync: { status: string };
};

/**
 * `logistics-notify`：出貨／到貨的補發通知。回傳說明這一次到底有沒有發出去，
 * 沒發的原因（狀態不需要通知、已經通知過）也一併帶回來。
 */
export type ShipmentNoticeResult = {
  ok: boolean;
  notified: boolean;
  status: string;
  title?: string;
  reason?: string;
  pushed?: number;
};

export type LogisticsNotifyResponses = {
  notify_shipment: ShipmentNoticeResult;
};

export type NotifyResponses = {
  register_token: EdgeJson;
  unregister_token: EdgeJson;
  send_message: { ok: boolean; messageId: string; moderation: MessageScanResult | null };
  support_reply: { ok: boolean };
  push_test: { ok: boolean; sent: number };
};

export type AccountResponses = {
  deletion_summary: AccountDeletionSummary;
  delete_account: { ok: boolean };
};

export type ModerationResponses = {
  moderate_product: ModerationResult & { ok: boolean };
  admin_decide: { ok: boolean };
  scan_message: EdgeJson;
  resolve_flag: { ok: boolean };
  triage_report: { severity: ReportSeverity; summary: string; suggestion: string };
  auto_review: AutoReviewResult;
  auto_status: AutoReviewStatus;
};

export type MaintenanceResponses = {
  status: MaintenanceStatus;
  run_cleanup: CleanupRunResult;
};

export type CoinResponses = {
  summary: CoinSummary;
  checkin: { ok: boolean; coins: number; streak: number; balance: number };
  /**
   * 簽到提醒。伺服器自己決定該不該發（不是賣家、今天已簽到、今天已提醒都會 skip），
   * 所以 App 每天啟動時呼叫一次就好，reminded 才代表真的送出了通知。
   */
  checkin_reminder: {
    ok: boolean;
    reminded: boolean;
    coins?: number;
    pushed?: number;
    reason?: 'not_seller' | 'already_checked_in' | 'already_reminded';
  };
  claim_task: { ok: boolean; coins: number; balance: number };
  redeem: {
    ok: boolean;
    status: CoinRedemptionStatus;
    cost: number;
    balance: number;
    endsAt?: string;
    redemptionId?: string;
  };
  admin_redemptions: { redemptions: CoinRedemption[]; pendingCount: number };
  review_redemption: { ok: boolean; status: CoinRedemptionStatus; bannerId?: string };
};

/**
 * `recommend`：AI 推薦（猜你喜歡／為你推薦）。
 *
 * `source` 誠實回報這一次是模型排的（ai）還是規則式的退路（rules）；`reason` 是給
 * 買家看的一句話，`cached` 表示這一次沒有再打模型。
 */
export type RecommendationResult = {
  products: ProductListItem[];
  reason: string;
  source: 'ai' | 'rules';
  cached: boolean;
};

export type RecommendResponses = {
  similar: RecommendationResult;
  for_you: RecommendationResult;
};

/* ── price-watch ─────────────────────────────────────────────── */

/**
 * `price-watch`：收藏降價巡邏。與自動清理同一套節流做法，所以回傳形狀刻意相近：
 * `ran` 為 false 時 `skipped` 說明原因（未到期／已停用／另一個執行中）。
 */
export type PriceWatchResult = {
  ok: boolean;
  ran: boolean;
  skipped: 'disabled' | 'not_due' | 'locked' | null;
  startedAt: string | null;
  durationMs: number;
  nextDueAt: string | null;
  /** 這一輪發出的降價通知筆數。 */
  notified: number;
  /** 第一次巡邏到、只建立基準價的收藏筆數。 */
  baselined: number;
  pushed: number;
};

export type PriceWatchResponses = {
  run: PriceWatchResult;
};
