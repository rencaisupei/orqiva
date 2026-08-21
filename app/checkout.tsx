import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import {
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  Separator,
  Spinner,
  Typography,
  useToast,
} from 'heroui-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AppImage } from '@/components/AppImage';
import { CvsStorePicker } from '@/components/CvsStorePicker';
import { EmptyState } from '@/components/EmptyState';
import { SignInRequired } from '@/components/SignInRequired';
import {
  SHIPPING_FEE,
  useCart,
  usePlaceOrder,
  type CheckoutLine,
  type CvsPickup,
} from '@/lib/api/commerce';
import { useLogisticsConfig } from '@/lib/api/logistics';
import { formatPrice } from '@/lib/format';
import { useSessionStore, useUserId } from '@/lib/session';

type DeliveryMode = 'home' | 'cvs';

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
  const [error, setError] = useState<string | null>(null);

  const cvsAvailable = !!logistics?.is_enabled && (logistics?.enabled_sub_types.length ?? 0) > 0;

  const lines = useMemo(() => {
    const source = (cartItems ?? []).filter((item) => item.product);
    if (productId) return source.filter((item) => item.product_id === productId);
    return source.filter((item) => item.selected);
  }, [cartItems, productId]);

  const subtotal = lines.reduce((sum, item) => sum + (item.product?.price ?? 0) * item.quantity, 0);
  const storeCount = new Set(lines.map((item) => item.product?.store_id)).size;
  const shipping = storeCount * SHIPPING_FEE;
  const total = subtotal + shipping;

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

  const submit = () => {
    if (!name.trim() || !phone.trim()) {
      setError('請完整填寫收件人與電話');
      return;
    }
    if (mode === 'home' && !address.trim()) {
      setError('請填寫收件地址');
      return;
    }
    if (mode === 'cvs' && !pickup) {
      setError('請先選擇超商取貨門市');
      return;
    }
    if (mode === 'cvs' && !/^09\d{8}$/.test(phone.trim())) {
      setError('超商取貨的收件人手機需為 09 開頭的 10 碼數字');
      return;
    }
    if (mode === 'cvs' && (total < 1 || total > 20000)) {
      setError('綠界超商取貨付款金額限制為 1 ~ 20,000 元，請調整購物車');
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
        {cvsAvailable ? (
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
                <Pressable
                  key={option.key}
                  onPress={() => {
                    setMode(option.key);
                    setError(null);
                  }}
                >
                  <Chip size="sm" variant={mode === option.key ? 'primary' : 'tertiary'}>
                    {option.label}
                  </Chip>
                </Pressable>
              ))}
            </View>

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
            <Label>收件人</Label>
            <Input placeholder="姓名" value={name} onChangeText={setName} />
          </View>
          <View>
            <Label>聯絡電話</Label>
            <Input
              placeholder="09xxxxxxxx"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
          {mode === 'home' ? (
            <View>
              <Label>收件地址</Label>
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
              ? '超商取貨付款：到店取貨時付款，賣家出貨後會收到寄貨編號。'
              : '宅配目前為貨到付款流程，線上金流將在下一階段開放。'}
          </Typography>
        </View>

        {error ? <FieldError>{error}</FieldError> : null}
      </ScrollView>

      <View className="border-border bg-surface pb-safe-offset-3 border-t px-4 py-3">
        <Button isDisabled={placeOrder.isPending} onPress={submit}>
          <Button.Label>
            {placeOrder.isPending ? '建立訂單中…' : `送出訂單 ${formatPrice(total)}`}
          </Button.Label>
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
