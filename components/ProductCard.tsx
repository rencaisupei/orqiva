import { Pressable, View } from 'react-native';
import { Typography } from 'heroui-native';
import { router } from 'expo-router';
import { Heart, MapPin } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { StarRating } from '@/components/StarRating';
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
  const discount = discountPercent(Number(product.price), product.original_price);

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
        {onToggleFavorite ? (
          <Pressable
            className="absolute right-2 bottom-2 h-8 w-8 items-center justify-center rounded-full bg-white/95"
            onPress={() => onToggleFavorite(product.id)}
            accessibilityLabel={isFavorite ? '取消收藏' : '收藏商品'}
          >
            <Heart
              size={16}
              color={isFavorite ? BRAND.orange : BRAND.muted}
              fill={isFavorite ? BRAND.orange : 'transparent'}
            />
          </Pressable>
        ) : null}
      </View>

      <View className="gap-1.5 p-3">
        <Typography type="body-sm" numberOfLines={2} className="text-navy leading-5">
          {product.title}
        </Typography>

        <View className="flex-row items-end gap-1.5">
          <Typography type="h6" className="text-brand-orange" style={{ fontWeight: '700' }}>
            {formatPrice(product.price)}
          </Typography>
          {product.original_price ? (
            <Typography type="body-xs" color="muted" className="line-through">
              {formatPrice(product.original_price)}
            </Typography>
          ) : null}
        </View>

        <View className="flex-row items-center justify-between">
          <StarRating rating={Number(product.rating)} count={product.rating_count} />
          <Typography type="body-xs" color="muted">
            已售 {formatCompact(product.sold_count)}
          </Typography>
        </View>

        <View className="flex-row items-center gap-1">
          <MapPin size={11} color={BRAND.muted} />
          <Typography type="body-xs" color="muted" numberOfLines={1} className="flex-1">
            {product.location} · {product.store?.name ?? 'ORQIVA 賣家'}
          </Typography>
        </View>
      </View>
    </Pressable>
  );
}
