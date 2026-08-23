import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, Input, Label, Spinner, Typography, useToast } from 'heroui-native';
import { router } from 'expo-router';
import { Check, Coins, Megaphone, Store as StoreIcon, TrendingUp } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { FormError } from '@/components/FormError';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { SelectPill } from '@/components/SelectPill';
import { SignInRequired } from '@/components/SignInRequired';
import { useCoinSummary, useRedeemCoins, type RedeemInput } from '@/lib/api/coins';
import { useSellerProducts } from '@/lib/api/seller';
import { BRAND } from '@/lib/brand';
import { formatNumber, formatPrice } from '@/lib/format';
import { useUserId } from '@/lib/session';
import {
  AD_BANNER_PLACEMENT_LABEL,
  AD_BANNER_PLACEMENTS,
  COIN_NAME,
  type AdBannerPlacement,
  type CoinRedemptionKind,
  type Product,
  type StoreBadgeKind,
} from '@/lib/types';

const KIND_SEGMENTS: Segment<CoinRedemptionKind>[] = [
  { key: 'ad_slot', label: '廣告版位' },
  { key: 'product_boost', label: '商品置頂' },
  { key: 'store_badge', label: '店舖徽章' },
];

const AD_DAY_OPTIONS = [1, 3, 7, 14, 30];
const BOOST_DAY_OPTIONS = [1, 3, 7, 14];

