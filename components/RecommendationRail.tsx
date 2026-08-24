import { View } from 'react-native';
import { Spinner, Typography } from 'heroui-native';
import { Sparkles } from 'lucide-react-native';

import { ProductRail } from '@/components/ProductRail';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useForYouProducts, useSimilarProducts } from '@/lib/api/recommend';
import { BRAND } from '@/lib/brand';

type Props = {
  /** 區塊標題，例如「智慧推薦」或「為你推薦」。 */
  title: string;
  /** 帶 productId = 商品頁的相似推薦；不帶就用 seedIds 做個人化推薦。 */
  productId?: string;
  /** 個人化推薦的種子（最近瀏覽、購物車內容），最多取前 8 筆。 */
  seedIds?: string[];
  limit?: number;
};

/**
 * AI 推薦橫向列表。兩種模式共用一個外觀，資料抓取都在伺服器端決定與快取；
 * 模型不可用時伺服器會回規則式結果，這裡只在真的抓到商品時才顯示區塊。
 */
export function RecommendationRail({ title, productId, seedIds, limit = 10 }: Props) {
  const { isFavorite, onToggleFavorite } = useFavoriteToggle();

  const similar = useSimilarProducts(productId, limit);
  const forYou = useForYouProducts(seedIds ?? [], limit, !productId);

  const query = productId ? similar : forYou;
  const products = query.data?.products ?? [];
  const reason = query.data?.reason ?? '';

  if (query.isLoading) {
    return (
      <View className="mt-3 items-center py-6">
        <Spinner size="sm" />
      </View>
    );
  }

  // 推薦是加值內容，抓不到就安靜地不出現，不要留一塊空殼或錯誤訊息給買家。
  if (products.length === 0) return null;

  return (
    <View className="mt-3">
      <View className="mb-3 flex-row items-center gap-2 px-4">
        <View className="bg-brand-blue-soft h-7 w-7 items-center justify-center rounded-full">
          <Sparkles size={15} color={BRAND.blue} />
        </View>
        <View className="flex-1">
          <Typography
            type="h6"
            numberOfLines={1}
            className="text-navy"
            style={{ fontWeight: '700' }}
          >
            {title}
          </Typography>
          {reason ? (
            <Typography type="body-xs" color="muted" numberOfLines={1}>
              {reason}
            </Typography>
          ) : null}
        </View>
      </View>

      <ProductRail
        products={products}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
      />
    </View>
  );
}
