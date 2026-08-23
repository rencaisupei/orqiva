import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Typography } from 'heroui-native';
import { router } from 'expo-router';
import { ChevronRight, Megaphone } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { LinearGradient } from '@/components/ui/primitives/LinearGradient';
import { BRAND } from '@/lib/brand';
import { formatPrice } from '@/lib/format';
import type { AdBanner, ProductListItem } from '@/lib/types';

const SLIDE_HEIGHT = 156;
const AUTO_ADVANCE_MS = 5000;

type Slide = {
  key: string;
  tag: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  imageUrl: string | null;
  onPress?: () => void;
};

/** 管理員橫幅的連結目標；沒有指定就只是純圖文，不可點。 */
function bannerPress(banner: AdBanner): (() => void) | undefined {
  const value = banner.link_value?.trim() ?? '';
  switch (banner.link_type) {
    case 'product':
      return value
        ? () => router.push({ pathname: '/products/[id]', params: { id: value } })
        : undefined;
    case 'store':
      return value
        ? () => router.push({ pathname: '/store/[id]', params: { id: value } })
        : undefined;
    case 'category':
      return value
        ? () => router.push({ pathname: '/products', params: { categoryId: value } })
        : undefined;
    case 'search':
      return () =>
        router.push(value ? { pathname: '/products', params: { q: value } } : '/products');
    default:
      return undefined;
  }
}

function productSlide(product: ProductListItem): Slide {
  const saving = (product.original_price ?? 0) - product.price;
  return {
    key: `product-${product.id}`,
    tag: saving > 0 ? '自動精選 · 降價中' : '自動精選',
    title: product.title,
    subtitle:
      saving > 0
        ? `現在 ${formatPrice(product.price)}，比原價省 ${formatPrice(saving)}`
        : `${formatPrice(product.price)} · ${product.store?.name ?? '極貨網賣家'}`,
    ctaLabel: '看商品',
    imageUrl: product.cover_url,
    onPress: () => router.push({ pathname: '/products/[id]', params: { id: product.id } }),
  };
}

/**
 * 首頁廣告輪播。
 *
 * 內容有兩個來源，兩者都要：管理員在後台審核上架的橫幅優先，沒有任何上架
 * 中的橫幅時，系統自動用降價幅度最大的商品補位，所以這一區永遠不會開天窗。
 * 自動換頁 5 秒一張，手動滑動後仍會繼續。
 */
export function AdCarousel({
  banners,
  fallbackProducts,
}: {
  banners: AdBanner[];
  fallbackProducts: ProductListItem[];
}) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const slides = useMemo<Slide[]>(() => {
    if (banners.length > 0) {
      return banners.map((banner) => ({
        key: `banner-${banner.id}`,
        tag: '廣告',
        title: banner.title,
        subtitle: banner.subtitle,
        ctaLabel: banner.cta_label,
        imageUrl: banner.image_url,
        onPress: bannerPress(banner),
      }));
    }
    return fallbackProducts.slice(0, 5).map(productSlide);
  }, [banners, fallbackProducts]);

  useEffect(() => {
    if (slides.length < 2 || width === 0) return undefined;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % slides.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [slides.length, width]);

  if (slides.length === 0) return null;

  return (
    <View className="mt-4 px-4" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            decelerationRate="fast"
            snapToInterval={width}
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={32}
            onScroll={(event) => {
              const next = Math.round(event.nativeEvent.contentOffset.x / width);
              setIndex((current) => (current === next ? current : next));
            }}
            style={{ width, height: SLIDE_HEIGHT }}
          >
            {slides.map((slide) => (
              <Pressable
                key={slide.key}
                disabled={!slide.onPress}
                onPress={slide.onPress}
                style={{ width, height: SLIDE_HEIGHT }}
              >
                <View
                  className="overflow-hidden rounded-3xl"
                  style={{ width, height: SLIDE_HEIGHT }}
                >
                  {slide.imageUrl ? (
                    <AppImage uri={slide.imageUrl} style={{ width, height: SLIDE_HEIGHT }} />
                  ) : (
                    <LinearGradient
                      colors={[BRAND.navy, '#0B3FA8', BRAND.blue]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ width, height: SLIDE_HEIGHT }}
                    />
                  )}

                  {/* Text sits on a dark scrim so it stays readable on any artwork. */}
                  <LinearGradient
                    colors={['rgba(8,38,107,0.05)', 'rgba(8,38,107,0.82)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: SLIDE_HEIGHT,
                    }}
                  />

                  <View className="absolute top-3 left-3 flex-row items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1">
                    <Megaphone size={12} color={BRAND.orange} />
                    <Typography
                      type="body-xs"
                      className="text-navy"
                      numberOfLines={1}
                      style={{ fontWeight: '700' }}
                    >
                      {slide.tag}
                    </Typography>
                  </View>

                  <View className="absolute right-4 bottom-3 left-4 gap-1">
                    <Typography
                      type="h6"
                      numberOfLines={2}
                      className="text-white"
                      style={{ fontWeight: '700' }}
                    >
                      {slide.title}
                    </Typography>
                    {slide.subtitle ? (
                      <Typography type="body-xs" numberOfLines={2} className="text-white/85">
                        {slide.subtitle}
                      </Typography>
                    ) : null}
                    {slide.onPress ? (
                      <View className="mt-1 flex-row items-center gap-1 self-start rounded-full bg-white px-3 py-1">
                        <Typography
                          type="body-xs"
                          className="text-navy"
                          style={{ fontWeight: '700' }}
                        >
                          {slide.ctaLabel}
                        </Typography>
                        <ChevronRight size={12} color={BRAND.navy} />
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {slides.length > 1 ? (
            <View className="mt-2 flex-row items-center justify-center gap-1.5">
              {slides.map((slide, dotIndex) => (
                <View
                  key={slide.key}
                  style={{
                    width: dotIndex === index ? 18 : 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: dotIndex === index ? BRAND.orange : BRAND.border,
                  }}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <View style={{ height: SLIDE_HEIGHT }} />
      )}
    </View>
  );
}
