import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import {
  Button,
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
import { EmptyState } from '@/components/EmptyState';
import { SignInRequired } from '@/components/SignInRequired';
import { SHIPPING_FEE, useCart, usePlaceOrder, type CheckoutLine } from '@/lib/api/commerce';
import { formatPrice } from '@/lib/format';
import { useSessionStore, useUserId } from '@/lib/session';

export default function CheckoutScreen() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const userId = useUserId();
  const profile = useSessionStore((s) => s.profile);
  const account = useSessionStore((s) => s.account);
  const { toast } = useToast();

  const { data: cartItems, isLoading } = useCart(userId);
  const placeOrder = usePlaceOrder();

  const [name, setName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(account?.phone ?? '');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(() => {
    const source = (cartItems ?? []).filter((item) => item.product);
    if (productId) return source.filter((item) => item.product_id === productId);
    return source.filter((item) => item.selected);
  }, [cartItems, productId]);

  const subtotal = lines.reduce(
    (sum, item) => sum + Number(item.product?.price ?? 0) * item.quantity,
    0,
  );
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
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError('請完整填寫收件人、電話與地址');
      return;
    }
    setError(null);

    const payload: CheckoutLine[] = lines.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      shipping_method: item.shipping_method,
    }));

    placeOrder.mutate(
      {
        items: payload,
        recipientName: name.trim(),
        recipientPhone: phone.trim(),
        shippingAddress: address.trim(),
        note: note.trim(),
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
          <View>
            <Label>收件地址</Label>
            <Input placeholder="縣市 / 區 / 路名門牌" value={address} onChangeText={setAddress} />
          </View>
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
                {formatPrice(Number(item.product?.price ?? 0) * item.quantity)}
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
            第一階段為貨到付款流程，線上金流將在下一階段開放。
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
