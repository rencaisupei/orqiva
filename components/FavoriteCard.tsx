import { Platform, Pressable, View } from 'react-native';
import { Typography, useToast } from 'heroui-native';
import { Share2, TrendingDown } from 'lucide-react-native';

import { ProductCard } from '@/components/ProductCard';
import { BRAND } from '@/lib/brand';
import { formatPrice } from '@/lib/format';
import { shareProduct } from '@/lib/share';
import { priceDrop, type FavoriteItem } from '@/lib/types';

/**
 * 願望清單的一格：商品卡 + 「比收藏時便宜多少」+ 分享給好友。
 *
 * 降價徽章拿 favorites.watch_price（收藏當下的價格，降價通知也用同一個基準）
 * 跟現價比，所以買家看到的省下金額與收到的通知一致。
 */
export function FavoriteCard({
  item,
  isFavorite,
  onToggleFavorite,
}: {
  item: FavoriteItem;
  isFavorite: boolean;
  onToggleFavorite: (productId: string) => void;
}) {
  const { toast } = useToast();
  const { product } = item;
  const drop = priceDrop(product.price, item.watch_price);

  const share = () => {
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

  return (
    <View className="gap-1.5">
      <ProductCard product={product} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />

      <View className="flex-row items-center gap-2">
        {drop ? (
          <View className="bg-brand-orange-soft flex-1 flex-row items-center gap-1 rounded-full px-2 py-1">
            <TrendingDown size={12} color={BRAND.orange} />
            <Typography
              type="body-xs"
              numberOfLines={1}
              className="text-brand-orange flex-1"
              style={{ fontWeight: '700' }}
            >
              降 {formatPrice(drop.amount)}
            </Typography>
          </View>
        ) : (
          <View className="flex-1" />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="分享給好友"
          hitSlop={6}
          onPress={share}
          style={Platform.OS === 'web' ? { cursor: 'pointer' } : undefined}
          className="border-border shrink-0 flex-row items-center gap-1 rounded-full border px-2.5 py-1"
        >
          <Share2 size={12} color={BRAND.navy} />
          <Typography type="body-xs" className="text-navy" style={{ fontWeight: '600' }}>
            分享
          </Typography>
        </Pressable>
      </View>
    </View>
  );
}
