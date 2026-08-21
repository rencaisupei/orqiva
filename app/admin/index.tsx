import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  Avatar,
  Button,
  Chip,
  Input,
  Separator,
  Spinner,
  Switch,
  TextArea,
  Typography,
  useToast,
} from 'heroui-native';
import { router } from 'expo-router';
import { ChevronRight, ShieldAlert, ShieldCheck, Truck, Wrench } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { SignInRequired } from '@/components/SignInRequired';
import {
  useAdminOrders,
  useAdminOverview,
  useAdminProducts,
  useAdminReports,
  useAdminResolveReport,
  useAdminSetProductStatus,
  useAdminSetUserRole,
  useAdminSetUserSuspended,
  useAdminStores,
  useAdminUsers,
} from '@/lib/api/admin';
import {
  useAdminDecideProduct,
  useMessageFlags,
  useModerateProduct,
  useModerationQueue,
  useModerationQueueCount,
  useResolveMessageFlag,
  useTriageReport,
  type QueueProduct,
} from '@/lib/api/moderation';
import {
  useAdminOpenTicketCount,
  useAdminReplyTicket,
  useAdminSupportTickets,
} from '@/lib/api/support';
import { useAppSettings, useSaveAppSettings } from '@/lib/api/system';
import { BRAND } from '@/lib/brand';
import { formatDate, formatPrice, relativeTime } from '@/lib/format';
import { WebOnlyNotice } from '@/components/WebOnlyNotice';
import { ADMIN_CONSOLE_IS_WEB, useIsAdminConsole, useUserId } from '@/lib/session';
import {
  MODERATION_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  REPORT_SEVERITY_LABEL,
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUS_LABEL,
  type AppSettings,
  type SupportTicket,
  type SupportTicketStatus,
} from '@/lib/types';

type TabKey =
  | 'overview'
  | 'moderation'
  | 'users'
  | 'products'
  | 'stores'
  | 'orders'
  | 'reports'
  | 'support';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '總覽' },
  { key: 'moderation', label: 'AI 審核' },
  { key: 'users', label: '會員與權限' },
  { key: 'products', label: '商品' },
  { key: 'stores', label: '商店' },
  { key: 'orders', label: '訂單' },
  { key: 'reports', label: '檢舉' },
  { key: 'support', label: '客服' },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="bg-surface min-w-[46%] flex-1 gap-1 rounded-2xl p-4">
      <Typography type="body-xs" color="muted" numberOfLines={1}>
        {label}
      </Typography>
      <Typography type="h5" numberOfLines={1} className="text-navy" style={{ fontWeight: '700' }}>
        {value}
      </Typography>
    </View>
  );
}

