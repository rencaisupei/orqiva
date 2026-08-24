import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, Input, Label, Separator, Spinner, Typography } from 'heroui-native';
import { useBrandToast } from '@/components/brand/BrandToast';
import { router, useLocalSearchParams } from 'expo-router';

import { AppImage } from '@/components/AppImage';
import { CouponInput } from '@/components/CouponInput';
import { CvsStorePicker } from '@/components/CvsStorePicker';
import { EmptyState } from '@/components/EmptyState';
import { FormError } from '@/components/FormError';
import { SelectPill } from '@/components/SelectPill';
import { SignInRequired } from '@/components/SignInRequired';
import type { CouponPreview } from '@/lib/api/contracts';
import { useBulkTiers } from '@/lib/api/bulk';
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
  bulkDiscountFor,
  COD_OPTION_LABEL,
  CVS_COD_RANGE_HINT,
  CVS_SELLER_INACTIVE_HINT,
  codAmountError,
  isCvsSubType,
  isHomeSubType,
  LOGISTICS_SUB_TYPES,
  logisticsTypeOf,
  validateReceiverAddress,
  validateReceiverCellPhone,
  validateReceiverCity,
  validateReceiverName,
  validateReceiverZipCode,
  type LogisticsSubType,
} from '@/lib/types';

/**
 * 結帳只提供支援貨到付款的配送方式：
 *   7-11 / 全家 / 萊爾富 取貨付款（綠界 C2C，LogisticsType = CVS）
 *   黑貓宅急便 貨到付款（綠界宅配，LogisticsType = HOME）
 *   'manual' = 賣家自行寄送的宅配貨到付款；只有在綠界宅配不可用時才出現，
 *   否則買家會看到兩個看起來一樣的宅配選項。
 */
type Delivery = LogisticsSubType | 'manual';

const MANUAL_LABEL = '宅配 貨到付款（賣家自行寄送）';

