import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Avatar, Button, Chip, Separator, Spinner, Typography, useToast } from 'heroui-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Flag, Heart, MapPin, MessageCircle, ShieldCheck, Truck } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { QuantityStepper } from '@/components/QuantityStepper';
import { StarRating } from '@/components/StarRating';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useCreateReport } from '@/lib/api/admin';
import { useProduct, useProductReviews, useTrackProductView } from '@/lib/api/catalog';
import { useAddToCart } from '@/lib/api/commerce';
import { useStartConversation } from '@/lib/api/social';
import { BRAND } from '@/lib/brand';
import {
  deliveryEstimate,
  discountPercent,
  formatCompact,
  formatDate,
  formatPrice,
} from '@/lib/format';
import { useUserId } from '@/lib/session';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const userId = useUserId();
  const { toast } = useToast();

  const { data: product, isLoading } = useProduct(id);
  const { data: reviews } = useProductReviews(id);
  const { isFavorite, onToggleFavorite } = useFavoriteToggle();
  const addToCart = useAddToCart();
  const startConversation = useStartConversation();
  const createReport = useCreateReport();
  const trackView = useTrackProductView();

  const [quantity, setQuantity] = useState(1);
  const [shippingMethod, setShippingMethod] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  const trackViewMutate = trackView.mutate;
  useEffect(() => {
    if (id) trackViewMutate(id);
  }, [id, trackViewMutate]);

  const images = useMemo(() => {
    if (!product) return [];
    const sorted = [...(product.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const urls = sorted.map((img) => img.url);
    return urls.length > 0 ? urls : product.cover_url ? [product.cover_url] : [];
  }, [product]);

  const selectedShipping = shippingMethod ?? product?.shipping_methods[0] ?? '宅配';

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (!product) {
    return (
      <View className="bg-background flex-1">
        <EmptyState title="找不到這件商品" description="商品可能已下架或連結有誤。" />
      </View>
    );
  }

  const discount = discountPercent(product.price, product.original_price);
  const outOfStock = product.stock <= 0;
  const specEntries = Object.entries(product.specs ?? {});

  const requireSignIn = () => {
    if (userId) return true;
    router.push('/auth/sign-in');
    return false;
  };

  const onAddToCart = () => {
    if (!requireSignIn() || !userId) return;
    addToCart.mutate(
      { userId, productId: product.id, quantity, shippingMethod: selectedShipping },
      {
        onSuccess: () => toast.show({ variant: 'success', label: '已加入購物車' }),
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  const onBuyNow = () => {
    if (!requireSignIn() || !userId) return;
    addToCart.mutate(
      { userId, productId: product.id, quantity, shippingMethod: selectedShipping },
      {
        onSuccess: () =>
          router.push({
            pathname: '/checkout',
            params: {
              productId: product.id,
              quantity: String(quantity),
              shipping: selectedShipping,
            },
          }),
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  const onContactSeller = () => {
    if (!requireSignIn() || !userId) return;
    startConversation.mutate(
      {
        buyerId: userId,
        storeId: product.store_id,
        sellerId: product.seller_id,
        productId: product.id,
      },
      {
        onSuccess: (conversationId) =>
          router.push({ pathname: '/messages/[id]', params: { id: conversationId } }),
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  const onReport = () => {
    if (!requireSignIn() || !userId) return;
    createReport.mutate(
      {
        reporterId: userId,
        targetType: 'product',
        targetId: product.id,
        reason: '買家回報此商品內容有問題',
      },
      {
        onSuccess: () => toast.show({ variant: 'success', label: '已送出檢舉，平台會盡快處理' }),
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  return (
    <View className="bg-background flex-1">
      <ScrollView contentContainerClassName="pb-6" showsVerticalScrollIndicator={false}>
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              setImageIndex(Math.round(event.nativeEvent.contentOffset.x / width));
            }}
          >
            {images.length > 0 ? (
              images.map((url) => (
                <AppImage key={url} uri={url} className="aspect-square" style={{ width }} />
              ))
            ) : (
              <AppImage className="aspect-square" style={{ width }} />
            )}
          </ScrollView>
          {images.length > 1 ? (
            <View className="absolute bottom-3 w-full flex-row justify-center gap-1.5">
              {images.map((url, index) => (
                <View
                  key={url}
                  className="h-1.5 rounded-full"
                  style={{
                    width: index === imageIndex ? 16 : 6,
                    backgroundColor: index === imageIndex ? BRAND.orange : 'rgba(255,255,255,0.7)',
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View className="bg-surface gap-2 p-4">
          <View className="flex-row items-end gap-2">
            <Typography type="h3" className="text-brand-orange" style={{ fontWeight: '700' }}>
              {formatPrice(product.price)}
            </Typography>
            {product.original_price ? (
              <Typography type="body-sm" color="muted" className="line-through">
                {formatPrice(product.original_price)}
              </Typography>
            ) : null}
            {discount ? (
              <Chip size="sm" variant="soft" color="warning">
                省 {discount}%
              </Chip>
            ) : null}
          </View>

          <Typography type="h5" className="text-navy leading-7">
            {product.title}
          </Typography>

          <View className="flex-row items-center gap-3">
            <StarRating rating={product.rating} count={product.rating_count} />
            <Typography type="body-xs" color="muted">
              已售 {formatCompact(product.sold_count)}
            </Typography>
            <Typography type="body-xs" color="muted">
              瀏覽 {formatCompact(product.view_count)}
            </Typography>
          </View>

          <View className="flex-row items-center gap-2">
            <MapPin size={12} color={BRAND.muted} />
            <Typography type="body-xs" color="muted">
              {product.location}
            </Typography>
            <Chip size="sm" variant="tertiary">
              {product.condition === 'new' ? '全新' : '二手'}
            </Chip>
            <Typography type="body-xs" className={outOfStock ? 'text-danger' : 'text-navy'}>
              {outOfStock ? '已售完' : `庫存 ${product.stock} 件`}
            </Typography>
          </View>
        </View>

        <View className="bg-surface mt-3 gap-3 p-4">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            配送方式
          </Typography>
          <View className="flex-row flex-wrap gap-2">
            {product.shipping_methods.map((method) => (
              <Pressable key={method} onPress={() => setShippingMethod(method)}>
                <Chip size="sm" variant={selectedShipping === method ? 'primary' : 'tertiary'}>
                  {method}
                </Chip>
              </Pressable>
            ))}
          </View>
          <View className="flex-row items-center gap-2">
            <Truck size={14} color={BRAND.blue} />
            <Typography type="body-sm" color="muted">
              預計配送：{deliveryEstimate(selectedShipping)}
            </Typography>
          </View>
          <View className="flex-row items-center justify-between">
            <Typography type="body-sm" className="text-navy">
              購買數量
            </Typography>
            <QuantityStepper
              value={quantity}
              max={Math.max(1, product.stock)}
              onChange={setQuantity}
            />
          </View>
        </View>

        <Pressable
          className="bg-surface mt-3 flex-row items-center gap-3 p-4"
          onPress={() => router.push({ pathname: '/store/[id]', params: { id: product.store_id } })}
        >
          <Avatar size="md" alt={product.store?.name ?? '賣家'}>
            {product.store?.logo_url ? (
              <Avatar.Image source={{ uri: product.store.logo_url }} />
            ) : null}
            <Avatar.Fallback />
          </Avatar>
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                {product.store?.name ?? '極貨網賣家'}
              </Typography>
              <ShieldCheck size={14} color={BRAND.blue} />
            </View>
            <View className="flex-row items-center gap-2">
              <StarRating
                rating={product.store?.rating ?? 0}
                count={product.store?.rating_count ?? 0}
              />
              <Typography type="body-xs" color="muted">
                {product.store?.location ?? ''}
              </Typography>
            </View>
          </View>
          <Button variant="secondary" size="sm">
            <Button.Label>進入店舖</Button.Label>
          </Button>
        </Pressable>

        <View className="bg-surface mt-3 gap-2 p-4">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            商品描述
          </Typography>
          <Typography type="body-sm" color="muted" className="leading-6">
            {product.description || '賣家尚未填寫商品描述。'}
          </Typography>
        </View>

        {specEntries.length > 0 ? (
          <View className="bg-surface mt-3 gap-2 p-4">
            <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
              商品規格
            </Typography>
            <View className="gap-2">
              {specEntries.map(([key, value]) => (
                <View key={key} className="flex-row justify-between gap-4">
                  <Typography
                    type="body-sm"
                    color="muted"
                    numberOfLines={1}
                    className="max-w-[45%]"
                  >
                    {key}
                  </Typography>
                  <Typography type="body-sm" className="text-navy flex-1 text-right">
                    {value}
                  </Typography>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View className="bg-surface mt-3 gap-3 p-4">
          <View className="flex-row items-center justify-between">
            <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
              商品評價
            </Typography>
            <StarRating rating={product.rating} count={product.rating_count} />
          </View>
          {(reviews ?? []).length === 0 ? (
            <Typography type="body-sm" color="muted">
              目前還沒有買家評價，完成訂單後即可留下評價。
            </Typography>
          ) : (
            (reviews ?? []).map((review) => (
              <View key={review.id} className="gap-1">
                <Separator />
                <View className="flex-row items-center justify-between pt-2">
                  <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
                    {review.profile?.display_name ?? '買家'}
                  </Typography>
                  <StarRating rating={review.rating} showCount={false} />
                </View>
                <Typography type="body-sm" color="muted">
                  {review.comment || '（未填寫評語）'}
                </Typography>
                <Typography type="body-xs" color="muted">
                  {formatDate(review.created_at)}
                </Typography>
              </View>
            ))
          )}
        </View>

        <Pressable
          className="mt-3 flex-row items-center justify-center gap-2 p-4"
          onPress={onReport}
        >
          <Flag size={14} color={BRAND.muted} />
          <Typography type="body-xs" color="muted">
            回報這件商品
          </Typography>
        </Pressable>
      </ScrollView>

      <View className="border-border bg-surface pb-safe-offset-2 flex-row items-center gap-2 border-t px-3 py-2.5">
        <Pressable
          className="h-11 w-11 items-center justify-center"
          onPress={() => onToggleFavorite(product.id)}
          accessibilityLabel="收藏"
        >
          <Heart
            size={22}
            color={isFavorite(product.id) ? BRAND.orange : BRAND.muted}
            fill={isFavorite(product.id) ? BRAND.orange : 'transparent'}
          />
        </Pressable>
        <Pressable
          className="h-11 w-11 items-center justify-center"
          onPress={onContactSeller}
          accessibilityLabel="聯絡賣家"
        >
          <MessageCircle size={22} color={BRAND.navy} />
        </Pressable>
        <Button
          variant="secondary"
          className="flex-1"
          isDisabled={outOfStock || addToCart.isPending}
          onPress={onAddToCart}
        >
          <Button.Label>加入購物車</Button.Label>
        </Button>
        <Button className="flex-1" isDisabled={outOfStock} onPress={onBuyNow}>
          <Button.Label>{outOfStock ? '已售完' : '立即購買'}</Button.Label>
        </Button>
      </View>
    </View>
  );
}
