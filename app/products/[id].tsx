import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar, Button, Chip, Spinner, Typography } from 'heroui-native';
import { useBrandToast } from '@/components/brand/BrandToast';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  Share2,
  ShieldCheck,
  Truck,
} from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { BulkTierInfo } from '@/components/BulkTierInfo';
import { EmptyState } from '@/components/EmptyState';
import { ProductReviews } from '@/components/ProductReviews';
import { QuantityStepper } from '@/components/QuantityStepper';
import { RecommendationRail } from '@/components/RecommendationRail';
import { SelectPill } from '@/components/SelectPill';
import { StarRating } from '@/components/StarRating';
import { StoreCoupons } from '@/components/StoreCoupons';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useCreateReport } from '@/lib/api/admin';
import { useProduct, useTrackProductView } from '@/lib/api/catalog';
import { useAddToCart } from '@/lib/api/commerce';
import { useSellerLogisticsStatuses } from '@/lib/api/logistics';
import { useStartConversation } from '@/lib/api/social';
import { protectBrand } from '@/components/brand/BrandText';
import { BRAND } from '@/lib/brand';
import { deliveryEstimate, discountPercent, formatCompact, formatPrice } from '@/lib/format';
import { useMediaWidth } from '@/lib/layout';
import { useRecentlyViewedStore } from '@/lib/recentlyViewed';
import { useUserId } from '@/lib/session';
import { shareProduct } from '@/lib/share';
import { CVS_SELLER_INACTIVE_HINT, CVS_SHIPPING_METHOD } from '@/lib/types';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const width = useMediaWidth();
  const userId = useUserId();
  const { toast } = useBrandToast();

  const { data: product, isLoading } = useProduct(id);
  const { isFavorite, onToggleFavorite } = useFavoriteToggle();
  const addToCart = useAddToCart();
  const startConversation = useStartConversation();
  const createReport = useCreateReport();
  const trackView = useTrackProductView();

  const [quantity, setQuantity] = useState(1);
  const [shippingMethod, setShippingMethod] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  const trackViewMutate = trackView.mutate;
  const trackRecentlyViewed = useRecentlyViewedStore((s) => s.track);
  useEffect(() => {
    if (!id) return;
    trackViewMutate(id);
    trackRecentlyViewed(id);
  }, [id, trackViewMutate, trackRecentlyViewed]);

  // 賣家的超商取貨付款是否已開通（公開鏡像表，不含賣家個資）。
  const { data: sellerStatuses } = useSellerLogisticsStatuses([product?.seller_id]);

  const images = useMemo(() => {
    if (!product) return [];
    const sorted = [...(product.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const urls = sorted.map((img) => img.url);
    return urls.length > 0 ? urls : product.cover_url ? [product.cover_url] : [];
  }, [product]);

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

  /*
   * 超商取貨付款需要賣家自己在綠界完成開通；未開通就不能被選，
   * 否則買家會一路填到結帳才被伺服器擋下。選項留著但灰掉並說明原因。
   */
  const cvsActive =
    !!product.seller_id && sellerStatuses?.[product.seller_id]?.is_logistics_active === true;
  const cvsOffered = product.shipping_methods.includes(CVS_SHIPPING_METHOD);
  const cvsBlocked = cvsOffered && !cvsActive;
  const usableMethods = product.shipping_methods.filter(
    (method) => method !== CVS_SHIPPING_METHOD || cvsActive,
  );
  const noShippingOption = usableMethods.length === 0;
  const selectedShipping =
    shippingMethod && usableMethods.includes(shippingMethod)
      ? shippingMethod
      : (usableMethods[0] ?? product.shipping_methods[0] ?? '宅配');

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

  /** OS share sheet, falling back to copying the link on desktop browsers. */
  const onShare = () => {
    void (async () => {
      const outcome = await shareProduct({
        id: product.id,
        title: product.title,
        price: product.price,
      });
      if (outcome === 'copied') {
        toast.show({ variant: 'success', label: '商品連結已複製，貼上就能分享' });
      } else if (outcome === 'failed') {
        toast.show({ variant: 'danger', label: '分享失敗，請稍後再試' });
      }
    })();
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
        {/* 網頁版視窗很寬時主圖置中限寬（見 useMediaWidth），不然正方形主圖會佔滿整個螢幕。 */}
        <View className="items-center">
          <View style={{ width }}>
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
                      backgroundColor:
                        index === imageIndex ? BRAND.orange : 'rgba(255,255,255,0.7)',
                    }}
                  />
                ))}
              </View>
            ) : null}
          </View>
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
            <View className="flex-1" />
            <Pressable
              className="border-border flex-row items-center gap-1 rounded-full border px-3 py-1.5"
              hitSlop={6}
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel="分享商品"
            >
              <Share2 size={14} color={BRAND.navy} />
              <Typography type="body-xs" className="text-navy" style={{ fontWeight: '600' }}>
                分享
              </Typography>
            </Pressable>
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

        <BulkTierInfo productId={product.id} price={product.price} />

        <StoreCoupons storeId={product.store_id} productId={product.id} />

        <View className="bg-surface mt-3 gap-3 p-4">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            配送方式
          </Typography>
          <View className="flex-row flex-wrap gap-2">
            {product.shipping_methods.map((method) => (
              <SelectPill
                key={method}
                size="sm"
                label={method}
                disabled={method === CVS_SHIPPING_METHOD && !cvsActive}
                selected={selectedShipping === method}
                onPress={() => setShippingMethod(method)}
              />
            ))}
          </View>
          {cvsBlocked ? (
            <Typography type="body-xs" className="text-brand-orange leading-5">
              {noShippingOption
                ? '此商品只提供超商取貨，但賣家的取貨付款尚在綠界審核中，暫時無法下單。'
                : CVS_SELLER_INACTIVE_HINT}
            </Typography>
          ) : null}
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

        <View className="bg-surface mt-3 flex-row items-center gap-3 p-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看 ${product.store?.name ?? '賣家'} 的店舖`}
            className="flex-1 flex-row items-center gap-3"
            onPress={() =>
              router.push({ pathname: '/store/[id]', params: { id: product.store_id } })
            }
          >
            <Avatar size="md" alt={product.store?.name ?? '賣家'}>
              {product.store?.logo_url ? (
                <Avatar.Image source={{ uri: product.store.logo_url }} />
              ) : null}
              <Avatar.Fallback />
            </Avatar>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Typography
                  type="body"
                  numberOfLines={1}
                  className="text-navy flex-1"
                  style={{ fontWeight: '600' }}
                >
                  {protectBrand(product.store?.name ?? '極貨網賣家')}
                </Typography>
                <ShieldCheck size={14} color={BRAND.blue} />
              </View>
              <View className="flex-row items-center gap-2">
                <StarRating
                  rating={product.store?.rating ?? 0}
                  count={product.store?.rating_count ?? 0}
                />
                <Typography type="body-xs" color="muted" numberOfLines={1}>
                  {product.store?.location ?? ''}
                </Typography>
              </View>
            </View>
          </Pressable>
          {/* 按鈕自己帶 onPress：HeroUI Button 是 Pressable，包在外層 Pressable 裡會吞掉點擊。 */}
          <Button
            variant="secondary"
            size="sm"
            onPress={() =>
              router.push({ pathname: '/store/[id]', params: { id: product.store_id } })
            }
          >
            <Button.Label>進入店舖</Button.Label>
          </Button>
        </View>

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

        {/* 評價區塊（平均分、星等分佈、實拍照片）抽成共用元件。 */}
        <ProductReviews
          productId={product.id}
          rating={product.rating}
          ratingCount={product.rating_count}
        />

        {/* AI 推薦：同分類與可搭配的商品，由伺服器排序並快取。 */}
        <RecommendationRail title="智慧推薦" productId={product.id} limit={10} />

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
          className="h-10 w-10 items-center justify-center"
          onPress={() => onToggleFavorite(product.id)}
          accessibilityLabel="收藏"
        >
          <Heart
            size={20}
            color={isFavorite(product.id) ? BRAND.orange : BRAND.muted}
            fill={isFavorite(product.id) ? BRAND.orange : 'transparent'}
          />
        </Pressable>
        <Pressable
          className="h-10 w-10 items-center justify-center"
          onPress={onContactSeller}
          accessibilityLabel="聯絡賣家"
        >
          <MessageCircle size={20} color={BRAND.navy} />
        </Pressable>
        {/* Two five-character labels share ~220px on a 360px phone. `sm` plus the
            tighter padding keeps each label centred inside its button instead of
            being squeezed against the edge. */}
        <Button
          size="sm"
          variant="secondary"
          className="flex-1 px-2"
          isDisabled={outOfStock || noShippingOption || addToCart.isPending}
          onPress={onAddToCart}
        >
          <Button.Label numberOfLines={1} className="text-center">
            加入購物車
          </Button.Label>
        </Button>
        <Button
          size="sm"
          className="flex-1 px-2"
          isDisabled={outOfStock || noShippingOption}
          onPress={onBuyNow}
        >
          <Button.Label numberOfLines={1} className="text-center">
            {outOfStock ? '已售完' : noShippingOption ? '暫無配送' : '立即購買'}
          </Button.Label>
        </Button>
      </View>
    </View>
  );
}
