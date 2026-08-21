import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Checkbox, Chip, Separator, Spinner, Typography, useToast } from 'heroui-native';
import { router } from 'expo-router';
import { ShoppingCart, Store as StoreIcon, Trash2 } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { QuantityStepper } from '@/components/QuantityStepper';
import { SignInRequired } from '@/components/SignInRequired';
import {
  SHIPPING_FEE,
  useCart,
  useRemoveCartItem,
  useSetAllSelected,
  useUpdateCartItem,
} from '@/lib/api/commerce';
import { BRAND } from '@/lib/brand';
import { formatPrice } from '@/lib/format';
import { useUserId } from '@/lib/session';
import type { CartItem } from '@/lib/types';

type Group = { storeId: string; storeName: string; items: CartItem[] };

export default function CartScreen() {
  const userId = useUserId();
  const { toast } = useToast();
  const { data: items, isLoading } = useCart(userId);
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const setAllSelected = useSetAllSelected();

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const item of items ?? []) {
      if (!item.product) continue;
      const storeId = item.product.store_id;
      const existing = map.get(storeId);
      if (existing) existing.items.push(item);
      else
        map.set(storeId, {
          storeId,
          storeName: item.product.store?.name ?? '極貨網賣家',
          items: [item],
        });
    }
    return [...map.values()];
  }, [items]);

  const selectedItems = (items ?? []).filter((item) => item.selected && item.product);
  const subtotal = selectedItems.reduce(
    (sum, item) => sum + Number(item.product?.price ?? 0) * item.quantity,
    0,
  );
  const storeCount = new Set(selectedItems.map((item) => item.product?.store_id)).size;
  const shipping = storeCount * SHIPPING_FEE;
  const allSelected = (items ?? []).length > 0 && selectedItems.length === (items ?? []).length;

  if (!userId) {
    return <SignInRequired title="登入後查看購物車" description="登入即可保存購物車與訂單紀錄。" />;
  }

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if ((items ?? []).length === 0) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          icon={<ShoppingCart size={26} color={BRAND.blue} />}
          title="購物車還是空的"
          description="逛逛極貨網，萬物皆品，極致首選。"
          action={
            <Button onPress={() => router.push('/products')}>
              <Button.Label>開始探索</Button.Label>
            </Button>
          }
        />
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <ScrollView contentContainerClassName="p-4 gap-3 pb-6">
        {groups.map((group) => (
          <View key={group.storeId} className="bg-surface rounded-2xl p-3">
            <Pressable
              className="flex-row items-center gap-2 pb-2"
              onPress={() =>
                router.push({ pathname: '/store/[id]', params: { id: group.storeId } })
              }
            >
              <StoreIcon size={15} color={BRAND.navy} />
              <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
                {group.storeName}
              </Typography>
              <Typography type="body-xs" color="muted">
                （{group.items.length} 件）
              </Typography>
            </Pressable>
            <Separator />

            {group.items.map((item) => (
              <View key={item.id} className="flex-row items-start gap-3 pt-3">
                <View className="pt-6">
                  <Checkbox
                    isSelected={item.selected}
                    onSelectedChange={(selected) => updateItem.mutate({ id: item.id, selected })}
                  />
                </View>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/products/[id]', params: { id: item.product_id } })
                  }
                >
                  <AppImage uri={item.product?.cover_url} className="h-20 w-20 rounded-xl" />
                </Pressable>
                <View className="flex-1 gap-1">
                  <Typography type="body-sm" numberOfLines={2} className="text-navy">
                    {item.product?.title ?? '商品已下架'}
                  </Typography>
                  <View className="flex-row items-center gap-2">
                    <Chip size="sm" variant="tertiary">
                      {item.shipping_method}
                    </Chip>
                    <Typography type="body-xs" color="muted">
                      庫存 {item.product?.stock ?? 0}
                    </Typography>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Typography
                      type="body"
                      className="text-brand-orange"
                      style={{ fontWeight: '700' }}
                    >
                      {formatPrice(Number(item.product?.price ?? 0) * item.quantity)}
                    </Typography>
                    <View className="flex-row items-center gap-2">
                      <QuantityStepper
                        value={item.quantity}
                        max={Math.max(1, item.product?.stock ?? 1)}
                        onChange={(quantity) => updateItem.mutate({ id: item.id, quantity })}
                      />
                      <Pressable
                        className="h-8 w-8 items-center justify-center"
                        onPress={() => removeItem.mutate(item.id)}
                        accessibilityLabel="刪除商品"
                      >
                        <Trash2 size={16} color={BRAND.muted} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View className="border-border bg-surface pb-safe-offset-3 border-t px-4 py-3">
        <View className="flex-row items-center justify-between">
          <Pressable
            className="flex-row items-center gap-2"
            onPress={() => setAllSelected.mutate({ userId, selected: !allSelected })}
          >
            <Checkbox
              isSelected={allSelected}
              onSelectedChange={(selected) => setAllSelected.mutate({ userId, selected })}
            />
            <Typography type="body-sm" className="text-navy">
              全選
            </Typography>
          </Pressable>
          <View className="items-end">
            <Typography type="body-xs" color="muted">
              商品 {formatPrice(subtotal)} + 運費 {formatPrice(shipping)}
            </Typography>
            <Typography type="h5" className="text-brand-orange" style={{ fontWeight: '700' }}>
              {formatPrice(subtotal + shipping)}
            </Typography>
          </View>
        </View>
        <Button
          className="mt-3"
          isDisabled={selectedItems.length === 0}
          onPress={() => {
            if (selectedItems.length === 0) {
              toast.show({ variant: 'warning', label: '請先勾選要結帳的商品' });
              return;
            }
            router.push('/checkout');
          }}
        >
          <Button.Label>結帳（{selectedItems.length} 件）</Button.Label>
        </Button>
      </View>
    </View>
  );
}