function ProductPicker({
  products,
  value,
  onChange,
}: {
  products: Product[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  if (products.length === 0) {
    return (
      <View className="border-border bg-background rounded-2xl border border-dashed p-4">
        <Typography type="body-sm" color="muted">
          還沒有上架中的商品。先上架一件商品，才能拿它來做推廣。
        </Typography>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {products.map((product) => {
        const selected = value === product.id;
        return (
          <Pressable
            key={product.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(product.id)}
            style={Platform.OS === 'web' ? { cursor: 'pointer' } : undefined}
            className={`flex-row items-center gap-3 rounded-2xl border p-2.5 ${
              selected ? 'border-brand-blue bg-brand-blue-soft' : 'border-border bg-background'
            }`}
          >
            <AppImage uri={product.cover_url} className="h-12 w-12 rounded-xl" />
            <View className="flex-1">
              <Typography type="body-sm" numberOfLines={1} className="text-navy">
                {product.title}
              </Typography>
              <Typography type="body-xs" color="muted">
                {formatPrice(product.price)} · 已售 {formatNumber(product.sold_count)}
              </Typography>
            </View>
            {selected ? <Check size={17} color={BRAND.blue} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * 用J幣兌換推廣。
 *
 * 廣告版位要管理員審核（過了才會出現在首頁輪播／開啟時的彈出廣告），商品置頂與
 * 店舖徽章立刻生效。價目表由 seller-coins 回傳，這一頁不自己寫死價格。
 */
export default function SellerPromoteScreen() {
  const userId = useUserId();
  const { toast } = useToast();
  const { data, isLoading } = useCoinSummary(userId);
  const { data: allProducts } = useSellerProducts(userId);
  const redeem = useRedeemCoins();

  const [kind, setKind] = useState<CoinRedemptionKind>('ad_slot');
  const [productId, setProductId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<AdBannerPlacement>('carousel');
  const [adDays, setAdDays] = useState(3);
  const [boostDays, setBoostDays] = useState(3);
  const [badgeKind, setBadgeKind] = useState<StoreBadgeKind>('flash');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [ctaLabel, setCtaLabel] = useState('立即查看');
  const [linkToProduct, setLinkToProduct] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const products = useMemo(
    () => (allProducts ?? []).filter((product) => product.status === 'active'),
    [allProducts],
  );
  const selectedProduct = products.find((product) => product.id === productId) ?? null;

  if (!userId) {
    return (
      <View className="bg-background flex-1">
        <SignInRequired title="登入後兌換推廣" />
      </View>
    );
  }

  if (isLoading || !data) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (!data.hasStore) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          icon={<StoreIcon size={26} color={BRAND.blue} />}
          title="先建立店舖"
          description="推廣是給店舖用的，建立店舖後就能兌換。"
          action={
            <Button onPress={() => router.replace('/seller/onboarding')}>
              <Button.Label>申請成為賣家</Button.Label>
            </Button>
          }
        />
      </View>
    );
  }

  const { pricing, wallet } = data;
  const badge = pricing.badges.find((item) => item.kind === badgeKind) ?? pricing.badges[0];
  const adDayOptions = AD_DAY_OPTIONS.filter((days) => days <= pricing.adMaxDays);
  const boostDayOptions = BOOST_DAY_OPTIONS.filter((days) => days <= pricing.boostMaxDays);

  const cost =
    kind === 'ad_slot'
      ? pricing.ad[placement] * adDays
      : kind === 'product_boost'
        ? pricing.boost * boostDays
        : (badge?.cost ?? 0);

  const days =
    kind === 'ad_slot' ? adDays : kind === 'product_boost' ? boostDays : (badge?.days ?? 0);

  const submit = () => {
    setError(null);

    if (kind !== 'store_badge' && !selectedProduct) {
      setError('請先選一件要推廣的商品。');
      return;
    }
    if (kind === 'ad_slot') {
      const trimmed = title.trim();
      if (trimmed.length < 2 || trimmed.length > 30) {
        setError('廣告標題請填 2 到 30 字。');
        return;
      }
      if (!selectedProduct?.cover_url) {
        setError('這件商品沒有封面圖片，請先為商品上傳圖片。');
        return;
      }
    }
    if (wallet.balance < cost) {
      setError(`${COIN_NAME}不足，還差 ${formatNumber(cost - wallet.balance)}。`);
      return;
    }

    const input: RedeemInput =
      kind === 'ad_slot'
        ? {
            kind: 'ad_slot',
            placement,
            days: adDays,
            title: title.trim(),
            subtitle: subtitle.trim(),
            imageUrl: selectedProduct!.cover_url!,
            ctaLabel: ctaLabel.trim() || '立即查看',
            productId: linkToProduct ? selectedProduct!.id : null,
          }
        : kind === 'product_boost'
          ? { kind: 'product_boost', productId: selectedProduct!.id, days: boostDays }
          : { kind: 'store_badge', badgeKind };

    redeem.mutate(input, {
      onSuccess: (result) => {
        toast.show({
          variant: 'success',
          label:
            result.status === 'pending'
              ? `已送審，扣除 ${formatNumber(result.cost)} ${COIN_NAME}，通過後開始曝光`
              : `兌換成功，扣除 ${formatNumber(result.cost)} ${COIN_NAME}`,
        });
        setTitle('');
        setSubtitle('');
        router.push('/seller/coins');
      },
      onError: (err: Error) => setError(err.message),
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="bg-background flex-1"
    >
      <ScrollView contentContainerClassName="p-4 gap-3 pb-8" showsVerticalScrollIndicator={false}>
        <View className="bg-surface flex-row items-center gap-3 rounded-2xl p-4">
          <View
            className="h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: BRAND.orangeSoft }}
          >
            <Coins size={19} color={BRAND.orange} />
          </View>
          <View className="flex-1">
            <Typography type="body-xs" color="muted">
              目前{COIN_NAME}
            </Typography>
            <Typography type="h5" className="text-navy" style={{ fontWeight: '700' }}>
              {formatNumber(wallet.balance)}
            </Typography>
          </View>
          <Button size="sm" variant="secondary" onPress={() => router.push('/seller/coins')}>
            <Button.Label>賺更多</Button.Label>
          </Button>
        </View>

        <SegmentedControl items={KIND_SEGMENTS} value={kind} onChange={setKind} size="sm" />

        {kind === 'store_badge' ? (
          <View className="bg-surface gap-3 rounded-2xl p-4">
            <View className="flex-row items-center gap-2">
              <StoreIcon size={16} color={BRAND.navy} />
              <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                店舖徽章
              </Typography>
            </View>
            <Typography type="body-xs" color="muted">
              徽章會顯示在你的店舖頁面，讓買家一眼看出這是活躍店家。
            </Typography>
            <View className="gap-2">
              {pricing.badges.map((item) => (
                <SelectPill
                  key={item.kind}
                  block
                  tone="soft"
                  label={`${item.label} · ${item.days} 天 · ${formatNumber(item.cost)} ${COIN_NAME}`}
                  selected={badgeKind === item.kind}
                  onPress={() => setBadgeKind(item.kind)}
                />
              ))}
            </View>
          </View>
        ) : (
          <View className="bg-surface gap-3 rounded-2xl p-4">
            <Label isRequired>選擇要推廣的商品</Label>
            <ProductPicker products={products} value={productId} onChange={setProductId} />
          </View>
        )}

        {kind === 'ad_slot' ? (
          <View className="bg-surface gap-3 rounded-2xl p-4">
            <View className="flex-row items-center gap-2">
              <Megaphone size={16} color={BRAND.orange} />
              <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                廣告內容
              </Typography>
            </View>

            <Label isRequired>廣告標題（2-30 字）</Label>
            <Input
              placeholder={selectedProduct?.title ?? '例如：夏季家電下殺 5 折'}
              value={title}
              onChangeText={setTitle}
            />

            <Label>一句說明（選填）</Label>
            <Input
              placeholder="例如：限量 20 台，售完不補"
              value={subtitle}
              onChangeText={setSubtitle}
            />

            <Label>按鈕文字</Label>
            <Input placeholder="立即查看" value={ctaLabel} onChangeText={setCtaLabel} />

            <Label>顯示版位</Label>
            <View className="flex-row flex-wrap gap-2">
              {AD_BANNER_PLACEMENTS.map((item) => (
                <SelectPill
                  key={item}
                  size="sm"
                  tone="soft"
                  label={`${AD_BANNER_PLACEMENT_LABEL[item]} · ${formatNumber(pricing.ad[item])}／天`}
                  selected={placement === item}
                  onPress={() => setPlacement(item)}
                />
              ))}
            </View>

            <Label>曝光天數</Label>
            <View className="flex-row flex-wrap gap-2">
              {adDayOptions.map((option) => (
                <SelectPill
                  key={option}
                  size="sm"
                  tone="soft"
                  label={`${option} 天`}
                  selected={adDays === option}
                  onPress={() => setAdDays(option)}
                />
              ))}
            </View>

            <Label>點廣告後前往</Label>
            <View className="flex-row flex-wrap gap-2">
              <SelectPill
                size="sm"
                tone="soft"
                label="這件商品"
                selected={linkToProduct}
                onPress={() => setLinkToProduct(true)}
              />
              <SelectPill
                size="sm"
                tone="soft"
                label="我的店舖"
                selected={!linkToProduct}
                onPress={() => setLinkToProduct(false)}
              />
            </View>

            <Typography type="body-xs" color="muted">
              廣告圖片會使用這件商品的封面。送出後由管理員審核，通過才會曝光；未通過會把
              {COIN_NAME}全額退回。
            </Typography>
          </View>
        ) : null}

        {kind === 'product_boost' ? (
          <View className="bg-surface gap-3 rounded-2xl p-4">
            <View className="flex-row items-center gap-2">
              <TrendingUp size={16} color={BRAND.blue} />
              <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                置頂天數
              </Typography>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {boostDayOptions.map((option) => (
                <SelectPill
                  key={option}
                  size="sm"
                  tone="soft"
                  label={`${option} 天 · ${formatNumber(pricing.boost * option)} ${COIN_NAME}`}
                  selected={boostDays === option}
                  onPress={() => setBoostDays(option)}
                />
              ))}
            </View>
            <Typography type="body-xs" color="muted">
              置頂期間，這件商品會排在商品列表與分類頁的前面，並標示「推廣」。買家自己選擇價格或評價排序時不會插隊。
            </Typography>
          </View>
        ) : null}

        <View className="bg-surface gap-2 rounded-2xl p-4">
          <View className="flex-row items-center justify-between">
            <Typography type="body-sm" color="muted">
              兌換內容
            </Typography>
            <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
              {KIND_SEGMENTS.find((item) => item.key === kind)?.label} · {days} 天
            </Typography>
          </View>
          <View className="flex-row items-center justify-between">
            <Typography type="body-sm" color="muted">
              需要{COIN_NAME}
            </Typography>
            <Typography type="h6" className="text-brand-orange" style={{ fontWeight: '700' }}>
              {formatNumber(cost)}
            </Typography>
          </View>
          <View className="flex-row items-center justify-between">
            <Typography type="body-xs" color="muted">
              兌換後餘額
            </Typography>
            <Typography type="body-xs" className="text-navy">
              {formatNumber(Math.max(0, wallet.balance - cost))}
            </Typography>
          </View>
        </View>

        <FormError message={error} />

        <Button isDisabled={redeem.isPending} onPress={submit}>
          <Button.Label>
            {redeem.isPending
              ? '處理中…'
              : kind === 'ad_slot'
                ? `送審並扣除 ${formatNumber(cost)} ${COIN_NAME}`
                : `確認兌換（${formatNumber(cost)} ${COIN_NAME}）`}
          </Button.Label>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
