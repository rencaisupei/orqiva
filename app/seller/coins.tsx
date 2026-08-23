import { ScrollView, View } from 'react-native';
import { Button, Chip, Spinner, Typography, useToast } from 'heroui-native';
import { router } from 'expo-router';
import {
  CalendarCheck,
  Coins,
  Eye,
  Megaphone,
  Receipt,
  Sparkles,
  Store as StoreIcon,
} from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { SellerTabBar } from '@/components/SellerTabBar';
import { SignInRequired } from '@/components/SignInRequired';
import { LinearGradient } from '@/components/ui/primitives/LinearGradient';
import type { CoinRedemption, CoinTaskState, CoinTransaction } from '@/lib/api/contracts';
import { useClaimCoinTask, useCoinCheckin, useCoinSummary } from '@/lib/api/coins';
import { BRAND } from '@/lib/brand';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useUserId } from '@/lib/session';
import {
  COIN_NAME,
  COIN_REDEMPTION_KIND_LABEL,
  COIN_REDEMPTION_STATUS_LABEL,
  COIN_TX_KIND_LABEL,
} from '@/lib/types';

function SectionTitle({ label, hint }: { label: string; hint?: string }) {
  return (
    <View className="mt-1 gap-0.5">
      <Typography type="h6" className="text-navy" style={{ fontWeight: '700' }}>
        {label}
      </Typography>
      {hint ? (
        <Typography type="body-xs" color="muted">
          {hint}
        </Typography>
      ) : null}
    </View>
  );
}

function TaskRow({
  task,
  isPending,
  onClaim,
}: {
  task: CoinTaskState;
  isPending: boolean;
  onClaim: () => void;
}) {
  return (
    <View className="bg-surface flex-row items-center gap-3 rounded-2xl px-4 py-3">
      <View
        className="h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: task.claimed ? BRAND.blueSoft : BRAND.orangeSoft }}
      >
        <Sparkles size={17} color={task.claimed ? BRAND.blue : BRAND.orange} />
      </View>
      <View className="flex-1">
        <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
          {task.label}
        </Typography>
        <Typography type="body-xs" color="muted" numberOfLines={2}>
          {task.hint} · +{task.coins} {COIN_NAME}
        </Typography>
      </View>
      {task.claimed ? (
        <Chip disabled size="sm" variant="soft" color="success">
          已領取
        </Chip>
      ) : task.done ? (
        <Button size="sm" isDisabled={isPending} onPress={onClaim}>
          <Button.Label>領取</Button.Label>
        </Button>
      ) : (
        <Chip disabled size="sm" variant="soft">
          未完成
        </Chip>
      )}
    </View>
  );
}

function RedemptionRow({ row }: { row: CoinRedemption }) {
  const color =
    row.status === 'rejected'
      ? 'danger'
      : row.status === 'active'
        ? 'success'
        : row.status === 'pending'
          ? 'accent'
          : 'default';

  return (
    <View className="bg-surface gap-1.5 rounded-2xl px-4 py-3">
      <View className="flex-row items-center gap-2">
        <Typography
          type="body-sm"
          numberOfLines={1}
          className="text-navy flex-1"
          style={{ fontWeight: '600' }}
        >
          {COIN_REDEMPTION_KIND_LABEL[row.kind]}
        </Typography>
        <Chip disabled size="sm" variant="soft" color={color}>
          {COIN_REDEMPTION_STATUS_LABEL[row.status]}
        </Chip>
      </View>
      <Typography type="body-xs" color="muted" numberOfLines={2}>
        {row.title || row.productTitle || '—'} · {row.days} 天 · {formatNumber(row.cost)}{' '}
        {COIN_NAME}
      </Typography>
      <Typography type="body-xs" color="muted">
        {row.status === 'pending'
          ? `送審時間 ${formatDateTime(row.createdAt)}`
          : row.endsAt
            ? `結束時間 ${formatDateTime(row.endsAt)}`
            : formatDateTime(row.createdAt)}
      </Typography>
      {row.reviewNote ? (
        <Typography type="body-xs" style={{ color: BRAND.danger }}>
          審核備註：{row.reviewNote}
        </Typography>
      ) : null}
    </View>
  );
}

function LedgerRow({ row }: { row: CoinTransaction }) {
  const earned = row.amount > 0;
  return (
    <View className="bg-surface flex-row items-center gap-3 rounded-2xl px-4 py-3">
      <View className="flex-1">
        <Typography type="body-sm" numberOfLines={1} className="text-navy">
          {row.title}
        </Typography>
        <Typography type="body-xs" color="muted" numberOfLines={1}>
          {COIN_TX_KIND_LABEL[row.kind]} · {formatDateTime(row.createdAt)}
          {row.detail ? ` · ${row.detail}` : ''}
        </Typography>
      </View>
      <Typography
        type="body"
        style={{ fontWeight: '700', color: earned ? BRAND.blue : BRAND.muted }}
      >
        {earned ? '+' : ''}
        {formatNumber(row.amount)}
      </Typography>
    </View>
  );
}

/**
 * J幣中心（只有賣家看得到）。
 *
 * 所有加幣與扣幣都由 seller-coins edge function 決定，這一頁只負責顯示與觸發：
 * 打開頁面時伺服器會順手補發「昨日瀏覽回饋」與「訂單完成回饋」。
 */
