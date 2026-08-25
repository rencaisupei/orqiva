import { Platform, Pressable, View } from 'react-native';
import { Typography } from 'heroui-native';
import { router } from 'expo-router';
import { Heart, MapPin } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { StarRating } from '@/components/StarRating';
import { protectBrand } from '@/components/brand/BrandText';
import { BRAND } from '@/lib/brand';
import { discountPercent, formatCompact, formatPrice } from '@/lib/format';
import type { ProductListItem } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
  product: ProductListItem;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
  className?: string;
};

export function ProductCard({ product, isFavorite = false, onToggleFavorite, className }: Props) {
  const discount = discountPercent(product.price, product.original_price);

  return (
    <Pressable
      className={cn('bg-surface overflow-hidden rounded-2xl', className)}
      style={{
        shadowColor: 'rgba(8, 38, 107, 0.10)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 2,
      }}
      onPress={() => router.push({ pathname: '/products/[id]', params: { id: product.id } })}
    >
      <View className="relative">
        <AppImage uri={product.cover_url} className="aspect-square w-full" />
        {discount ? (
          <View className="bg-brand-orange absolute top-2 left-2 rounded-full px-2 py-0.5">
            <Typography type="body-xs" className="text-white" style={{ fontWeight: '700' }}>
              -{discount}%
            </Typography>
          </View>
        ) : null}
        {product.condition === 'used' ? (
          <View className="bg-navy/85 absolute top-2 right-2 rounded-full px-2 py-0.5">
            <Typography type="body-xs" className="text-white">
              二手
            </Typography>
          </View>
        ) : null}
        {/* 賣家用J幣換到的曝光。標明「推廣」，買家才知道這是付費排序。 */}
        {product.is_boosted ? (
          <View className="bg-brand-blue absolute bottom-2 left-2 rounded-full px-2 py-0.5">
            <Typography type="body-xs" className="text-white" style={{ fontWeight: '700' }}>
              推廣
            </Typography>
          </View>
        ) : null}
        {/* 收藏鍵畫在封面圖上：擺在文字區時會把「已售 N」擠到看不見（2 欄的卡片
            在手機上只有約 150px 寬）。 */}
        {onToggleFavorite ? (
          <Pressable
            className="absolute right-2 bottom-2 h-8 w-8 items-center justify-center rounded-full"
            hitSlop={8}
            style={({ pressed }) => [
              {
                backgroundColor: 'rgba(255, 255, 255, 0.92)',
                opacity: pressed ? 0.6 : 1,
                shadowColor: 'rgba(8, 38, 107, 0.20)',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 1,
                shadowRadius: 3,
                elevation: 2,
              },
              Platform.OS === 'web' ? { cursor: 'pointer' } : null,
            ]}
            onPress={() => onToggleFavorite(product.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isFavorite }}
            accessibilityLabel={isFavorite ? '取消收藏' : '收藏商品'}
          >
            <Heart
              size={16}
              color={isFavorite ? BRAND.orange : BRAND.navy}
              fill={isFavorite ? BRAND.orange : 'transparent'}
            />
          </Pressable>
        ) : null}
      </View>

      <View className="gap-1 p-3">
        <Typography type="body-sm" numberOfLines={1} className="text-navy">
          {product.title}
        </Typography>

        <View className="flex-row flex-wrap items-end gap-x-1.5">
          <Typography
            type="h6"
            numberOfLines={1}
            className="text-brand-blue"
            style={{ fontWeight: '700' }}
          >
            {formatPrice(product.price)}
          </Typography>
          {product.original_price ? (
            <Typography type="body-xs" color="muted" numberOfLines={1} className="line-through">
              {formatPrice(product.original_price)}
            </Typography>
          ) : null}
        </View>

        <View className="mt-0.5 flex-row items-center gap-1.5">
          <StarRating rating={product.rating} count={product.rating_count} size={11} />
          <Typography type="body-xs" color="muted" numberOfLines={1} className="flex-1">
            已售 {formatCompact(product.sold_count)}
          </Typography>
        </View>

        <View className="flex-row items-center gap-1">
          <MapPin size={11} color={BRAND.muted} />
          <Typography type="body-xs" color="muted" numberOfLines={1} className="flex-1">
            {product.location} · {protectBrand(product.store?.name ?? '極貨網賣家')}
          </Typography>
        </View>
      </View>
    </Pressable>
  );
}
