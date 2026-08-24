import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Checkbox, Chip, Separator, Spinner, Typography } from 'heroui-native';
import { useBrandToast } from '@/components/brand/BrandToast';
import { router } from 'expo-router';
import { ShoppingCart, Store as StoreIcon, Trash2 } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { QuantityStepper } from '@/components/QuantityStepper';
import { RecommendationRail } from '@/components/RecommendationRail';
import { SignInRequired } from '@/components/SignInRequired';
import { useBulkTiers } from '@/lib/api/bulk';
import {
  SHIPPING_FEE,
  useCart,
  useRemoveCartItem,
  useSetAllSelected,
  useUpdateCartItem,
} from '@/lib/api/commerce';
import { protectBrand } from '@/components/brand/BrandText';
import { BRAND } from '@/lib/brand';
import { formatNumber, formatPrice } from '@/lib/format';
import { useRecentlyViewedStore } from '@/lib/recentlyViewed';
import { useUserId } from '@/lib/session';
import { activeBulkTier, bulkDiscountFor, nextBulkTier, type CartItem } from '@/lib/types';

type Group = { storeId: string; storeName: string; items: CartItem[] };

/** 購物車標題列：分頁沒有系統導覽列，所以標題與件數自己畫。 */
function CartHeader({ subtitle }: { subtitle: string }) {
  return (
    <View className="bg-surface pt-safe px-4 pb-3">
      <View className="pt-2">
        <Typography type="h4" className="text-navy" style={{ fontWeight: '700' }}>
          購物車
        </Typography>
        <Typography type="body-sm" color="muted">
          {subtitle}
        </Typography>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const userId = useUserId();
  const { toast } = useBrandToast();
  const { data: items, isLoading } = useCart(userId);
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const setAllSelected = useSetAllSelected();
  const recentlyViewed = useRecentlyViewedStore((s) => s.ids);
  const { data: tierMap } = useBulkTiers((items ?? []).map((item) => item.product_id));

  /* 推薦的種子：購物車裡的商品最能代表現在想買什麼，空車時退回最近瀏覽。 */
  const cartSeeds = useMemo(
    () => (items ?? []).map((item) => item.product_id).slice(0, 8),
    [items],
  );

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
    (sum, item) => sum + (item.product?.price ?? 0) * item.quantity,
    0,
  );
  /* 數量折扣：規則與 market edge function 同一份（lib/types.ts 的 bulkDiscountFor）。 */
  const bulkDiscount = selectedItems.reduce(
    (sum, item) =>
      sum +
      bulkDiscountFor(item.product?.price ?? 0, item.quantity, tierMap?.get(item.product_id) ?? []),
    0,
  );
  const storeCount = new Set(selectedItems.map((item) => item.product?.store_id)).size;
  const shipping = storeCount * SHIPPING_FEE;
  const allSelected = (items ?? []).length > 0 && selectedItems.length === (items ?? []).length;

  if (!userId) {
    return (
      <View className="bg-background flex-1">
        <CartHeader subtitle="登入後就能保留購物車" />
        <SignInRequired title="登入後查看購物車" description="登入即可保留購物車與訂單紀錄。" />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="bg-background flex-1">
        <CartHeader subtitle="正在讀取購物車…" />
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </View>
    );
  }

  if ((items ?? []).length === 0) {
    return (
      <View className="bg-background flex-1">
        <CartHeader subtitle="挑好商品就能一起結帳" />
        <ScrollView contentContainerClassName="pb-8">
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
          <RecommendationRail title="智慧推薦" seedIds={recentlyViewed} limit={10} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <CartHeader
        subtitle={`${formatNumber((items ?? []).length)} 件商品 · 已勾選 ${formatNumber(selectedItems.length)} 件`}
      />

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
                {protectBrand(group.storeName)}
              </Typography>
              <Typography type="body-xs" color="muted">
                （{group.items.length} 件）
              </Typography>
            </Pressable>
            <Separator />

            {group.items.map((item) => {
              const price = item.product?.price ?? 0;
              const tiers = tierMap?.get(item.product_id) ?? [];
              const itemDiscount = bulkDiscountFor(price, item.quantity, tiers);
              const tier = activeBulkTier(tiers, item.quantity);
              const upcoming = nextBulkTier(tiers, item.quantity);
              return (
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
                    {/* 數量折扣：達標就直接折在這一列的金額上，沒達標就提示還差幾件。 */}
                    {tier ? (
                      <Typography type="body-xs" className="text-brand-orange">
                        滿 {tier.min_quantity} 件折 {tier.percent}%，已省{' '}
                        {formatPrice(itemDiscount)}
                      </Typography>
                    ) : upcoming ? (
                      <Typography type="body-xs" color="muted">
                        再買 {upcoming.min_quantity - item.quantity} 件可折 {upcoming.percent}%
                      </Typography>
                    ) : null}
                    <View className="flex-row items-center justify-between">
                      <View>
                        {itemDiscount > 0 ? (
                          <Typography type="body-xs" color="muted" className="line-through">
                            {formatPrice(price * item.quantity)}
                          </Typography>
                        ) : null}
                        <Typography
                          type="body"
                          className="text-brand-orange"
                          style={{ fontWeight: '700' }}
                        >
                          {formatPrice(price * item.quantity - itemDiscount)}
                        </Typography>
                      </View>
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
              );
            })}
          </View>
        ))}

        {/* 湊單用的推薦：種子是購物車內容，所以會跟著購物車變。
            -mx-4 抵銷外層的 p-4，橫向列表才與上面的卡片同一條左邊界。 */}
        <View className="-mx-4">
          <RecommendationRail title="智慧推薦" seedIds={cartSeeds} limit={10} />
        </View>
      </ScrollView>

      {/* 分頁列已經吃掉底部安全區，這裡只需要一般內距。 */}
      <View className="border-border bg-surface border-t px-4 py-3">
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
            {bulkDiscount > 0 ? (
              <Typography type="body-xs" className="text-brand-orange">
                數量折扣 -{formatPrice(bulkDiscount)}
              </Typography>
            ) : null}
            <Typography type="body-xs" color="muted">
              商品 {formatPrice(subtotal - bulkDiscount)} + 運費 {formatPrice(shipping)}
            </Typography>
            <Typography type="h5" className="text-brand-orange" style={{ fontWeight: '700' }}>
              {formatPrice(subtotal - bulkDiscount + shipping)}
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
