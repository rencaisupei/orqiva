import { FlatList, Pressable, View } from 'react-native';
import { Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import { EmptyState } from '@/components/EmptyState';
import { useCategories } from '@/lib/api/catalog';
import { BRAND } from '@/lib/brand';
import { formatNumber } from '@/lib/format';

export default function CategoriesScreen() {
  const { data: categories, isLoading } = useCategories();

  return (
    <View className="bg-background flex-1">
      <View className="bg-surface pt-safe px-4 pb-3">
        <View className="pt-2">
          <Typography type="h4" className="text-navy" style={{ fontWeight: '700' }}>
            商品分類
          </Typography>
          <Typography type="body-sm" color="muted">
            從需求出發，快速找到對的商品
          </Typography>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (
        <FlatList
          data={categories ?? []}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 gap-2.5 pb-10"
          ListEmptyComponent={<EmptyState title="尚無分類" />}
          renderItem={({ item }) => (
            <Pressable
              className="bg-surface flex-row items-center gap-3 rounded-2xl p-3.5"
              onPress={() =>
                router.push({
                  pathname: '/products',
                  params: { categoryId: item.id, categoryName: item.name },
                })
              }
            >
              <View className="bg-brand-blue-soft h-11 w-11 items-center justify-center rounded-xl">
                <CategoryIcon name={item.icon} />
              </View>
              <View className="flex-1">
                <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                  {item.name}
                </Typography>
                <Typography type="body-xs" color="muted">
                  {item.name_en ?? ''} · {formatNumber(item.product_count)} 件商品
                </Typography>
              </View>
              <ChevronRight size={18} color={BRAND.muted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
