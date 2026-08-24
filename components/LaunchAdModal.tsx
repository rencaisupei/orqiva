import { useEffect, useState } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { Megaphone, X } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { protectBrand } from '@/components/brand/BrandText';
import { LinearGradient } from '@/components/ui/primitives/LinearGradient';
import { BRAND } from '@/lib/brand';
import { formatPrice } from '@/lib/format';
import { loadLaunchAdLog, markLaunchAdShown, shownToday } from '@/lib/launchAd';
import { isPopupBanner, type AdBanner, type ProductListItem } from '@/lib/types';

type PopupAd = {
  key: string;
  tag: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  imageUrl: string | null;
  onPress?: () => void;
};

/** 管理員橫幅的連結目標；沒有指定就只是純圖文，只能關掉。 */
function bannerAd(banner: AdBanner): PopupAd {
  const value = banner.link_value?.trim() ?? '';
  const go = (): (() => void) | undefined => {
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
  };
  return {
    key: `banner-${banner.id}`,
    tag: '廣告',
    title: banner.title,
    subtitle: banner.subtitle,
    ctaLabel: banner.cta_label,
    imageUrl: banner.image_url,
    onPress: go(),
  };
}

/** 沒有任何上架中的彈出廣告時，系統自動用降價最多的商品補位。 */
function productAd(product: ProductListItem): PopupAd {
  const saving = (product.original_price ?? 0) - product.price;
  return {
    key: `product-${product.id}`,
    tag: saving > 0 ? '系統精選 · 降價中' : '系統精選',
    title: product.title,
    subtitle:
      saving > 0
        ? `現在只要 ${formatPrice(product.price)}，比原價省 ${formatPrice(saving)}`
        : `${formatPrice(product.price)} · ${product.store?.name ?? '極貨網賣家'}`,
    ctaLabel: '看這個商品',
    imageUrl: product.cover_url,
    onPress: () => router.push({ pathname: '/products/[id]', params: { id: product.id } }),
  };
}

/**
 * 開啟 App 時的全螢幕商品廣告（像蝦皮、旋轉拍賣那種）。
 *
 * 內容兩個來源：管理員在後台審核上架、版位選「開啟時彈出」的橫幅優先；
 * 沒有的話系統自動挑降價最多的商品。同一支廣告一天最多跳一次，關掉之後
 * 當天不會再出現（紀錄只存在手機本機）。
 */
export function LaunchAdModal({
  banners,
  fallbackProducts,
}: {
  banners: AdBanner[];
  fallbackProducts: ProductListItem[];
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [ad, setAd] = useState<PopupAd | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible || ad) return undefined;

    const popupBanners = banners.filter((banner) => isPopupBanner(banner));
    const candidates: PopupAd[] =
      popupBanners.length > 0
        ? popupBanners.map(bannerAd)
        : fallbackProducts.slice(0, 3).map(productAd);
    if (candidates.length === 0) return undefined;

    let cancelled = false;
    void (async () => {
      const log = await loadLaunchAdLog();
      const next = candidates.find((candidate) => !shownToday(log, candidate.key));
      if (!next || cancelled) return;
      await markLaunchAdShown(next.key);
      if (cancelled) return;
      setAd(next);
      setVisible(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [ad, banners, fallbackProducts, visible]);

  if (!ad) return null;

  const cardWidth = Math.min(340, Math.round(windowWidth * 0.86));
  const imageHeight = Math.min(Math.round(cardWidth * 0.95), Math.round(windowHeight * 0.42));

  const close = () => setVisible(false);
  const act = () => {
    setVisible(false);
    ad.onPress?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Pressable
        accessibilityLabel="關閉廣告"
        onPress={close}
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: 'rgba(8, 38, 107, 0.62)' }}
      >
        {/* 點卡片本身不應該關掉廣告，所以吃掉這一層的點擊。 */}
        <Pressable
          onPress={() => undefined}
          className="bg-surface overflow-hidden rounded-3xl"
          style={{ width: cardWidth }}
        >
          <View style={{ width: cardWidth, height: imageHeight }}>
            {ad.imageUrl ? (
              <AppImage uri={ad.imageUrl} style={{ width: cardWidth, height: imageHeight }} />
            ) : (
              <LinearGradient
                colors={[BRAND.navy, '#0B3FA8', BRAND.blue]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: cardWidth, height: imageHeight }}
              />
            )}

            <View className="absolute top-3 left-3 flex-row items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1">
              <Megaphone size={12} color={BRAND.orange} />
              <Typography
                type="body-xs"
                numberOfLines={1}
                className="text-navy"
                style={{ fontWeight: '700' }}
              >
                {ad.tag}
              </Typography>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="關閉廣告"
              hitSlop={8}
              onPress={close}
              className="absolute top-3 right-3 h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(8, 38, 107, 0.55)' }}
            >
              <X size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          <View className="gap-1.5 p-4">
            <Typography
              type="h6"
              numberOfLines={2}
              className="text-navy"
              style={{ fontWeight: '700' }}
            >
              {ad.title}
            </Typography>
            {ad.subtitle ? (
              <Typography type="body-sm" color="muted" numberOfLines={3}>
                {protectBrand(ad.subtitle)}
              </Typography>
            ) : null}

            {ad.onPress ? (
              <Button className="mt-2 rounded-full" onPress={act}>
                <Button.Label style={{ fontWeight: '700' }}>{ad.ctaLabel}</Button.Label>
              </Button>
            ) : null}

            <Pressable hitSlop={6} className="mt-1 items-center py-1" onPress={close}>
              <Typography type="body-xs" color="muted">
                今天不再顯示
              </Typography>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