/** 審核佇列的單筆商品：AI 判定 + 管理員覆核。 */
function QueueCard({ product }: { product: QueueProduct }) {
  const { toast } = useToast();
  const decide = useAdminDecideProduct();
  const rescan = useModerateProduct();
  const [note, setNote] = useState('');

  return (
    <View className="bg-surface gap-2.5 rounded-2xl p-4">
      <Pressable
        className="flex-row items-center gap-3"
        onPress={() => router.push({ pathname: '/products/[id]', params: { id: product.id } })}
      >
        <AppImage uri={product.cover_url} className="h-14 w-14 rounded-xl" />
        <View className="flex-1">
          <Typography type="body-sm" numberOfLines={2} className="text-navy">
            {product.title}
          </Typography>
          <Typography type="body-xs" color="muted" numberOfLines={1}>
            {product.store?.name ?? '—'} · {formatPrice(product.price)} ·{' '}
            {relativeTime(product.created_at)}
          </Typography>
        </View>
        {/* `disabled` keeps this status chip decorative — Chip is a Pressable, so
            without it the chip would swallow taps meant for the row. */}
        <Chip
          disabled
          size="sm"
          variant="soft"
          color={product.moderation_status === 'rejected' ? 'danger' : 'warning'}
        >
          {MODERATION_STATUS_LABEL[product.moderation_status]}
        </Chip>
      </Pressable>

      <View className="bg-background gap-1.5 rounded-xl p-3">
        <View className="flex-row items-center gap-2">
          <ShieldAlert size={14} color={BRAND.orange} />
          <Typography type="body-xs" className="text-navy flex-1">
            風險分數 {product.moderation_risk} ·{' '}
            {product.moderation_engine === 'openai'
              ? 'AI 判讀'
              : product.moderation_engine === 'admin'
                ? '人工覆核'
                : '規則引擎'}
          </Typography>
        </View>
        {product.moderation_summary ? (
          <Typography type="body-sm" color="muted">
            {product.moderation_summary}
          </Typography>
        ) : null}
        {product.moderation_labels.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {product.moderation_labels.map((label) => (
              <Chip key={label} size="sm" variant="tertiary">
                {label}
              </Chip>
            ))}
          </View>
        ) : null}
      </View>

      <TextArea
        placeholder="覆核備註（會顯示給賣家，選填）"
        value={note}
        onChangeText={setNote}
        numberOfLines={2}
      />

      <View className="flex-row gap-2">
        <Button
          size="sm"
          className="flex-1"
          isDisabled={decide.isPending}
          onPress={() =>
            decide.mutate(
              { productId: product.id, verdict: 'approved', note: note.trim() },
              {
                onSuccess: () => toast.show({ variant: 'success', label: '已放行並公開' }),
                onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
              },
            )
          }
        >
          <Button.Label>放行</Button.Label>
        </Button>
        <Button
          size="sm"
          variant="danger-soft"
          className="flex-1"
          isDisabled={decide.isPending}
          onPress={() =>
            decide.mutate(
              { productId: product.id, verdict: 'rejected', note: note.trim() },
              {
                onSuccess: () => toast.show({ variant: 'success', label: '已駁回並通知賣家' }),
                onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
              },
            )
          }
        >
          <Button.Label>駁回</Button.Label>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={rescan.isPending}
          onPress={() =>
            rescan.mutate(product.id, {
              onSuccess: (result) =>
                toast.show({
                  variant: result.verdict === 'approved' ? 'success' : 'warning',
                  label: `重新判定：${MODERATION_STATUS_LABEL[result.verdict]}`,
                }),
              onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
            })
          }
        >
          <Button.Label>重掃</Button.Label>
        </Button>
      </View>
    </View>
  );
}

