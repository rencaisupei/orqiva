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
  LogisticsSettings,
  LogisticsSubType,
  LogisticsVerifyResult,
  MessageScanResult,
  ModerationResult,
  ReportSeverity,
  SellerVerificationStatus,
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
  sender: { name: string; cellPhone: string };
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
  };
};

export type AdminLogisticsPayload = {
  settings: LogisticsSettings;
  callbackUrl: string;
  apiHost: string;
  supportedSubTypes: LogisticsSubType[];
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

/* ── action → response maps ──────────────────────────────────── */

export type MarketResponses = {
  place_order: { order_ids: string[] };
  set_order_status: { ok: boolean };
  track_view: { ok: boolean };
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
};

export type MaintenanceResponses = {
  status: MaintenanceStatus;
  run_cleanup: CleanupRunResult;
};