export default function CheckoutScreen() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const userId = useUserId();
  const profile = useSessionStore((s) => s.profile);
  const account = useSessionStore((s) => s.account);
  const { toast } = useBrandToast();

  const { data: cartItems, isLoading } = useCart(userId);
  const { data: logistics } = useLogisticsConfig();
  const placeOrder = usePlaceOrder();

  const [name, setName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(account?.phone ?? '');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [delivery, setDelivery] = useState<Delivery>('manual');
  const [pickup, setPickup] = useState<CvsPickup | null>(null);
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const lines = useMemo(() => {
    const source = (cartItems ?? []).filter((item) => item.product);
    if (productId) return source.filter((item) => item.product_id === productId);
    return source.filter((item) => item.selected);
  }, [cartItems, productId]);

  /* 階梯式數量折扣：伺服器下單時會重算，這裡只是讓買家看到一致的金額。 */
  const { data: tierMap } = useBulkTiers(lines.map((item) => item.product_id));

  /*
   * 貨到付款只能賣給「物流已開通」的賣家。這一筆結帳裡只要有一位賣家未開通，
   * 整張訂單就不能走綠界（訂單依店舖拆單，但收件資料是共用的）。
   */
  const sellerIds = useMemo(() => lines.map((item) => item.product?.seller_id ?? null), [lines]);
  const { data: sellerStatuses } = useSellerLogisticsStatuses(sellerIds);
  const sellerReady =
    lines.length > 0 &&
    lines.every(
      (item) =>
        !!item.product?.seller_id &&
        sellerStatuses?.[item.product.seller_id]?.is_logistics_active === true,
    );

  /** 平台後台開啟、且賣家已開通的綠界貨到付款選項。 */
  const ecpaySubTypes = useMemo(() => {
    if (!logistics?.is_enabled) return [];
    const enabled = logistics.enabled_sub_types ?? [];
    return LOGISTICS_SUB_TYPES.filter((subType) => enabled.includes(subType));
  }, [logistics]);
  const ecpaySelectable = ecpaySubTypes.length > 0 && sellerReady;
  const homeCodAvailable = ecpaySelectable && ecpaySubTypes.some(isHomeSubType);

  const subtotal = lines.reduce((sum, item) => sum + (item.product?.price ?? 0) * item.quantity, 0);
  const storeCount = new Set(lines.map((item) => item.product?.store_id)).size;
  const shipping = storeCount * SHIPPING_FEE;
  /* 數量折扣：與 market edge function 同一份規則，先折它再套折扣碼。 */
  const bulkOf = (item: (typeof lines)[number]) =>
    bulkDiscountFor(item.product?.price ?? 0, item.quantity, tierMap?.get(item.product_id) ?? []);
  const bulkDiscount = lines.reduce((sum, item) => sum + bulkOf(item), 0);
  const discount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal + shipping - bulkDiscount - discount);

  /*
   * 代收金額的上下限是「每一張物流單」各自計算的：購物車跨店時每間店舖會拆成
   * 一筆訂單，所以這裡也逐筆算出應付金額，和伺服器的檢查完全一致。
   */
  const orderTotals = useMemo(() => {
    const netByStore = new Map<string, number>();
    for (const item of lines) {
      const storeId = item.product?.store_id;
      if (!storeId) continue;
      const price = item.product?.price ?? 0;
      const net =
        price * item.quantity -
        bulkDiscountFor(price, item.quantity, tierMap?.get(item.product_id) ?? []);
      netByStore.set(storeId, (netByStore.get(storeId) ?? 0) + net);
    }
    return [...netByStore.entries()].map(([storeId, storeNet]) =>
      Math.max(
        0,
        storeNet + SHIPPING_FEE - (coupon?.store_id === storeId ? (coupon?.discount ?? 0) : 0),
      ),
    );
  }, [lines, coupon, tierMap]);

  /** 這個貨到付款方式在這筆結帳的金額限制內嗎？回傳第一個擋住的原因。 */
  const codError = (subType: LogisticsSubType): string | null =>
    orderTotals.map((amount) => codAmountError(subType, amount)).find((msg) => !!msg) ?? null;

  /* 綠界宅配可用時就不再提供「賣家自行寄送」，避免兩個宅配選項並列。 */
  const options = useMemo(() => {
    const list: { key: Delivery; label: string }[] = ecpaySubTypes.map((subType) => ({
      key: subType,
      label: COD_OPTION_LABEL[subType],
    }));
    if (!homeCodAvailable) list.push({ key: 'manual', label: MANUAL_LABEL });
    return list;
  }, [ecpaySubTypes, homeCodAvailable]);

  /** 選項是否可以按：賣家未開通、或金額超出代收上下限就整格停用。 */
  const optionDisabled = (key: Delivery): boolean => {
    if (key === 'manual') return false;
    if (!ecpaySelectable) return true;
    return codError(key) !== null;
  };

  useEffect(() => {
    // 賣家未開通或後台關閉時，選到的綠界選項要退回賣家自寄宅配。
    if (delivery !== 'manual' && !ecpaySelectable) setDelivery('manual');
  }, [delivery, ecpaySelectable]);

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

  const ecpaySubType: LogisticsSubType | null = delivery === 'manual' ? null : delivery;
  const cvsSubType = isCvsSubType(delivery) ? delivery : null;
  const isCvs = cvsSubType !== null;
  const isHomeCod = delivery === 'TCAT';
  const isEcpay = ecpaySubType !== null;
  const needsAddress = !isCvs;

  /*
   * 超商取貨的收件人姓名／手機由超商系統核對，格式錯了包裹會被退回，
   * 所以規則比宅配嚴格：姓名限 2~5 個中文本名、手機限 09 開頭 10 碼。
   * 黑貓宅急便由司機聯絡收件人，手機同樣必填，但姓名不限中文長度。
   */
  const nameError = isCvs ? validateReceiverName(name) : name.trim() ? null : '請填寫收件人姓名';
  const phoneError =
    isCvs || isHomeCod ? validateReceiverCellPhone(phone) : phone.trim() ? null : '請填寫聯絡電話';
  const showNameError = !!nameError && (nameTouched || name.length > 0);
  const showPhoneError = !!phoneError && (phoneTouched || phone.length > 0);

  const storeSelected = !!pickup?.storeId;
  const amountError = ecpaySubType ? codError(ecpaySubType) : null;
  // 黑貓建單一定要有郵遞區號；賣家自寄宅配則只在買家有填時檢查格式。
  const zipError = isHomeCod
    ? validateReceiverZipCode(zipCode)
    : zipCode.trim()
      ? validateReceiverZipCode(zipCode)
      : null;
  const cityError = needsAddress ? validateReceiverCity(city) : null;
  const addressError = needsAddress ? validateReceiverAddress(address) : null;

  const canSubmit =
    !nameError &&
    !phoneError &&
    !amountError &&
    (isCvs ? storeSelected : !zipError && !cityError && !addressError);

  const blockReason = (() => {
    if (canSubmit) return null;
    if (amountError) return amountError;
    if (nameError || phoneError) return '請先填好收件人姓名與手機，才能送出訂單。';
    if (isCvs && !storeSelected) return '請先選擇超商取貨門市。';
    return zipError ?? cityError ?? addressError;
  })();

  const onChangePhone = (value: string) => {
    setPhone(isEcpay ? value.replace(/\D/g, '').slice(0, 10) : value);
    setPhoneTouched(true);
  };

  const changeDelivery = (key: Delivery) => {
    setDelivery(key);
    setError(null);
    if (isCvsSubType(key)) {
      // 換超商等於換通路，先前選的門市代號不能沿用。
      setPickup(null);
      setPhone((prev) => prev.replace(/\D/g, '').slice(0, 10));
    }
    if (key === 'TCAT') setPhone((prev) => prev.replace(/\D/g, '').slice(0, 10));
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
      shipping_method: isCvs ? '超商取貨' : '宅配',
    }));

    placeOrder.mutate(
      {
        items: payload,
        recipientName: name.trim(),
        recipientPhone: phone.trim(),
        shippingAddress: isCvs
          ? [pickup?.storeName, pickup?.storeAddress].filter(Boolean).join(' ')
          : [zipCode.trim(), `${city.trim()}${address.trim()}`].filter(Boolean).join(' '),
        note: note.trim(),
        logisticsType: ecpaySubType ? logisticsTypeOf(ecpaySubType) : null,
        logisticsSubType: isHomeCod ? 'TCAT' : null,
        cvsPickup: isCvs ? pickup : null,
        receiverZipCode: needsAddress ? zipCode.trim() : '',
        receiverCity: needsAddress ? city.trim() : '',
        receiverAddress: needsAddress ? address.trim() : '',
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
        <View className="bg-surface gap-3 rounded-2xl p-4">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            配送與付款方式
          </Typography>
          <Typography type="body-xs" color="muted">
            全部為貨到付款：超商取貨時在門市付款，黑貓宅急便由司機到府收款。
          </Typography>

          <View className="flex-row flex-wrap gap-2">
            {options.map((option) => (
              <SelectPill
                key={option.key}
                size="sm"
                label={option.label}
                disabled={optionDisabled(option.key)}
                selected={delivery === option.key}
                onPress={() => changeDelivery(option.key)}
              />
            ))}
          </View>

          {ecpaySubTypes.some(isCvsSubType) ? (
            <Typography type="body-xs" color="muted" className="leading-5">
              {CVS_COD_RANGE_HINT}
            </Typography>
          ) : null}

          {ecpaySubTypes.length > 0 && !sellerReady ? (
            <Typography type="body-xs" className="text-brand-orange leading-5">
              {CVS_SELLER_INACTIVE_HINT}
            </Typography>
          ) : null}

          {cvsSubType ? (
            <>
              <Separator />
              <CvsStorePicker subType={cvsSubType} value={pickup} onChange={setPickup} />
              <Typography type="body-xs" color="muted">
                到店取貨時支付代收金額 {formatPrice(total)}（商品金額 +
                運費），賣家出貨後會收到寄貨編號。
              </Typography>
            </>
          ) : null}

          {isHomeCod ? (
            <>
              <Separator />
              <Typography type="body-xs" color="muted" className="leading-5">
                黑貓宅急便不需要選門市，請填寫下方的收件地址；司機到府時再付款，代收金額
                {formatPrice(total)}。
              </Typography>
            </>
          ) : null}
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            收件資訊
          </Typography>
          <View>
            <Label isRequired>收件人{isCvs ? '姓名（中文本名）' : '姓名'}</Label>
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
            <Label isRequired>{isEcpay ? '收件人手機' : '聯絡電話'}</Label>
            <Input
              placeholder="0912345678"
              keyboardType="phone-pad"
              inputMode={isEcpay ? 'numeric' : 'tel'}
              maxLength={isEcpay ? 10 : undefined}
              value={phone}
              isInvalid={showPhoneError}
              onChangeText={onChangePhone}
            />
            {showPhoneError ? <FormError message={phoneError} className="mt-1.5" /> : null}
          </View>

          {needsAddress ? (
            <>
              <View className="flex-row gap-3">
                <View className="w-28">
                  <Label isRequired={isHomeCod}>郵遞區號</Label>
                  <Input
                    placeholder="100"
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={5}
                    value={zipCode}
                    isInvalid={!!zipError && zipCode.length > 0}
                    onChangeText={(value) => setZipCode(value.replace(/\D/g, '').slice(0, 5))}
                  />
                </View>
                <View className="flex-1">
                  <Label isRequired>縣市地區</Label>
                  <Input placeholder="臺北市中正區" value={city} onChangeText={setCity} />
                </View>
              </View>
              <View>
                <Label isRequired>詳細地址</Label>
                <Input placeholder="路名、門牌與樓層" value={address} onChangeText={setAddress} />
              </View>
            </>
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
          {lines.map((item) => {
            const price = item.product?.price ?? 0;
            const lineDiscount = bulkOf(item);
            return (
              <View key={item.id} className="flex-row items-center gap-3">
                <AppImage uri={item.product?.cover_url} className="h-14 w-14 rounded-xl" />
                <View className="flex-1">
                  <Typography type="body-sm" numberOfLines={2} className="text-navy">
                    {item.product?.title}
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    {item.product?.store?.name} · x{item.quantity}
                  </Typography>
                  {lineDiscount > 0 ? (
                    <Typography type="body-xs" className="text-brand-orange">
                      數量折扣 -{formatPrice(lineDiscount)}
                    </Typography>
                  ) : null}
                </View>
                <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
                  {formatPrice(price * item.quantity - lineDiscount)}
                </Typography>
              </View>
            );
          })}
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
          {bulkDiscount > 0 ? (
            <View className="flex-row justify-between">
              <Typography type="body-sm" color="muted">
                數量折扣
              </Typography>
              <Typography type="body-sm" className="text-brand-orange">
                -{formatPrice(bulkDiscount)}
              </Typography>
            </View>
          ) : null}
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
            {cvsSubType
              ? `${COD_OPTION_LABEL[cvsSubType]}：到店取貨時支付 ${formatPrice(total)}。`
              : isHomeCod
                ? `黑貓宅急便貨到付款：司機送達時支付 ${formatPrice(total)}。`
                : '宅配貨到付款：由賣家自行寄送，收到包裹時付款。'}
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