export default function SellerCoinsScreen() {
  const userId = useUserId();
  const { toast } = useToast();
  const { data, isLoading, error } = useCoinSummary(userId);
  const checkin = useCoinCheckin();
  const claim = useClaimCoinTask();

  if (!userId) {
    return (
      <View className="bg-background flex-1">
        <SignInRequired title={`登入後查看${COIN_NAME}`} />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          icon={<Coins size={26} color={BRAND.orange} />}
          title={`暫時讀不到${COIN_NAME}資料`}
          description={error instanceof Error ? error.message : '請稍後再試一次。'}
        />
      </View>
    );
  }

  if (!data.hasStore) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          icon={<StoreIcon size={26} color={BRAND.blue} />}
          title={`${COIN_NAME}是賣家專屬`}
          description={`建立店舖之後就能靠簽到、任務與成交累積${COIN_NAME}，用來換廣告曝光。`}
          action={
            <Button onPress={() => router.push('/seller/onboarding')}>
              <Button.Label>申請成為賣家</Button.Label>
            </Button>
          }
        />
      </View>
    );
  }

  const { wallet, pricing } = data;

  const doCheckin = () => {
    checkin.mutate(undefined, {
      onSuccess: (result) =>
        toast.show({
          variant: 'success',
          label: `簽到成功，+${result.coins} ${COIN_NAME}（連續 ${result.streak} 天）`,
        }),
      onError: (err: Error) => toast.show({ variant: 'danger', label: err.message }),
    });
  };

  return (
    <View className="bg-background flex-1">
      <ScrollView contentContainerClassName="p-4 gap-3 pb-8" showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[BRAND.navy, BRAND.blue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="gap-3 rounded-3xl p-4"
        >
          <View className="flex-row items-center gap-2">
            <Coins size={18} color={BRAND.yellow} />
            <Typography type="body-sm" className="text-white" style={{ fontWeight: '600' }}>
              {data.storeName ?? '我的店舖'}的{COIN_NAME}
            </Typography>
          </View>
          <Typography type="h2" className="text-white" style={{ fontWeight: '700' }}>
            {formatNumber(wallet.balance)}
          </Typography>
          <View className="flex-row gap-4">
            <Typography type="body-xs" className="text-white/80">
              累積獲得 {formatNumber(wallet.lifetimeEarned)}
            </Typography>
            <Typography type="body-xs" className="text-white/80">
              已用於推廣 {formatNumber(wallet.lifetimeSpent)}
            </Typography>
          </View>

          <View className="flex-row items-center gap-2">
            <Button
              size="sm"
              variant="tertiary"
              isDisabled={wallet.checkedInToday || checkin.isPending}
              onPress={doCheckin}
            >
              <Button.Label numberOfLines={1}>
                {wallet.checkedInToday
                  ? `今天已簽到 · 連續 ${wallet.streak} 天`
                  : `簽到領 ${wallet.nextCheckinCoins} ${COIN_NAME}`}
              </Button.Label>
            </Button>
            <View className="flex-row items-center gap-1">
              <CalendarCheck size={13} color={BRAND.white} />
              <Typography type="body-xs" className="text-white/80">
                連續簽到每天多 {pricing.checkin.bonus}，最高 {pricing.checkin.max}
              </Typography>
            </View>
          </View>
        </LinearGradient>

        <Button onPress={() => router.push('/seller/promote')}>
          <View className="flex-row items-center gap-2">
            <Megaphone size={17} color={BRAND.white} />
            <Button.Label>用{COIN_NAME}換推廣曝光</Button.Label>
          </View>
        </Button>

        <SectionTitle label="今日任務" hint={`${data.today} · 每天 00:00 重置`} />
        {data.tasks.map((task) => (
          <TaskRow
            key={task.key}
            task={task}
            isPending={claim.isPending}
            onClaim={() =>
              claim.mutate(task.key, {
                onSuccess: (result) =>
                  toast.show({
                    variant: 'success',
                    label: `已領取 +${result.coins} ${COIN_NAME}`,
                  }),
                onError: (err: Error) => toast.show({ variant: 'danger', label: err.message }),
              })
            }
          />
        ))}

        <View className="bg-surface gap-2 rounded-2xl p-4">
          <View className="flex-row items-center gap-2">
            <Eye size={15} color={BRAND.blue} />
            <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
              自動累積的回饋
            </Typography>
          </View>
          <Typography type="body-xs" color="muted">
            商品被瀏覽：每 {pricing.views.per} 次瀏覽 1 {COIN_NAME}，每天最多{' '}
            {formatNumber(pricing.views.cap)}。以前一天結算後的真實瀏覽數計算，打開這一頁時補發。
          </Typography>
          <Typography type="body-xs" color="muted">
            訂單完成：成交金額的 {Math.round(pricing.salesRate * 100)}%（至少 1 {COIN_NAME}
            ），每筆訂單只發一次。
          </Typography>
        </View>

        {data.redemptions.length > 0 ? (
          <>
            <SectionTitle
              label="我的推廣"
              hint={`廣告版位需管理員審核，未通過會全額退回${COIN_NAME}`}
            />
            {data.redemptions.slice(0, 8).map((row) => (
              <RedemptionRow key={row.id} row={row} />
            ))}
          </>
        ) : null}

        <SectionTitle label={`${COIN_NAME}明細`} />
        {data.transactions.length === 0 ? (
          <View className="bg-surface items-center gap-1 rounded-2xl p-6">
            <Receipt size={22} color={BRAND.muted} />
            <Typography type="body-sm" color="muted">
              還沒有紀錄，從今天的簽到開始吧。
            </Typography>
          </View>
        ) : (
          data.transactions.map((row) => <LedgerRow key={row.id} row={row} />)
        )}
      </ScrollView>

      <SellerTabBar />
    </View>
  );
}
