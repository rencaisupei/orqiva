import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, Input, Label, Separator, Spinner, Typography, useToast } from 'heroui-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AppImage } from '@/components/AppImage';
import { CouponInput } from '@/components/CouponInput';
import { CvsStorePicker } from '@/components/CvsStorePicker';
import { EmptyState } from '@/components/EmptyState';
import { FormError } from '@/components/FormError';
import { SelectPill } from '@/components/SelectPill';
import { SignInRequired } from '@/components/SignInRequired';
import type { CouponPreview } from '@/lib/api/contracts';
import {
  SHIPPING_FEE,
  useCart,
  usePlaceOrder,
  type CheckoutLine,
  type CvsPickup,
} from '@/lib/api/commerce';
import { useLogisticsConfig, useSellerLogisticsStatuses } from '@/lib/api/logistics';
import { formatPrice } from '@/lib/format';
import { useSessionStore, useUserId } from '@/lib/session';
import {
  CVS_SELLER_INACTIVE_HINT,
  validateReceiverCellPhone,
  validateReceiverName,
} from '@/lib/types';

type DeliveryMode = 'home' | 'cvs';

const MIN_CVS_AMOUNT = 1;
const MAX_CVS_AMOUNT = 20000;

export default function CheckoutScreen() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const userId = useUserId();
  const profile = useSessionStore((s) => s.profile);
  const account = useSessionStore((s) => s.account);
  const { toast } = useToast();

  const { data: cartItems, isLoading } = useCart(userId);
  const { data: logistics } = useLogisticsConfig();
  const placeOrder = usePlaceOrder();

  const [name, setName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(account?.phone ?? '');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<DeliveryMode>('home');
  const [pickup, setPickup] = useState<CvsPickup | null>(null);
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const cvsEnabled = !!logistics?.is_enabled && (logistics?.enabled_sub_types.length ?? 0) > 0;

  const lines = useMemo(() => {
    const source = (cartItems ?? []).filter((item) => item.product);
    if (productId) return source.filter((item) => item.product_id === productId);
    return source.filter((item) => item.selected);
  }, [cartItems, productId]);

  /*
   * 取貨付款只能賣給「物流已開通」的賣家。這一筆結帳裡只要有一位賣家未開通，
   * 整張訂單就不能走超商取貨（訂單依店舖拆單，但門市與收件資料是共用的）。
   */
  const sellerIds = useMemo(() => lines.map((item) => item.product?.seller_id ?? null), [lines]);
  const { data: sellerStatuses } = useSellerLogisticsStatuses(sellerIds);
  const cvsSellerReady =
    lines.length > 0 &&
    lines.every(
      (item) =>
        !!item.product?.seller_id &&
        sellerStatuses?.[item.product.seller_id]?.is_logistics_active === true,
    );
  const cvsSelectable = cvsEnabled && cvsSellerReady;

  useEffect(() => {
    if (!cvsSelectable) setMode('home');
  }, [cvsSelectable]);

  const subtotal = lines.reduce((sum, item) => sum + (item.product?.price ?? 0) * item.quantity, 0);
  const storeCount = new Set(lines.map((item) => item.product?.store_id)).size;
  const shipping = storeCount * SHIPPING_FEE;
  const discount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal + shipping - discount);

  /* 折扣碼試算需要的最小輸入，與送出訂單用的是同一份購物車內容。 */
  const couponItems = lines.map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
  }));
  const storeNameById = (storeId: string) =>
    lines.find((item) => item.product?.store_id === storeId)?.product?.store?.name;

  if (!userId) {
    return <SignInRequired title="登入後才能結帳" />;
  }

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (lines.length === 0) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          title="沒有要結帳的商品"
          description="回到購物車勾選商品後再結帳。"
          action={
            <Button onPress={() => router.replace('/cart')}>
              <Button.Label>回到購物車</Button.Label>
            </Button>
          }
        />
      </View>
    );
  }

  const isCvs = mode === 'cvs';

  /*
   * 超商取貨的收件人姓名／手機由超商系統核對，格式錯了包裹會被退回，
   * 所以規則比宅配嚴格：姓名限 2~5 個中文本名、手機限 09 開頭 10 碼。
   */
  const nameError = isCvs ? validateReceiverName(name) : name.trim() ? null : '請填寫收件人姓名';
  const phoneError = isCvs
    ? validateReceiverCellPhone(phone)
    : phone.trim()
      ? null
      : '請填寫聯絡電話';
  const showNameError = !!nameError && (nameTouched || name.length > 0);
  const showPhoneError = !!phoneError && (phoneTouched || phone.length > 0);

  const storeSelected = !!pickup?.storeId;
  const amountError =
    isCvs && (total < MIN_CVS_AMOUNT || total > MAX_CVS_AMOUNT)
      ? '綠界超商取貨付款金額限制為 1 ~ 20,000 元，請調整購物車'
      : null;
  const addressError = !isCvs && !address.trim() ? '請填寫收件地址' : null;

  const canSubmit =
    !nameError && !phoneError && !amountError && (isCvs ? storeSelected : !addressError);

  const blockReason = (() => {
    if (canSubmit) return null;
    if (amountError) return amountError;
    if (nameError || phoneError) return '請先填好收件人姓名與手機，才能送出訂單。';
    if (isCvs && !storeSelected) return '請先選擇超商取貨門市。';
    return addressError;
  })();

  const onChangePhone = (value: string) => {
    setPhone(isCvs ? value.replace(/\D/g, '').slice(0, 10) : value);
    setPhoneTouched(true);
  };

  const submit = () => {
    setNameTouched(true);
    setPhoneTouched(true);
    if (!canSubmit) {
      setError(blockReason);
      return;
    }
    setError(null);

    const payload: CheckoutLine[] = lines.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      shipping_method: mode === 'cvs' ? '超商取貨' : item.shipping_method,
    }));

    placeOrder.mutate(
      {
        items: payload,
        recipientName: name.trim(),
        recipientPhone: phone.trim(),
        shippingAddress:
          mode === 'cvs'
            ? [pickup?.storeName, pickup?.storeAddress].filter(Boolean).join(' ')
            : address.trim(),
        note: note.trim(),
        cvsPickup: mode === 'cvs' ? pickup : null,
        couponCode: coupon?.code ?? null,
      },
      {
        onSuccess: () => {
          toast.show({ variant: 'success', label: '訂單已成立' });
          router.replace('/orders');
        },
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="p-4 gap-3 pb-6" keyboardShouldPersistTaps="handled">
        {cvsEnabled ? (
          <View className="bg-surface gap-3 rounded-2xl p-4">
            <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
              取貨方式
            </Typography>
            <View className="flex-row gap-2">
              {(
                [
                  { key: 'home', label: '宅配到府' },
                  { key: 'cvs', label: '超商取貨付款' },
                ] satisfies { key: DeliveryMode; label: string }[]
              ).map((option) => (
                <SelectPill
                  key={option.key}
                  size="sm"
                  label={option.label}
                  disabled={option.key === 'cvs' && !cvsSelectable}
                  selected={mode === option.key}
                  onPress={() => {
                    setMode(option.key);
                    setError(null);
                    // 切到超商取貨時，先把電話裡的分隔符號去掉，避免看起來已填卻不符格式。
                    if (option.key === 'cvs')
                      setPhone((prev) => prev.replace(/\D/g, '').slice(0, 10));
                  }}
                />
              ))}
            </View>

            {!cvsSelectable ? (
              <Typography type="body-xs" className="text-brand-orange leading-5">
                {CVS_SELLER_INACTIVE_HINT}
              </Typography>
            ) : null}

            {mode === 'cvs' ? (
              <>
                <Separator />
                <CvsStorePicker
                  availableSubTypes={logistics?.enabled_sub_types ?? []}
                  value={pickup}
                  onChange={setPickup}
                />
                <Typography type="body-xs" color="muted">
                  超商取貨付款由綠界物流處理，到店後付款取貨（單筆 1 ~ 20,000 元）。
                </Typography>
              </>
            ) : null}
          </View>
        ) : null}

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            收件資訊
          </Typography>
          <View>
            <Label isRequired>收件人{isCvs ? '姓名（中文本名）' : ''}</Label>
            <Input
              placeholder={isCvs ? '2~5 個中文字，例如：王小明' : '姓名'}
              value={name}
              isInvalid={showNameError}
              maxLength={isCvs ? 5 : undefined}
              onChangeText={(value) => {
                setName(value);
                setNameTouched(true);
              }}
            />
            {showNameError ? (
              <FormError message={nameError} className="mt-1.5" />
            ) : isCvs ? (
              <Typography type="body-xs" color="muted" className="mt-1">
                超商取貨時需與證件相符，請填中文本名，不要填暱稱或英文。
              </Typography>
            ) : null}
          </View>
          <View>
            <Label isRequired>{isCvs ? '收件人手機' : '聯絡電話'}</Label>
            <Input
              placeholder="0912345678"
              keyboardType="phone-pad"
              inputMode={isCvs ? 'numeric' : 'tel'}
              maxLength={isCvs ? 10 : undefined}
              value={phone}
              isInvalid={showPhoneError}
              onChangeText={onChangePhone}
            />
            {showPhoneError ? <FormError message={phoneError} className="mt-1.5" /> : null}
          </View>
          {mode === 'home' ? (
            <View>
              <Label isRequired>收件地址</Label>
              <Input placeholder="縣市 / 區 / 路名門牌" value={address} onChangeText={setAddress} />
            </View>
          ) : null}
          <View>
            <Label>訂單備註（選填）</Label>
            <Input placeholder="給賣家的備註" value={note} onChangeText={setNote} />
          </View>
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            商品明細
          </Typography>
          {lines.map((item) => (
            <View key={item.id} className="flex-row items-center gap-3">
              <AppImage uri={item.product?.cover_url} className="h-14 w-14 rounded-xl" />
              <View className="flex-1">
                <Typography type="body-sm" numberOfLines={2} className="text-navy">
                  {item.product?.title}
                </Typography>
                <Typography type="body-xs" color="muted">
                  {item.product?.store?.name} · {item.shipping_method} · x{item.quantity}
                </Typography>
              </View>
              <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
                {formatPrice((item.product?.price ?? 0) * item.quantity)}
              </Typography>
            </View>
          ))}
        </View>

        <CouponInput
          items={couponItems}
          shippingFee={SHIPPING_FEE}
          applied={coupon}
          onApplied={setCoupon}
          storeName={storeNameById}
        />

        <View className="bg-surface gap-2 rounded-2xl p-4">
          <View className="flex-row justify-between">
            <Typography type="body-sm" color="muted">
              商品小計
            </Typography>
            <Typography type="body-sm" className="text-navy">
              {formatPrice(subtotal)}
            </Typography>
          </View>
          <View className="flex-row justify-between">
            <Typography type="body-sm" color="muted">
              運費（{storeCount} 位賣家）
            </Typography>
            <Typography type="body-sm" className="text-navy">
              {formatPrice(shipping)}
            </Typography>
          </View>
          {discount > 0 && coupon ? (
            <View className="flex-row justify-between">
              <Typography type="body-sm" color="muted">
                折扣碼 {coupon.code}
              </Typography>
              <Typography type="body-sm" className="text-brand-orange">
                -{formatPrice(discount)}
              </Typography>
            </View>
          ) : null}
          <Separator />
          <View className="flex-row items-center justify-between">
            <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
              應付總額
            </Typography>
            <Typography type="h5" className="text-brand-orange" style={{ fontWeight: '700' }}>
              {formatPrice(total)}
            </Typography>
          </View>
          <Typography type="body-xs" color="muted">
            {mode === 'cvs'
              ? `超商取貨付款：到店取貨時支付代收金額 ${formatPrice(total)}（商品總金額 + 運費），賣家出貨後會收到寄貨編號。`
              : '宅配目前為貨到付款流程，線上金流將在下一階段開放。'}
          </Typography>
        </View>

        <FormError message={error} />
      </ScrollView>

      <View className="border-border bg-surface pb-safe-offset-3 gap-2 border-t px-4 py-3">
        {blockReason && !error ? (
          <Typography type="body-xs" color="muted" className="text-center">
            {blockReason}
          </Typography>
        ) : null}
        <Button isDisabled={placeOrder.isPending || !canSubmit} onPress={submit}>
          <Button.Label>
            {placeOrder.isPending ? '建立訂單中…' : `送出訂單 ${formatPrice(total)}`}
          </Button.Label>
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
