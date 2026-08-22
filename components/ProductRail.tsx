import { ScrollView, View } from 'react-native';

import { ProductCard } from '@/components/ProductCard';
import type { ProductListItem } from '@/lib/types';

const CARD_WIDTH = 158;

/**
 * Horizontal product row used by the home screen sections (限時特賣, 最近瀏覽 …).
 * Cards keep a fixed width so every rail scrolls at the same rhythm.
 */
export function ProductRail({
  products,
  isFavorite,
  onToggleFavorite,
}: {
  products: ProductListItem[];
  isFavorite?: (productId: string) => boolean;
  onToggleFavorite?: (productId: string) => void;
}) {
  if (products.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-3 px-4 pb-2"
    >
      {products.map((product) => (
        <View key={product.id} style={{ width: CARD_WIDTH }}>
          <ProductCard
            product={product}
            isFavorite={isFavorite?.(product.id) ?? false}
            onToggleFavorite={onToggleFavorite}
          />
        </View>
      ))}
    </ScrollView>
  );
}
