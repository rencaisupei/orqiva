import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Button, Chip, Spinner, Typography, useToast } from 'heroui-native';
import { router } from 'expo-router';
import { PackagePlus, Pencil, ShieldAlert, Trash2 } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { SelectPill } from '@/components/SelectPill';
import { SellerTabBar } from '@/components/SellerTabBar';
import { SignInRequired } from '@/components/SignInRequired';
import { useModerateProduct } from '@/lib/api/moderation';
import { useDeleteProduct, useSellerProducts, useUpdateProduct } from '@/lib/api/seller';
import { BRAND } from '@/lib/brand';
import { formatPrice } from '@/lib/format';
import { useUserId } from '@/lib/session';
import { isLowStock, MODERATION_STATUS_LABEL } from '@/lib/types';

export default function SellerProductsScreen() {
  const userId = useUserId();
  const { toast } = useToast();
  const { data: products, isLoading } = useSellerProducts(userId);
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const moderate = useModerateProduct();
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const list = products ?? [];
  const lowStockCount = list.filter(isLowStock).length;
  const visible = lowStockOnly ? list.filter(isLowStock) : list;

  if (!userId) {
    return <SignInRequired title="登入後管理商品" />;
  }

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      {lowStockCount > 0 ? (
        <View className="bg-surface flex-row flex-wrap items-center gap-2 px-4 py-3">
          <Typography type="body-sm" className="text-brand-orange flex-1">
            {lowStockCount} 件商品庫存低於提醒門檻
          </Typography>
          <SelectPill
            size="sm"
            tone="soft"
            label="全部"
            selected={!lowStockOnly}
            onPress={() => setLowStockOnly(false)}
          />
          <SelectPill
            size="sm"
            tone="soft"
            label={`低庫存 ${lowStockCount}`}
            selected={lowStockOnly}
            onPress={() => setLowStockOnly(true)}
          />
        </View>
      ) : null}

      <FlatList
        className="flex-1"
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-4 gap-3 pb-6"
        ListEmptyComponent={
          <EmptyState
            icon={<PackagePlus size={26} color={BRAND.blue} />}
            title="還沒有商品"
            description="上架第一件商品，讓買家找到你。"
            action={
              <Button onPress={() => router.push('/seller/new-product')}>
                <Button.Label>新增商品</Button.Label>
              </Button>
            }
          />
        }
        renderItem={({ item }) => (
          <View className="bg-surface gap-3 rounded-2xl p-3">
            <Pressable
              className="flex-row items-center gap-3"
              onPress={() => router.push({ pathname: '/products/[id]', params: { id: item.id } })}
            >
              <AppImage uri={item.cover_url} className="h-16 w-16 rounded-xl" />
              <View className="flex-1 gap-1">
                <Typography type="body-sm" numberOfLines={2} className="text-navy">
                  {item.title}
                </Typography>
                <View className="flex-row items-center gap-2">
                  <Typography
                    type="body-sm"
                    className="text-brand-orange"
                    style={{ fontWeight: '700' }}
                  >
                    {formatPrice(item.price)}
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    庫存 {item.stock} · 已售 {item.sold_count}
                  </Typography>
                </View>
                <View className="flex-row flex-wrap items-center gap-1.5">
                  {isLowStock(item) ? (
                    <Chip disabled size="sm" variant="soft" color="warning">
                      {item.stock <= 0 ? '已售完' : `低庫存 ≤ ${item.low_stock_threshold}`}
                    </Chip>
                  ) : null}
                  <Chip
                    disabled
                    size="sm"
                    variant="soft"
                    color={
                      item.status === 'active'
                        ? 'success'
                        : item.status === 'suspended'
                          ? 'danger'
                          : 'default'
                    }
                  >
                    {item.status === 'active'
                      ? '上架中'
                      : item.status === 'draft'
                        ? '未上架'
                        : '已停用'}
                  </Chip>
                  {item.moderation_status !== 'approved' ? (
                    <Chip
                      disabled
                      size="sm"
                      variant="soft"
                      color={item.moderation_status === 'rejected' ? 'danger' : 'warning'}
                    >
                      {MODERATION_STATUS_LABEL[item.moderation_status]}
                    </Chip>
                  ) : null}
                </View>
              </View>
            </Pressable>

            {item.moderation_status !== 'approved' ? (
              <View className="bg-background gap-2 rounded-xl p-3">
                <View className="flex-row items-start gap-2">
                  <ShieldAlert size={15} color={BRAND.orange} />
                  <Typography type="body-xs" color="muted" className="flex-1">
                    {item.moderation_summary ?? 'AI 正在審核這件商品，通過後買家才會看到。'}
                  </Typography>
                </View>
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={moderate.isPending}
                  onPress={() =>
                    moderate.mutate(item.id, {
                      onSuccess: (result) =>
                        toast.show({
                          variant: result.verdict === 'approved' ? 'success' : 'warning',
                          label:
                            result.verdict === 'approved'
                              ? '審核通過，商品已公開'
                              : result.summary || '仍未通過，請調整內容',
                        }),
                      onError: (error: Error) =>
                        toast.show({ variant: 'danger', label: error.message }),
                    })
                  }
                >
                  <Button.Label>{moderate.isPending ? '送審中…' : '重新送審'}</Button.Label>
                </Button>
              </View>
            ) : null}

            <View className="flex-row gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onPress={() =>
                  router.push({ pathname: '/seller/edit/[id]', params: { id: item.id } })
                }
              >
                <View className="flex-row items-center gap-1.5">
                  <Pencil size={13} color={BRAND.navy} />
                  <Typography type="body-sm" className="text-navy">
                    編輯
                  </Typography>
                </View>
              </Button>
              {item.status !== 'suspended' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onPress={() =>
                    updateProduct.mutate(
                      {
                        productId: item.id,
                        patch: { status: item.status === 'active' ? 'draft' : 'active' },
                      },
                      {
                        onSuccess: () =>
                          toast.show({
                            variant: 'success',
                            label: item.status === 'active' ? '商品已下架' : '商品已上架',
                          }),
                      },
                    )
                  }
                >
                  <Button.Label>{item.status === 'active' ? '下架' : '上架'}</Button.Label>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="danger-soft"
                onPress={() =>
                  deleteProduct.mutate(item.id, {
                    onSuccess: () => toast.show({ variant: 'success', label: '商品已刪除' }),
                    onError: (error: Error) =>
                      toast.show({ variant: 'danger', label: error.message }),
                  })
                }
              >
                <Trash2 size={14} color={BRAND.navy} />
              </Button>
            </View>
          </View>
        )}
      />

      <View className="bg-surface w-full">
        <View className="border-border border-t px-4 py-3">
          <Button onPress={() => router.push('/seller/new-product')}>
            <Button.Label>新增商品</Button.Label>
          </Button>
        </View>
        <SellerTabBar />
      </View>
    </View>
  );
}
