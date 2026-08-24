import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, Chip, Input, Label, Separator, Spinner, Switch, Typography } from 'heroui-native';
import { useBrandToast } from '@/components/brand/BrandToast';
import { router } from 'expo-router';
import { Plus, TicketPercent, Trash2 } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { FormError } from '@/components/FormError';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { SelectPill } from '@/components/SelectPill';
import { SignInRequired } from '@/components/SignInRequired';
import {
  useCreateCoupon,
  useDeleteCoupon,
  useMyCoupons,
  useSetCouponActive,
  type CouponDraft,
} from '@/lib/api/coupons';
import { useMyStoreQuery, useSellerProducts } from '@/lib/api/seller';
import { BRAND } from '@/lib/brand';
import { couponConditions, couponHeadline, formatDate, formatNumber } from '@/lib/format';
import { useUserId } from '@/lib/session';
import {
  COUPON_KIND_LABEL,
  COUPON_STATE_LABEL,
  couponState,
  normalizeCouponCode,
  validateCouponCode,
  type Coupon,
  type CouponKind,
  type CouponState,
} from '@/lib/types';

const KIND_SEGMENTS: Segment<CouponKind>[] = [
  { key: 'percent', label: COUPON_KIND_LABEL.percent },
  { key: 'fixed', label: COUPON_KIND_LABEL.fixed },
  { key: 'free_shipping', label: COUPON_KIND_LABEL.free_shipping },
];

const DURATIONS: { key: string; label: string; days: number | null }[] = [
  { key: '7', label: '7 天', days: 7 },
  { key: '14', label: '14 天', days: 14 },
  { key: '30', label: '30 天', days: 30 },
  { key: '90', label: '90 天', days: 90 },
  { key: 'none', label: '不設期限', days: null },
];

const STATE_COLOR: Record<CouponState, 'success' | 'warning' | 'default' | 'danger'> = {
  live: 'success',
  scheduled: 'warning',
  expired: 'default',
  used_up: 'default',
  disabled: 'danger',
};

const DAY_MS = 86_400_000;

