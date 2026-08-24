import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, Input, Spinner, Typography } from 'heroui-native';
import { useBrandToast } from '@/components/brand/BrandToast';
import { Megaphone } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { SelectPill } from '@/components/SelectPill';
import type { CoinRedemption } from '@/lib/api/contracts';
import { useAdminRedemptions, useReviewRedemption } from '@/lib/api/coins';
import { BRAND } from '@/lib/brand';
import { formatDateTime, formatNumber } from '@/lib/format';
import {
  AD_BANNER_PLACEMENT_LABEL,
  COIN_NAME,
  COIN_REDEMPTION_KIND_LABEL,
  COIN_REDEMPTION_STATUS_LABEL,
  type CoinRedemptionStatus,
} from '@/lib/types';

type Filter = CoinRedemptionStatus | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: '待審核' },
  { key: 'active', label: '進行中' },
  { key: 'rejected', label: '未通過' },
  { key: 'expired', label: '已結束' },
  { key: 'all', label: '全部' },
];

function RedemptionCard({ row }: { row: CoinRedemption }) {
  const { toast } = useBrandToast();
  const review = useReviewRedemption();
  const [note, setNote] = useState('');

  const decide = (approve: boolean) => {
    review.mutate(
      { id: row.id, approve, note },
      {
        onSuccess: () => {
          setNote('');
          toast.show({
            variant: 'success',
            label: approve ? '已核准，廣告開始曝光' : `已退回，${COIN_NAME}全額退還賣家`,
          });
        },
        onError: (err: Error) => toast.show({ variant: 'danger', label: err.message }),
      },
    );
  };

  const isAd = row.kind === 'ad_slot';

  return (
    <View className="bg-surface gap-3 rounded-2xl p-4">
      <View className="flex-row items-center gap-2">
        <Typography
          type="body"
          numberOfLines={1}
          className="text-navy flex-1"
          style={{ fontWeight: '700' }}
        >
          {row.storeName ?? '未命名店舖'}
        </Typography>
        <Chip disabled size="sm" variant="soft">
          {COIN_REDEMPTION_KIND_LABEL[row.kind]}
        </Chip>
        <Chip
          disabled
          size="sm"
          variant="soft"
          color={
            row.status === 'rejected'
              ? 'danger'
              : row.status === 'active'
                ? 'success'
                : row.status === 'pending'
                  ? 'accent'
                  : 'default'
          }
        >
          {COIN_REDEMPTION_STATUS_LABEL[row.status]}
        </Chip>
      </View>

      <View className="flex-row gap-3">
        <AppImage uri={row.imageUrl} className="h-20 w-28 rounded-xl" />
        <View className="flex-1 gap-1">
          <Typography type="body-sm" numberOfLines={2} className="text-navy">
            {row.title || row.productTitle || '—'}
          </Typography>
          {row.subtitle ? (
            <Typography type="body-xs" color="muted" numberOfLines={2}>
              {row.subtitle}
            </Typography>
          ) : null}
          <Typography type="body-xs" color="muted">
            {isAd ? `${AD_BANNER_PLACEMENT_LABEL[row.placement]} · ` : ''}
            {row.days} 天 · {formatNumber(row.cost)} {COIN_NAME}
          </Typography>
          <Typography type="body-xs" color="muted">
            送出時間 {formatDateTime(row.createdAt)}
            {row.endsAt ? ` · 結束 ${formatDateTime(row.endsAt)}` : ''}
          </Typography>
          {row.productTitle ? (
            <Typography type="body-xs" color="muted" numberOfLines={1}>
              連結商品：{row.productTitle}
            </Typography>
          ) : null}
        </View>
      </View>

      {row.reviewNote ? (
        <Typography type="body-xs" color="muted">
          審核備註：{row.reviewNote}
        </Typography>
      ) : null}

      {row.status === 'pending' && isAd ? (
        <View className="gap-2">
          <Input placeholder="退回原因（會通知賣家，選填）" value={note} onChangeText={setNote} />
          <View className="flex-row gap-2">
            <Button className="flex-1" isDisabled={review.isPending} onPress={() => decide(true)}>
              <Button.Label>核准並上線</Button.Label>
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              isDisabled={review.isPending}
              onPress={() => decide(false)}
            >
              <Button.Label>退回並退幣</Button.Label>
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * 推廣審核：賣家用J幣兌換的廣告版位在這裡核准或退回。
 *
 * 核准時由 seller-coins 建立 ad_banners 那一列（起訖時間依兌換天數），退回時把
 * J幣全額退還並通知賣家 —— 兩邊都在伺服器端完成，後台只送出決定。
 */
export function AdminPromoPanel() {
  const [filter, setFilter] = useState<Filter>('pending');
  const { data, isLoading, error } = useAdminRedemptions(filter, true);

  const rows = data?.redemptions ?? [];

  return (
    <View className="gap-3">
      <View className="bg-surface gap-2 rounded-2xl p-4">
        <View className="flex-row items-center gap-2">
          <Megaphone size={16} color={BRAND.orange} />
          <Typography type="body" className="text-navy flex-1" style={{ fontWeight: '700' }}>
            賣家推廣兌換
          </Typography>
          {data ? (
            <Chip disabled size="sm" variant="soft" color="accent">
              待審核 {formatNumber(data.pendingCount)}
            </Chip>
          ) : null}
        </View>
        <Typography type="body-xs" color="muted">
          廣告版位需要審核才會出現在首頁；商品置頂與店舖徽章即時生效，這裡只作紀錄。
        </Typography>
        <View className="flex-row flex-wrap gap-2">
          {FILTERS.map((item) => (
            <SelectPill
              key={item.key}
              size="sm"
              label={item.label}
              selected={filter === item.key}
              onPress={() => setFilter(item.key)}
            />
          ))}
        </View>
      </View>

      {isLoading ? (
        <View className="py-8">
          <Spinner />
        </View>
      ) : null}

      {error ? (
        <View className="bg-surface gap-1 rounded-2xl p-4">
          <Typography type="body-sm" style={{ fontWeight: '600', color: BRAND.danger }}>
            讀取失敗
          </Typography>
          <Typography type="body-xs" color="muted">
            {error instanceof Error ? error.message : '請稍後再試'}
          </Typography>
        </View>
      ) : null}

      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={24} color={BRAND.orange} />}
          title="這個狀態沒有兌換紀錄"
          description="賣家送出廣告版位兌換後會出現在這裡。"
        />
      ) : null}

      {rows.map((row) => (
        <RedemptionCard key={row.id} row={row} />
      ))}
    </View>
  );
}