/** 客服工單：回覆與狀態切換。 */
function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const { toast } = useToast();
  const reply = useAdminReplyTicket();
  const [text, setText] = useState(ticket.admin_reply ?? '');

  const submit = (status: SupportTicketStatus) => {
    reply.mutate(
      { ticketId: ticket.id, reply: text.trim(), status },
      {
        onSuccess: () => toast.show({ variant: 'success', label: '已更新工單' }),
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  return (
    <View className="bg-surface gap-2 rounded-2xl p-4">
      <View className="flex-row items-center gap-2">
        <Typography
          type="body-sm"
          numberOfLines={1}
          className="text-navy flex-1"
          style={{ fontWeight: '600' }}
        >
          {ticket.subject}
        </Typography>
        <Chip size="sm" variant="soft" color={ticket.status === 'closed' ? 'success' : 'warning'}>
          {SUPPORT_STATUS_LABEL[ticket.status]}
        </Chip>
      </View>
      <Typography type="body-xs" color="muted">
        {SUPPORT_CATEGORY_LABEL[ticket.category]} · {ticket.name} · {ticket.email}
        {ticket.phone ? ` · ${ticket.phone}` : ''}
      </Typography>
      <Typography type="body-sm" color="muted">
        {ticket.message}
      </Typography>
      <Typography type="body-xs" color="muted">
        {formatDate(ticket.created_at)}
      </Typography>

      <Separator />
      <TextArea
        placeholder="回覆內容（送出後會通知並推播給提問者）"
        value={text}
        onChangeText={setText}
        numberOfLines={3}
      />
      <View className="flex-row gap-2">
        <Button
          size="sm"
          className="flex-1"
          isDisabled={reply.isPending || text.trim().length === 0}
          onPress={() => submit('in_progress')}
        >
          <Button.Label>送出回覆</Button.Label>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          isDisabled={reply.isPending}
          onPress={() => submit('closed')}
        >
          <Button.Label>結案</Button.Label>
        </Button>
      </View>
    </View>
  );
}

/** 系統維護與全站公告（維護模式開啟時，只有管理員還能使用 App）。 */
function SystemPanel() {
  const { toast } = useToast();
  const { data: settings } = useAppSettings();
  const save = useSaveAppSettings();
  const [draft, setDraft] = useState<Partial<AppSettings>>({});
  const hydrated = useRef(false);

  useEffect(() => {
    // Seed once: this query refetches on window focus and would otherwise wipe
    // whatever the admin is typing.
    if (!settings || hydrated.current) return;
    hydrated.current = true;
    setDraft(settings);
  }, [settings]);

  const patch = (next: Partial<AppSettings>) => setDraft((prev) => ({ ...prev, ...next }));

  const submit = () => {
    const enabled = draft.maintenance_enabled ?? false;
    save.mutate(
      {
        maintenance_enabled: enabled,
        maintenance_title: draft.maintenance_title?.trim() || '系統維護中',
        maintenance_message:
          draft.maintenance_message?.trim() || '極貨網正在進行系統維護與資料更新，請稍後再回來。',
        maintenance_started_at: enabled
          ? (settings?.maintenance_started_at ?? new Date().toISOString())
          : null,
        announcement_enabled: draft.announcement_enabled ?? false,
        announcement_message: draft.announcement_message?.trim() ?? '',
      },
      {
        onSuccess: (data) => {
          setDraft(data);
          toast.show({ variant: 'success', label: '系統設定已儲存' });
        },
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  return (
    <View className="bg-surface gap-3 rounded-2xl p-4">
      <View className="flex-row items-center gap-3">
        <View className="bg-brand-blue-soft h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <Wrench size={20} color={BRAND.blue} />
        </View>
        <View className="flex-1">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            系統維護與公告
          </Typography>
          <Typography type="body-xs" color="muted">
            維護模式開啟後，一般使用者會看到維護畫面，管理員仍可正常操作。
          </Typography>
        </View>
      </View>

      <Separator />

      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
            維護模式
          </Typography>
          <Typography type="body-xs" color="muted">
            {settings?.maintenance_enabled
              ? `已於 ${settings.maintenance_started_at ? formatDate(settings.maintenance_started_at) : '—'} 開啟`
              : '目前關閉，所有人都能正常使用。'}
          </Typography>
        </View>
        <Switch
          isSelected={draft.maintenance_enabled ?? false}
          onSelectedChange={(value) => patch({ maintenance_enabled: value })}
        />
      </View>

      <Input
        placeholder="維護畫面標題"
        value={draft.maintenance_title ?? ''}
        onChangeText={(value) => patch({ maintenance_title: value })}
      />
      <TextArea
        placeholder="維護說明（例如：預計 22:00 完成，期間無法下單）"
        numberOfLines={3}
        value={draft.maintenance_message ?? ''}
        onChangeText={(value) => patch({ maintenance_message: value })}
      />

      <Separator />

      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
            全站公告橫幅
          </Typography>
          <Typography type="body-xs" color="muted">
            顯示在畫面下方，使用者可按「知道了」關閉。
          </Typography>
        </View>
        <Switch
          isSelected={draft.announcement_enabled ?? false}
          onSelectedChange={(value) => patch({ announcement_enabled: value })}
        />
      </View>
      <TextArea
        placeholder="公告內容（例如：中秋節出貨作業調整說明）"
        numberOfLines={2}
        value={draft.announcement_message ?? ''}
        onChangeText={(value) => patch({ announcement_message: value })}
      />

      <Button isDisabled={save.isPending} onPress={submit}>
        <Button.Label>{save.isPending ? '儲存中…' : '儲存系統設定'}</Button.Label>
      </Button>
    </View>
  );
}

export default function AdminScreen() {
  const userId = useUserId();
  const isAdmin = useIsAdminConsole();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('overview');

  const overview = useAdminOverview(isAdmin && tab === 'overview');
  const queueCount = useModerationQueueCount(isAdmin && tab === 'overview');
  const ticketCount = useAdminOpenTicketCount(isAdmin && tab === 'overview');
  const queue = useModerationQueue(isAdmin && tab === 'moderation');
  const flags = useMessageFlags(isAdmin && tab === 'moderation');
  const users = useAdminUsers(isAdmin && tab === 'users');
  const products = useAdminProducts(isAdmin && tab === 'products');
  const stores = useAdminStores(isAdmin && tab === 'stores');
  const orders = useAdminOrders(isAdmin && tab === 'orders');
  const reports = useAdminReports(isAdmin && tab === 'reports');
  const tickets = useAdminSupportTickets(isAdmin && tab === 'support');

  const setProductStatus = useAdminSetProductStatus();
  const setUserSuspended = useAdminSetUserSuspended();
  const setUserRole = useAdminSetUserRole();
  const resolveReport = useAdminResolveReport();
  const resolveFlag = useResolveMessageFlag();

  if (!ADMIN_CONSOLE_IS_WEB) {
    return (
      <WebOnlyNotice
        title="平台管理僅提供網頁版"
        description="平台管理後台已改為網頁版專用。請用電腦或手機瀏覽器開啟極貨網網頁版，登入管理員帳號後即可使用。"
      />
    );
  }

  if (!userId) {
    return <SignInRequired title="登入後查看平台管理" />;
  }

  if (!isAdmin) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          icon={<ShieldAlert size={26} color={BRAND.blue} />}
          title="需要管理員權限"
          description="此頁面僅開放給 admin 角色。請由現有管理員在「會員與權限」中授予權限。"
          action={
            <Button variant="secondary" onPress={() => router.replace('/(tabs)')}>
              <Button.Label>回到首頁</Button.Label>
            </Button>
          }
        />
      </View>
    );
  }

  const loading =
    overview.isLoading ||
    queue.isLoading ||
    flags.isLoading ||
    users.isLoading ||
    products.isLoading ||
    stores.isLoading ||
    orders.isLoading ||
    reports.isLoading ||
    tickets.isLoading;

  // A failed read used to leave the tab completely blank, which reads as
  // "the tab is not clickable". Surface the reason instead.
  const activeQueryError =
    tab === 'overview'
      ? overview.error
      : tab === 'moderation'
        ? (queue.error ?? flags.error)
        : tab === 'users'
          ? users.error
          : tab === 'products'
            ? products.error
            : tab === 'stores'
              ? stores.error
              : tab === 'orders'
                ? orders.error
                : tab === 'reports'
                  ? reports.error
                  : tickets.error;

  const emptyLabel: Partial<Record<TabKey, string>> = {
    users: '目前沒有會員資料',
    products: '目前沒有商品',
    stores: '目前沒有商店',
    orders: '目前沒有訂單',
  };

  const activeIsEmpty =
    tab === 'users'
      ? users.isSuccess && (users.data ?? []).length === 0
      : tab === 'products'
        ? products.isSuccess && (products.data ?? []).length === 0
        : tab === 'stores'
          ? stores.isSuccess && (stores.data ?? []).length === 0
          : tab === 'orders'
            ? orders.isSuccess && (orders.data ?? []).length === 0
            : false;

  return (
    <View className="bg-background flex-1">
      {/* Wraps instead of scrolling horizontally: a desktop mouse cannot swipe a
          horizontal ScrollView, which left the last tabs unreachable. */}
      <View className="bg-surface flex-row flex-wrap gap-2 px-4 py-3">
        {TABS.map((item) => (
          <Chip
            key={item.key}
            size="sm"
            variant={tab === item.key ? 'primary' : 'tertiary'}
            onPress={() => setTab(item.key)}
          >
            {item.label}
          </Chip>
        ))}
      </View>

      <ScrollView contentContainerClassName="p-4 gap-3 pb-10">
        {loading ? (
          <View className="py-10">
            <Spinner />
          </View>
        ) : null}

        {activeQueryError ? (
          <View className="bg-surface gap-1 rounded-2xl p-4">
            <Typography type="body-sm" className="text-danger" style={{ fontWeight: '600' }}>
              這個分頁讀取失敗
            </Typography>
            <Typography type="body-xs" color="muted">
              {activeQueryError instanceof Error ? activeQueryError.message : '請稍後再試'}
            </Typography>
          </View>
        ) : null}

        {activeIsEmpty ? (
          <EmptyState
            title={emptyLabel[tab] ?? '目前沒有資料'}
            description="有新資料時會出現在這裡。"
          />
        ) : null}

        {tab === 'overview' && overview.data ? (
          <>
            <View className="flex-row flex-wrap gap-3">
              <Stat label="會員數" value={String(overview.data.userCount)} />
              <Stat label="商店數" value={String(overview.data.storeCount)} />
              <Stat label="商品數" value={String(overview.data.productCount)} />
              <Stat label="訂單數" value={String(overview.data.orderCount)} />
              <Stat label="平台交易總額" value={formatPrice(overview.data.gmv)} />
              <Stat label="待處理檢舉" value={String(overview.data.openReports)} />
              <Stat label="待審核商品" value={String(queueCount.data ?? 0)} />
              <Stat label="未結案工單" value={String(ticketCount.data ?? 0)} />
            </View>
            <View className="bg-surface rounded-2xl p-4">
              <Typography type="body-sm" color="muted">
                極貨網平台統計即時來自資料庫，包含所有買家與賣家的交易紀錄。
              </Typography>
            </View>

            <Pressable
              className="bg-surface flex-row items-center gap-3 rounded-2xl p-4"
              onPress={() => setTab('moderation')}
            >
              <View className="bg-brand-blue-soft h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <ShieldCheck size={20} color={BRAND.blue} />
              </View>
              <View className="flex-1">
                <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                  AI 審核佇列
                </Typography>
                <Typography type="body-xs" color="muted">
                  商品上架自動審核、聊天訊息風險標記與人工覆核
                </Typography>
              </View>
              <ChevronRight size={18} color={BRAND.muted} />
            </Pressable>

            <Pressable
              className="bg-surface flex-row items-center gap-3 rounded-2xl p-4"
              onPress={() => router.push('/admin/logistics')}
            >
              <View className="bg-brand-blue-soft h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <Truck size={20} color={BRAND.blue} />
              </View>
              <View className="flex-1">
                <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                  物流串接設定
                </Typography>
                <Typography type="body-xs" color="muted">
                  綠界 C2C 超商取貨付款：環境、金鑰狀態、寄件人與回拋網址
                </Typography>
              </View>
              <ChevronRight size={18} color={BRAND.muted} />
            </Pressable>

            <SystemPanel />
          </>
        ) : null}

        {tab === 'moderation' ? (
          <>
            <View className="bg-surface gap-1 rounded-2xl p-4">
              <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                商品審核佇列（{(queue.data ?? []).length}）
              </Typography>
              <Typography type="body-xs" color="muted">
                只有審核通過的商品會對買家公開。放行或駁回都會通知並推播給賣家。
              </Typography>
            </View>

            {(queue.data ?? []).length === 0 ? (
              <EmptyState
                icon={<ShieldCheck size={26} color={BRAND.blue} />}
                title="沒有待審商品"
                description="AI 審核通過的商品會直接上架，需要覆核的才會出現在這裡。"
              />
            ) : (
              (queue.data ?? []).map((product) => <QueueCard key={product.id} product={product} />)
            )}

            <View className="bg-surface gap-1 rounded-2xl p-4">
              <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                聊天訊息風險標記（{(flags.data ?? []).length}）
              </Typography>
              <Typography type="body-xs" color="muted">
                偵測到站外交易、要求匯款或詐騙特徵的訊息。
              </Typography>
            </View>

            {(flags.data ?? []).length === 0 ? (
              <View className="bg-surface rounded-2xl p-4">
                <Typography type="body-sm" color="muted">
                  目前沒有被標記的訊息。
                </Typography>
              </View>
            ) : (
              (flags.data ?? []).map((flag) => (
                <View key={flag.id} className="bg-surface gap-2 rounded-2xl p-4">
                  <View className="flex-row items-center gap-2">
                    <Chip size="sm" variant="soft" color="danger">
                      風險 {flag.risk_score}
                    </Chip>
                    <Typography type="body-xs" color="muted" className="flex-1">
                      {relativeTime(flag.created_at)}
                    </Typography>
                  </View>
                  <Typography type="body-sm" className="text-navy">
                    {flag.excerpt ?? '（無內容）'}
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    {flag.reason}
                  </Typography>
                  {flag.labels.length > 0 ? (
                    <View className="flex-row flex-wrap gap-1.5">
                      {flag.labels.map((label) => (
                        <Chip key={label} size="sm" variant="tertiary">
                          {label}
                        </Chip>
                      ))}
                    </View>
                  ) : null}
                  <View className="flex-row gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onPress={() =>
                        router.push({
                          pathname: '/messages/[id]',
                          params: { id: flag.conversation_id },
                        })
                      }
                    >
                      <Button.Label>查看對話</Button.Label>
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onPress={() =>
                        resolveFlag.mutate(
                          { flagId: flag.id, status: 'reviewed' },
                          {
                            onSuccess: () =>
                              toast.show({ variant: 'success', label: '已標記為已處理' }),
                            onError: (error: Error) =>
                              toast.show({ variant: 'danger', label: error.message }),
                          },
                        )
                      }
                    >
                      <Button.Label>已處理</Button.Label>
                    </Button>
                    <Button
                      size="sm"
                      variant="tertiary"
                      onPress={() =>
                        resolveFlag.mutate(
                          { flagId: flag.id, status: 'dismissed' },
                          {
                            onSuccess: () => toast.show({ variant: 'success', label: '已忽略' }),
                            onError: (error: Error) =>
                              toast.show({ variant: 'danger', label: error.message }),
                          },
                        )
                      }
                    >
                      <Button.Label>忽略</Button.Label>
                    </Button>
                  </View>
                </View>
              ))
            )}
          </>
        ) : null}

        {tab === 'users'
          ? (users.data ?? []).map((user) => {
              const isPlatformAdmin = user.roles.includes('admin');
              return (
                <View key={user.id} className="bg-surface gap-2 rounded-2xl p-4">
                  <View className="flex-row items-center gap-3">
                    <Avatar size="sm" alt={user.profile?.display_name ?? '會員'}>
                      {user.profile?.avatar_url ? (
                        <Avatar.Image source={{ uri: user.profile.avatar_url }} />
                      ) : null}
                      <Avatar.Fallback />
                    </Avatar>
                    <View className="flex-1">
                      <Typography
                        type="body-sm"
                        numberOfLines={1}
                        className="text-navy"
                        style={{ fontWeight: '600' }}
                      >
                        {user.profile?.display_name ?? '未命名會員'}
                      </Typography>
                      <Typography type="body-xs" color="muted" numberOfLines={1}>
                        {user.email ?? '（未提供 Email）'} · {formatDate(user.created_at)}
                      </Typography>
                    </View>
                    {user.is_suspended ? (
                      <Chip size="sm" variant="soft" color="danger">
                        已停用
                      </Chip>
                    ) : null}
                  </View>
                  <View className="flex-row flex-wrap gap-1.5">
                    {user.roles.map((role) => (
                      <Chip
                        key={role}
                        size="sm"
                        variant="soft"
                        color={
                          role === 'admin' ? 'success' : role === 'seller' ? 'warning' : 'accent'
                        }
                      >
                        {role === 'admin' ? '管理員' : role === 'seller' ? '賣家' : '買家'}
                      </Chip>
                    ))}
                  </View>
                  <View className="flex-row gap-2">
                    <Button
                      size="sm"
                      variant={isPlatformAdmin ? 'tertiary' : 'primary'}
                      className="flex-1"
                      isDisabled={setUserRole.isPending || user.id === userId}
                      onPress={() =>
                        setUserRole.mutate(
                          { userId: user.id, role: 'admin', grant: !isPlatformAdmin },
                          {
                            onSuccess: () =>
                              toast.show({
                                variant: 'success',
                                label: isPlatformAdmin ? '已移除管理員權限' : '已設為管理員',
                              }),
                            onError: (error: Error) =>
                              toast.show({ variant: 'danger', label: error.message }),
                          },
                        )
                      }
                    >
                      <Button.Label>{isPlatformAdmin ? '移除管理員' : '設為管理員'}</Button.Label>
                    </Button>
                    <Button
                      size="sm"
                      variant={user.is_suspended ? 'secondary' : 'danger-soft'}
                      className="flex-1"
                      onPress={() =>
                        setUserSuspended.mutate(
                          { userId: user.id, suspended: !user.is_suspended },
                          {
                            onSuccess: () =>
                              toast.show({
                                variant: 'success',
                                label: user.is_suspended ? '帳號已恢復' : '帳號已停用',
                              }),
                            onError: (error: Error) =>
                              toast.show({ variant: 'danger', label: error.message }),
                          },
                        )
                      }
                    >
                      <Button.Label>{user.is_suspended ? '恢復帳號' : '停用帳號'}</Button.Label>
                    </Button>
                  </View>
                  {user.id === userId ? (
                    <Typography type="body-xs" color="muted">
                      為避免把自己鎖在門外，無法移除自己的管理員權限。
                    </Typography>
                  ) : null}
                </View>
              );
            })
          : null}

        {tab === 'products'
          ? (products.data ?? []).map((product) => (
              <View key={product.id} className="bg-surface gap-2 rounded-2xl p-4">
                <Pressable
                  className="flex-row items-center gap-3"
                  onPress={() =>
                    router.push({ pathname: '/products/[id]', params: { id: product.id } })
                  }
                >
                  <AppImage uri={product.cover_url} className="h-14 w-14 rounded-xl" />
                  <View className="flex-1">
                    <Typography type="body-sm" numberOfLines={2} className="text-navy">
                      {product.title}
                    </Typography>
                    <Typography type="body-xs" color="muted">
                      {formatPrice(product.price)} · 庫存 {product.stock} · 已售{' '}
                      {product.sold_count}
                    </Typography>
                  </View>
                  <View className="items-end gap-1">
                    <Chip
                      disabled
                      size="sm"
                      variant="soft"
                      color={product.status === 'suspended' ? 'danger' : 'success'}
                    >
                      {product.status === 'active'
                        ? '上架中'
                        : product.status === 'draft'
                          ? '未上架'
                          : '已停用'}
                    </Chip>
                    {product.moderation_status !== 'approved' ? (
                      <Chip disabled size="sm" variant="tertiary">
                        {MODERATION_STATUS_LABEL[product.moderation_status]}
                      </Chip>
                    ) : null}
                  </View>
                </Pressable>
                <Button
                  size="sm"
                  variant={product.status === 'suspended' ? 'secondary' : 'danger-soft'}
                  onPress={() =>
                    setProductStatus.mutate(
                      {
                        productId: product.id,
                        status: product.status === 'suspended' ? 'active' : 'suspended',
                      },
                      {
                        onSuccess: () =>
                          toast.show({
                            variant: 'success',
                            label: product.status === 'suspended' ? '商品已恢復' : '商品已停用',
                          }),
                        onError: (error: Error) =>
                          toast.show({ variant: 'danger', label: error.message }),
                      },
                    )
                  }
                >
                  <Button.Label>
                    {product.status === 'suspended' ? '恢復商品' : '停用商品'}
                  </Button.Label>
                </Button>
              </View>
            ))
          : null}

        {tab === 'stores'
          ? (stores.data ?? []).map((store) => (
              <Pressable
                key={store.id}
                className="bg-surface flex-row items-center gap-3 rounded-2xl p-4"
                onPress={() => router.push({ pathname: '/store/[id]', params: { id: store.id } })}
              >
                <Avatar size="sm" alt={store.name}>
                  {store.logo_url ? <Avatar.Image source={{ uri: store.logo_url }} /> : null}
                  <Avatar.Fallback />
                </Avatar>
                <View className="flex-1">
                  <Typography
                    type="body-sm"
                    numberOfLines={1}
                    className="text-navy"
                    style={{ fontWeight: '600' }}
                  >
                    {store.name}
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    {store.location} · 評價 {store.rating.toFixed(1)}（{store.rating_count}）
                  </Typography>
                </View>
              </Pressable>
            ))
          : null}

        {tab === 'orders'
          ? (orders.data ?? []).map((order) => (
              <Pressable
                key={order.id}
                className="bg-surface gap-2 rounded-2xl p-4"
                onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })}
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Typography
                    type="body-sm"
                    numberOfLines={1}
                    className="text-navy flex-1"
                    style={{ fontWeight: '600' }}
                  >
                    {order.order_no}
                  </Typography>
                  <Chip disabled size="sm" variant="tertiary">
                    {ORDER_STATUS_LABEL[order.status]}
                  </Chip>
                </View>
                <Separator />
                <View className="flex-row items-center justify-between gap-2">
                  <Typography type="body-xs" color="muted" numberOfLines={1} className="flex-1">
                    {order.store?.name ?? '—'} · {formatDate(order.created_at)}
                  </Typography>
                  <Typography
                    type="body-sm"
                    className="text-brand-orange"
                    style={{ fontWeight: '700' }}
                  >
                    {formatPrice(order.total)}
                  </Typography>
                </View>
              </Pressable>
            ))
          : null}

        {tab === 'reports' ? (
          (reports.data ?? []).length === 0 ? (
            <EmptyState title="目前沒有檢舉" description="買家送出的檢舉會顯示在這裡。" />
          ) : (
            (reports.data ?? []).map((report) => (
              <View key={report.id} className="bg-surface gap-2 rounded-2xl p-4">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center gap-1.5">
                    <Chip size="sm" variant="tertiary">
                      {report.target_type === 'product'
                        ? '商品'
                        : report.target_type === 'store'
                          ? '商店'
                          : '會員'}
                    </Chip>
                    {report.severity ? (
                      <Chip
                        size="sm"
                        variant="soft"
                        color={
                          report.severity === 'critical' || report.severity === 'high'
                            ? 'danger'
                            : report.severity === 'medium'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {REPORT_SEVERITY_LABEL[report.severity]}
                      </Chip>
                    ) : null}
                  </View>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={report.status === 'resolved' ? 'success' : 'warning'}
                  >
                    {report.status === 'resolved' ? '已處理' : '待處理'}
                  </Chip>
                </View>
                <Typography type="body-sm" className="text-navy">
                  {report.reason}
                </Typography>
                {report.ai_summary ? (
                  <View className="bg-background gap-1 rounded-xl p-3">
                    <Typography type="body-xs" className="text-brand-blue">
                      AI 分級
                    </Typography>
                    <Typography type="body-sm" color="muted">
                      {report.ai_summary}
                    </Typography>
                    {report.suggested_action ? (
                      <Typography type="body-xs" color="muted">
                        建議：{report.suggested_action}
                      </Typography>
                    ) : null}
                  </View>
                ) : null}
                <Typography type="body-xs" color="muted">
                  {formatDate(report.created_at)}
                </Typography>
                <View className="flex-row gap-2">
                  <ReportTriageButton reportId={report.id} triaged={!!report.triaged_at} />
                  {report.status !== 'resolved' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onPress={() =>
                        resolveReport.mutate(report.id, {
                          onSuccess: () =>
                            toast.show({ variant: 'success', label: '已標記為處理完成' }),
                          onError: (error: Error) =>
                            toast.show({ variant: 'danger', label: error.message }),
                        })
                      }
                    >
                      <Button.Label>標記已處理</Button.Label>
                    </Button>
                  ) : null}
                </View>
              </View>
            ))
          )
        ) : null}

        {tab === 'support' ? (
          (tickets.data ?? []).length === 0 ? (
            <EmptyState
              title="目前沒有客服工單"
              description="使用者從「聯絡我們」送出的問題會顯示在這裡。"
            />
          ) : (
            (tickets.data ?? []).map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

/** 檢舉的 AI 分級按鈕（分開元件，避免整頁重繪）。 */
function ReportTriageButton({ reportId, triaged }: { reportId: string; triaged: boolean }) {
  const { toast } = useToast();
  const triage = useTriageReport();

  return (
    <Button
      size="sm"
      variant="tertiary"
      className="flex-1"
      isDisabled={triage.isPending}
      onPress={() =>
        triage.mutate(reportId, {
          onSuccess: (result) =>
            toast.show({
              variant: 'success',
              label: `分級：${REPORT_SEVERITY_LABEL[result.severity]}`,
            }),
          onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
        })
      }
    >
      <Button.Label>{triaged ? '重新分級' : 'AI 分級'}</Button.Label>
    </Button>
  );
}
