import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Button, Input, Separator, Spinner, Typography } from 'heroui-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PackageSearch, SlidersHorizontal, X } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { ProductCard } from '@/components/ProductCard';
import { SelectPill } from '@/components/SelectPill';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useProducts } from '@/lib/api/catalog';
import { BRAND, BRAND_COPY } from '@/lib/brand';
import { formatNumber } from '@/lib/format';
import {
  LOCATIONS,
  SHIPPING_METHODS,
  SORT_OPTIONS,
  type ProductCondition,
  type SortKey,
} from '@/lib/types';

type Draft = {
  minPrice: string;
  maxPrice: string;
  condition: ProductCondition | null;
  location: string | null;
  minRating: number | null;
  shipping: string | null;
};

const EMPTY_DRAFT: Draft = {
  minPrice: '',
  maxPrice: '',
  condition: null,
  location: null,
  minRating: null,
  shipping: null,
};

const RATING_OPTIONS = [4, 4.5];

export default function ProductListScreen() {
  const params = useLocalSearchParams<{
    categoryId?: string;
    categoryName?: string;
    q?: string;
    sort?: string;
    storeId?: string;
  }>();

  const [search, setSearch] = useState(params.q ?? '');
  const [sort, setSort] = useState<SortKey>((params.sort as SortKey) ?? 'newest');
  const [showFilters, setShowFilters] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [applied, setApplied] = useState<Draft>(EMPTY_DRAFT);

  const { isFavorite, onToggleFavorite } = useFavoriteToggle();

  const filters = useMemo(
    () => ({
      categoryId: params.categoryId,
      storeId: params.storeId,
      q: search.trim() || undefined,
      sort,
      minPrice: applied.minPrice ? Number(applied.minPrice) : undefined,
      maxPrice: applied.maxPrice ? Number(applied.maxPrice) : undefined,
      condition: applied.condition ?? undefined,
      location: applied.location ?? undefined,
      minRating: applied.minRating ?? undefined,
      shipping: applied.shipping ?? undefined,
    }),
    [params.categoryId, params.storeId, search, sort, applied],
  );

  const { data: products, isLoading } = useProducts(filters);

  const activeFilterCount = [
    applied.minPrice || applied.maxPrice ? 1 : 0,
    applied.condition ? 1 : 0,
    applied.location ? 1 : 0,
    applied.minRating ? 1 : 0,
    applied.shipping ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <View className="bg-background flex-1">
      <View className="bg-surface px-4 pt-3 pb-3">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Input
              placeholder={BRAND_COPY.searchPlaceholder}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>
          <Pressable
            className="bg-brand-blue-soft h-11 w-11 items-center justify-center rounded-xl"
            onPress={() => {
              setDraft(applied);
              setShowFilters((v) => !v);
            }}
            accessibilityLabel="篩選"
          >
            {showFilters ? (
              <X size={18} color={BRAND.blue} />
            ) : (
              <SlidersHorizontal size={18} color={BRAND.blue} />
            )}
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
          <View className="flex-row gap-2">
            {SORT_OPTIONS.map((option) => (
              <SelectPill
                key={option.key}
                size="sm"
                label={option.label}
                selected={sort === option.key}
                onPress={() => setSort(option.key)}
              />
            ))}
          </View>
        </ScrollView>

        <View className="mt-2 flex-row items-center justify-between">
          <Typography type="body-xs" color="muted">
            {params.categoryName ? `${params.categoryName} · ` : ''}共{' '}
            {formatNumber(products?.length ?? 0)} 件商品
          </Typography>
          {activeFilterCount > 0 ? (
            <Pressable onPress={() => setApplied(EMPTY_DRAFT)}>
              <Typography type="body-xs" className="text-brand-orange">
                清除 {activeFilterCount} 項篩選
              </Typography>
            </Pressable>
          ) : null}
        </View>
      </View>

      {showFilters ? (
        <ScrollView className="bg-surface max-h-96" contentContainerClassName="p-4 gap-4">
          <Separator />
          <View className="gap-2">
            <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
              價格區間
            </Typography>
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Input
                  placeholder="最低價"
                  keyboardType="numeric"
                  value={draft.minPrice}
                  onChangeText={(v) => setDraft((d) => ({ ...d, minPrice: v.replace(/\D/g, '') }))}
                />
              </View>
              <Typography color="muted">—</Typography>
              <View className="flex-1">
                <Input
                  placeholder="最高價"
                  keyboardType="numeric"
                  value={draft.maxPrice}
                  onChangeText={(v) => setDraft((d) => ({ ...d, maxPrice: v.replace(/\D/g, '') }))}
                />
              </View>
            </View>
          </View>

          <View className="gap-2">
            <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
              商品狀態
            </Typography>
            <View className="flex-row gap-2">
              {(['new', 'used'] as ProductCondition[]).map((value) => (
                <SelectPill
                  key={value}
                  size="sm"
                  label={value === 'new' ? '全新' : '二手'}
                  selected={draft.condition === value}
                  onPress={() =>
                    setDraft((d) => ({ ...d, condition: d.condition === value ? null : value }))
                  }
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
              所在地
            </Typography>
            <View className="flex-row flex-wrap gap-2">
              {LOCATIONS.map((value) => (
                <SelectPill
                  key={value}
                  size="sm"
                  label={value}
                  selected={draft.location === value}
                  onPress={() =>
                    setDraft((d) => ({ ...d, location: d.location === value ? null : value }))
                  }
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
              評價
            </Typography>
            <View className="flex-row gap-2">
              {RATING_OPTIONS.map((value) => (
                <SelectPill
                  key={value}
                  size="sm"
                  label={`${value} 星以上`}
                  selected={draft.minRating === value}
                  onPress={() =>
                    setDraft((d) => ({ ...d, minRating: d.minRating === value ? null : value }))
                  }
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
              配送方式
            </Typography>
            <View className="flex-row flex-wrap gap-2">
              {SHIPPING_METHODS.map((value) => (
                <SelectPill
                  key={value}
                  size="sm"
                  label={value}
                  selected={draft.shipping === value}
                  onPress={() =>
                    setDraft((d) => ({ ...d, shipping: d.shipping === value ? null : value }))
                  }
                />
              ))}
            </View>
          </View>

          <View className="flex-row gap-2">
            <Button variant="secondary" className="flex-1" onPress={() => setDraft(EMPTY_DRAFT)}>
              <Button.Label>清除</Button.Label>
            </Button>
            <Button
              className="flex-1"
              onPress={() => {
                setApplied(draft);
                setShowFilters(false);
              }}
            >
              <Button.Label>套用篩選</Button.Label>
            </Button>
          </View>
        </ScrollView>
      ) : null}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (
        <FlatList
          data={products ?? []}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerClassName="p-4 gap-3 pb-10"
          ListEmptyComponent={
            <EmptyState
              icon={<PackageSearch size={26} color={BRAND.blue} />}
              title="找不到符合的商品"
              description="試著調整關鍵字或篩選條件。"
              action={
                <Button variant="secondary" onPress={() => router.push('/(tabs)/categories')}>
                  <Button.Label>瀏覽全部分類</Button.Label>
                </Button>
              }
            />
          }
          renderItem={({ item }) => (
            <View className="flex-1">
              <ProductCard
                product={item}
                isFavorite={isFavorite(item.id)}
                onToggleFavorite={onToggleFavorite}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}
