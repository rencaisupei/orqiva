import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Truck } from 'lucide-react-native';

import { useVerifySellerLogistics } from '@/lib/api/logistics';
import { BRAND } from '@/lib/brand';
import {
  SELLER_LOGISTICS_ACTIVE_LABEL,
  SELLER_LOGISTICS_PENDING_LABEL,
  type SellerShippingProfile,
} from '@/lib/types';

/** 檢查結果超過這個時間就自動重新檢查一次（綠界審核通過不會通知我們）。 */
const STALE_MS = 6 * 60 * 60 * 1000;

const GREEN = '#18A06E';
const GREEN_SOFT = '#E7F7F0';
const RED = '#D93A3A';
const RED_SOFT = '#FDECEC';

type Tone = 'success' | 'warning' | 'danger' | 'neutral';

const TONE_STYLE: Record<Tone, { border: string; background: string; icon: string }> = {
  success: { border: GREEN, background: GREEN_SOFT, icon: GREEN },
  warning: { border: BRAND.orange, background: BRAND.orangeSoft, icon: BRAND.orange },
  danger: { border: RED, background: RED_SOFT, icon: RED },
  neutral: { border: BRAND.border, background: BRAND.white, icon: BRAND.blue },
};

/**
 * 賣家中心的「超商取貨付款開通狀態」卡片。
 *
 * 狀態由 ecpay-logistics 的 seller_verify 對綠界物流 API 做 dry-run 後寫入
 * seller_shipping_profiles，這裡只負責呈現，並在結果過期時自動重新檢查一次。
 */
export function SellerLogisticsStatusCard({
  profile,
  isLoading = false,
  showSettingsLink = true,
}: {
  profile: SellerShippingProfile | null | undefined;
  isLoading?: boolean;
  showSettingsLink?: boolean;
}) {
  const verify = useVerifySellerLogistics();
  const verifyMutate = verify.mutate;
  const autoRan = useRef(false);

  const checkedAt = profile?.last_checked_at ? Date.parse(profile.last_checked_at) : null;
  const isStale = !!profile && (checkedAt === null || Date.now() - checkedAt > STALE_MS);

  useEffect(() => {
    if (!isStale || autoRan.current) return;
    autoRan.current = true;
    verifyMutate(undefined);
  }, [isStale, verifyMutate]);

  if (isLoading) return null;

  const senderMissing = !profile;
  const status = profile?.verification_status ?? 'unverified';
  const active = profile?.is_logistics_active === true;
  const checking = verify.isPending;

  let tone: Tone = 'warning';
  let title = '';
  let body = '';

  if (senderMissing) {
    title = '補齊寄件人資訊';
    body = '超商取貨的物流單需要你的本名與手機，填好後系統會自動檢查開通狀態。';
  } else if (active) {
    tone = 'success';
    title = SELLER_LOGISTICS_ACTIVE_LABEL;
    body = '買家在你的商品頁與結帳時都能選擇超商取貨付款，物流單會用你填寫的寄件人資料建立。';
  } else if (status === 'failed') {
    tone = 'danger';
    title = '取貨付款檢查未通過';
    body = profile?.verification_message ?? '檢查時發生錯誤，請稍後再試一次。';
  } else if (status === 'unverified' && !checking) {
    tone = 'neutral';
    title = '尚未檢查開通狀態';
    body = '按「重新檢查」就會向綠界確認你的取貨付款是否已開通。';
  } else {
    title = '超商取貨付款尚未開通';
    body = profile?.verification_message ?? SELLER_LOGISTICS_PENDING_LABEL;
  }

  const palette = TONE_STYLE[tone];
  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'danger'
        ? AlertTriangle
        : tone === 'neutral'
          ? Clock
          : Truck;

  return (
    <View
      className="gap-3 rounded-2xl border p-3.5"
      style={{ borderColor: palette.border, backgroundColor: palette.background }}
    >
      <View className="flex-row gap-3">
        <Icon size={18} color={palette.icon} />
        <View className="flex-1 gap-1">
          <Typography type="body-sm" className="text-navy" style={{ fontWeight: '700' }}>
            {title}
          </Typography>
          <Typography type="body-xs" color="muted" className="leading-5">
            {checking ? '正在向綠界確認開通狀態…' : body}
          </Typography>
        </View>
        {checking ? <Spinner size="sm" /> : null}
      </View>

      {senderMissing && showSettingsLink ? (
        <Pressable
          className="flex-row items-center gap-1"
          accessibilityRole="button"
          onPress={() => router.push('/seller/store')}
        >
          <Typography type="body-xs" className="text-brand-blue" style={{ fontWeight: '600' }}>
            前往填寫寄件人資訊
          </Typography>
          <ChevronRight size={14} color={BRAND.blue} />
        </Pressable>
      ) : null}

      {!senderMissing ? (
        <View className="flex-row items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            isDisabled={checking}
            onPress={() => verifyMutate(undefined)}
          >
            <Button.Label>{checking ? '檢查中…' : '重新檢查'}</Button.Label>
          </Button>
          {profile?.last_checked_at ? (
            <Typography type="body-xs" color="muted" className="flex-1">
              最後檢查：{new Date(profile.last_checked_at).toLocaleString('zh-TW')}
            </Typography>
          ) : null}
        </View>
      ) : null}

      {verify.error ? (
        <Typography type="body-xs" className="text-danger">
          {verify.error.message}
        </Typography>
      ) : null}
    </View>
  );
}
