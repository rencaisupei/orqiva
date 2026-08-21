import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SearchField, Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import { EmptyState } from '@/components/EmptyState';
import { useCategories } from '@/lib/api/catalog';
import { BRAND } from '@/lib/brand';
import { formatNumber } from '@/lib/format';

export default function CategoriesScreen() {
  const { data: categories, isLoading } = useCategories();
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const all = categories ?? [];
    if (!term) return all;
    return all.filter(
      (category) =>
        category.name.toLowerCase().includes(term) ||
        (category.name_en ?? '').toLowerCase().includes(term),
    );
  }, [categories, query]);

  return (
    <View className="bg-background flex-1">
      <View className="bg-surface pt-safe px-4 pb-3">
        <View className="pt-2">
          <Typography type="h4" className="text-navy" style={{ fontWeight: '700' }}>
            商品分類
          </Typography>
          <Typography type="body-sm" color="muted">
            共 {formatNumber((categories ?? []).length)} 個分類，從需求出發快速找到商品
          </Typography>
        </View>
        <View className="mt-3">
          <SearchField value={query} onChange={setQuery}>
            <SearchField.Group className="rounded-full">
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="搜尋分類" returnKeyType="search" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 gap-2.5 pb-10"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              title={query ? '找不到符合的分類' : '尚無分類'}
              description={query ? '換個關鍵字再試試看。' : undefined}
            />
          }
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
              <View className="bg-brand-blue-soft h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <CategoryIcon name={item.icon} />
              </View>
              <View className="flex-1">
                <Typography
                  type="body"
                  numberOfLines={1}
                  className="text-navy"
                  style={{ fontWeight: '600' }}
                >
                  {item.name}
                </Typography>
                <Typography type="body-xs" color="muted" numberOfLines={1}>
                  {item.name_en ? `${item.name_en} · ` : ''}
                  {formatNumber(item.product_count)} 件商品
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