function toPositiveInt(value: string): number | null {
  const n = Number(value.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** 賣家的優惠券管理：建立促銷代碼、隨時停用，或刪掉還沒有人用過的券。 */
export default function SellerCouponsScreen() {
  const userId = useUserId();
  const { toast } = useBrandToast();
  const { data: store, isLoading: storeLoading } = useMyStoreQuery(userId);
  const { data: coupons, isLoading } = useMyCoupons(store?.id ?? null);
  const { data: products } = useSellerProducts(userId);
  const createCoupon = useCreateCoupon();
  const setActive = useSetCouponActive();
  const deleteCoupon = useDeleteCoupon();

  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<CouponKind>('percent');
  const [value, setValue] = useState('10');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minSpend, setMinSpend] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [perUserLimit, setPerUserLimit] = useState('1');
  const [duration, setDuration] = useState('30');
  const [limitProducts, setLimitProducts] = useState(false);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sellable = useMemo(
    () => (products ?? []).filter((product) => product.status !== 'suspended'),
    [products],
  );

  if (!userId) {
    return <SignInRequired title="登入後管理優惠券" />;
  }

  if (storeLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (!store) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          icon={<TicketPercent size={26} color={BRAND.blue} />}
          title="還沒有店鋪"
          description="建立店鋪後就能發行折扣碼。"
          action={
            <Button onPress={() => router.replace('/seller/onboarding')}>
              <Button.Label>申請成為賣家</Button.Label>
            </Button>
          }
        />
      </View>
    );
  }

  const resetForm = () => {
    setCode('');
    setTitle('');
    setKind('percent');
    setValue('10');
    setMaxDiscount('');
    setMinSpend('');
    setUsageLimit('');
    setPerUserLimit('1');
    setDuration('30');
    setLimitProducts(false);
    setProductIds([]);
    setError(null);
  };

  const submit = () => {
    const codeError = validateCouponCode(code);
    if (codeError) {
      setError(codeError);
      return;
    }
    const amount = Number(value.replace(/[^\d.]/g, ''));
    if (kind === 'percent' && (!Number.isFinite(amount) || amount < 1 || amount > 90)) {
      setError('百分比折扣請填 1~90 之間的數字。');
      return;
    }
    if (kind === 'fixed' && (!Number.isFinite(amount) || amount <= 0)) {
      setError('固定金額折扣請填大於 0 的金額。');
      return;
    }
    if (limitProducts && productIds.length === 0) {
      setError('請至少選一件適用商品，或改成全店適用。');
      return;
    }
    setError(null);

    const days = DURATIONS.find((item) => item.key === duration)?.days ?? null;
    const draft: CouponDraft = {
      code,
      title,
      kind,
      value: kind === 'free_shipping' ? 0 : amount,
      maxDiscount: kind === 'percent' ? toPositiveInt(maxDiscount) : null,
      minSpend: toPositiveInt(minSpend) ?? 0,
      usageLimit: toPositiveInt(usageLimit),
      perUserLimit: toPositiveInt(perUserLimit),
      productIds: limitProducts ? productIds : [],
      endsAt: days ? new Date(Date.now() + days * DAY_MS).toISOString() : null,
    };

    createCoupon.mutate(
      { userId, storeId: store.id, draft },
      {
        onSuccess: () => {
          toast.show({ variant: 'success', label: '折扣碼已建立' });
          resetForm();
          setShowForm(false);
        },
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  const toggleActive = (coupon: Coupon) => {
    setActive.mutate(
      { id: coupon.id, isActive: !coupon.is_active },
      {
        onSuccess: () =>
          toast.show({
            variant: 'success',
            label: coupon.is_active ? `${coupon.code} 已停用` : `${coupon.code} 已重新啟用`,
          }),
        onError: (err: Error) => toast.show({ variant: 'danger', label: err.message }),
      },
    );
  };

  const remove = (coupon: Coupon) => {
    deleteCoupon.mutate(coupon.id, {
      onSuccess: () => toast.show({ variant: 'success', label: `${coupon.code} 已刪除` }),
      onError: (err: Error) => toast.show({ variant: 'danger', label: err.message }),
    });
  };

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="p-4 gap-3 pb-10" keyboardShouldPersistTaps="handled">
        <View className="bg-surface gap-2 rounded-2xl p-4">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            {store.name} 的折扣碼
          </Typography>
          <Typography type="body-xs" color="muted" className="leading-5">
            折扣碼會出現在你的商品頁，買家在結帳頁輸入即折抵。折扣只套用在你這一間店鋪的訂單上。
          </Typography>
        </View>

        {showForm ? (
          <View className="bg-surface gap-3 rounded-2xl p-4">
            <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
              新增折扣碼
            </Typography>

            <View>
              <Label isRequired>折扣碼</Label>
              <Input
                placeholder="例如 SUMMER100"
                autoCapitalize="characters"
                maxLength={20}
                value={code}
                onChangeText={(text) => setCode(normalizeCouponCode(text))}
              />
              <Typography type="body-xs" color="muted" className="mt-1">
                4~20 碼英文或數字，全平台不可重複。
              </Typography>
            </View>

            <View>
              <Label>活動名稱（選填）</Label>
              <Input placeholder="例如 夏季滿千折百" value={title} onChangeText={setTitle} />
            </View>

            <View className="gap-2">
              <Label>折扣方式</Label>
              <SegmentedControl items={KIND_SEGMENTS} value={kind} onChange={setKind} size="sm" />
            </View>

            {kind !== 'free_shipping' ? (
              <View>
                <Label isRequired>{kind === 'percent' ? '折扣百分比' : '折抵金額'}</Label>
                <Input
                  keyboardType="number-pad"
                  placeholder={kind === 'percent' ? '10（表示 10% off）' : '100'}
                  value={value}
                  onChangeText={(text) => setValue(text.replace(/[^\d]/g, ''))}
                />
              </View>
            ) : (
              <Typography type="body-xs" color="muted">
                免運費券會折抵這筆訂單的運費。
              </Typography>
            )}

            {kind === 'percent' ? (
              <View>
                <Label>折抵上限（選填）</Label>
                <Input
                  keyboardType="number-pad"
                  placeholder="不填 = 不設上限"
                  value={maxDiscount}
                  onChangeText={(text) => setMaxDiscount(text.replace(/[^\d]/g, ''))}
                />
              </View>
            ) : null}

            <View>
              <Label>最低消費金額（選填）</Label>
              <Input
                keyboardType="number-pad"
                placeholder="不填 = 無門檻"
                value={minSpend}
                onChangeText={(text) => setMinSpend(text.replace(/[^\d]/g, ''))}
              />
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Label>總使用次數</Label>
                <Input
                  keyboardType="number-pad"
                  placeholder="不限"
                  value={usageLimit}
                  onChangeText={(text) => setUsageLimit(text.replace(/[^\d]/g, ''))}
                />
              </View>
              <View className="flex-1">
                <Label>每人限用</Label>
                <Input
                  keyboardType="number-pad"
                  placeholder="不限"
                  value={perUserLimit}
                  onChangeText={(text) => setPerUserLimit(text.replace(/[^\d]/g, ''))}
                />
              </View>
            </View>

            <View className="gap-2">
              <Label>有效期間</Label>
              <View className="flex-row flex-wrap gap-2">
                {DURATIONS.map((item) => (
                  <SelectPill
                    key={item.key}
                    size="sm"
                    tone="soft"
                    label={item.label}
                    selected={duration === item.key}
                    onPress={() => setDuration(item.key)}
                  />
                ))}
              </View>
              <Typography type="body-xs" color="muted">
                從建立當下開始生效。
              </Typography>
            </View>

            <Separator />

            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
                  限定指定商品
                </Typography>
                <Typography type="body-xs" color="muted">
                  關閉 = 全店商品都能用
                </Typography>
              </View>
              <Switch
                isSelected={limitProducts}
                onSelectedChange={(next) => {
                  setLimitProducts(next);
                  if (!next) setProductIds([]);
                }}
              />
            </View>

            {limitProducts ? (
              <View className="gap-2">
                {sellable.length === 0 ? (
                  <Typography type="body-xs" color="muted">
                    還沒有上架商品，請先新增商品或改成全店適用。
                  </Typography>
                ) : (
                  sellable.map((product) => {
                    const selected = productIds.includes(product.id);
                    return (
                      <SelectPill
                        key={product.id}
                        block
                        size="sm"
                        tone="soft"
                        label={product.title}
                        selected={selected}
                        onPress={() =>
                          setProductIds((prev) =>
                            selected
                              ? prev.filter((id) => id !== product.id)
                              : [...prev, product.id],
                          )
                        }
                      />
                    );
                  })
                )}
              </View>
            ) : null}

            <FormError message={error} />

            <View className="flex-row gap-2">
              <Button
                variant="tertiary"
                className="flex-1"
                onPress={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                <Button.Label>取消</Button.Label>
              </Button>
              <Button className="flex-1" isDisabled={createCoupon.isPending} onPress={submit}>
                <Button.Label>{createCoupon.isPending ? '建立中…' : '建立折扣碼'}</Button.Label>
              </Button>
            </View>
          </View>
        ) : (
          <Button onPress={() => setShowForm(true)}>
            <Plus size={18} color={BRAND.white} />
            <Button.Label>新增折扣碼</Button.Label>
          </Button>
        )}

        {isLoading ? (
          <View className="py-8">
            <Spinner />
          </View>
        ) : (coupons ?? []).length === 0 ? (
          <EmptyState
            icon={<TicketPercent size={26} color={BRAND.blue} />}
            title="還沒有折扣碼"
            description="建立第一組促銷代碼，買家在商品頁就看得到。"
          />
        ) : (
          (coupons ?? []).map((coupon) => {
            const state = couponState(coupon);
            return (
              <View key={coupon.id} className="bg-surface gap-2.5 rounded-2xl p-4">
                <View className="flex-row items-center gap-2">
                  <Typography type="body" className="text-navy" style={{ fontWeight: '700' }}>
                    {coupon.code}
                  </Typography>
                  <Chip size="sm" variant="soft" color={STATE_COLOR[state]}>
                    {COUPON_STATE_LABEL[state]}
                  </Chip>
                  <View className="flex-1" />
                  <Typography
                    type="body-sm"
                    className="text-brand-orange"
                    style={{ fontWeight: '700' }}
                  >
                    {couponHeadline(coupon)}
                  </Typography>
                </View>

                {coupon.title ? (
                  <Typography type="body-sm" className="text-navy">
                    {coupon.title}
                  </Typography>
                ) : null}

                <Typography type="body-xs" color="muted" className="leading-5">
                  {couponConditions(coupon).join('・')}
                </Typography>

                <Typography type="body-xs" color="muted">
                  已使用 {formatNumber(coupon.used_count)}
                  {coupon.usage_limit ? ` / ${formatNumber(coupon.usage_limit)}` : ' 次'}
                  {coupon.ends_at ? `・${formatDate(coupon.ends_at)} 到期` : ''}
                </Typography>

                <Separator />

                <View className="flex-row items-center gap-3">
                  <Typography type="body-xs" color="muted" className="flex-1">
                    {coupon.is_active ? '買家現在看得到這張券' : '已停用，買家看不到也無法使用'}
                  </Typography>
                  <Switch
                    isSelected={coupon.is_active}
                    onSelectedChange={() => toggleActive(coupon)}
                  />
                  {coupon.used_count === 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`刪除折扣碼 ${coupon.code}`}
                      hitSlop={6}
                      onPress={() => remove(coupon)}
                      className="h-9 w-9 items-center justify-center"
                    >
                      <Trash2 size={17} color={BRAND.orange} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
