import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, SearchField, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { Bell, ChevronRight, Menu, ShoppingCart } from 'lucide-react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import { HomeQuickMenu } from '@/components/HomeQuickMenu';
import { JihuoLogo, JihuoMark } from '@/components/brand/JihuoLogo';
import { ProductCard } from '@/components/ProductCard';
import { LinearGradient } from '@/components/ui/primitives/LinearGradient';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useCategories, useProducts } from '@/lib/api/catalog';
import { useCartCount } from '@/lib/api/commerce';
import { useUnreadNotificationCount } from '@/lib/api/social';
import { BRAND, BRAND_COPY } from '@/lib/brand';
import { useUserId } from '@/lib/session';

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View className="bg-brand-orange absolute -top-1 -right-1 min-w-4 items-center justify-center rounded-full px-1">
      <Typography type="body-xs" className="text-white" style={{ fontSize: 10, fontWeight: '700' }}>
        {count > 99 ? '99+' : count}
      </Typography>
    </View>
  );
}

function SectionHeader({ title, onMore }: { title: string; onMore?: () => void }) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Typography type="h6" className="text-navy" style={{ fontWeight: '700' }}>
        {title}
      </Typography>
      {onMore ? (
        <Pressable className="flex-row items-center" onPress={onMore}>
          <Typography type="body-sm" className="text-brand-blue">
            查看全部
          </Typography>
          <ChevronRight size={14} color={BRAND.blue} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const userId = useUserId();
  const { data: categories } = useCategories();
  const { data: popular } = useProducts({ sort: 'popular', limit: 4 });
  const { data: newest } = useProducts({ sort: 'newest', limit: 6 });
  const { data: cartCount } = useCartCount(userId);
  const { data: unread } = useUnreadNotificationCount(userId);
  const { isFavorite, onToggleFavorite } = useFavoriteToggle();

  const submitSearch = () => {
    const term = query.trim();
    router.push(term ? { pathname: '/products', params: { q: term } } : '/products');
  };

  return (
    <View className="bg-background flex-1">
      <View className="bg-surface pt-safe">
        <View className="flex-row items-center px-2 pt-2 pb-1">
          <Pressable
            className="h-10 w-10 items-center justify-center"
            onPress={() => setMenuOpen(true)}
            accessibilityLabel="快速前往"
          >
            <Menu size={22} color={BRAND.navy} />
          </Pressable>

          <View className="flex-1 items-center">
            <JihuoLogo size={34} showEn={false} />
          </View>

          <View className="flex-row items-center">
            <Pressable
              className="h-10 w-10 items-center justify-center"
              onPress={() => router.push('/notifications')}
              accessibilityLabel="通知"
            >
              <View>
                <Bell size={22} color={BRAND.navy} />
                <Badge count={unread ?? 0} />
              </View>
            </Pressable>
            <Pressable
              className="h-10 w-10 items-center justify-center"
              onPress={() => router.push('/cart')}
              accessibilityLabel="購物車"
            >
              <View>
                <ShoppingCart size={22} color={BRAND.navy} />
                <Badge count={cartCount ?? 0} />
              </View>
            </Pressable>
          </View>
        </View>

        <View className="px-4 pt-1 pb-3">
          <SearchField value={query} onChange={setQuery}>
            <SearchField.Group className="rounded-full">
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder={BRAND_COPY.searchPlaceholder}
                returnKeyType="search"
                onSubmitEditing={submitSearch}
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </View>
      </View>

      <ScrollView contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-4">
          <LinearGradient
            colors={[BRAND.navy, '#0B3FA8', BRAND.blue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="relative overflow-hidden rounded-3xl p-5"
          >
            <View className="absolute top-8 -right-5" pointerEvents="none">
              <JihuoMark
                size={150}
                shieldColor="rgba(255,255,255,0.16)"
                accentColor="rgba(255,255,255,0.26)"
                arrowColor="rgba(255,255,255,0.3)"
                letterColor="rgba(255,255,255,0.5)"
              />
            </View>

            <View className="w-[62%]">
              <View className="flex-row items-center gap-1.5">
                <Typography type="h4" className="text-white" style={{ fontWeight: '700' }}>
                  {BRAND_COPY.bannerLeadBuyer}
                </Typography>
                <Typography type="h5" className="text-brand-orange" style={{ fontWeight: '700' }}>
                  ×
                </Typography>
                <Typography type="h4" className="text-white" style={{ fontWeight: '700' }}>
                  {BRAND_COPY.bannerLeadSeller}
                </Typography>
              </View>
              <Typography type="h4" className="text-white" style={{ fontWeight: '700' }}>
                {BRAND_COPY.bannerHeadline}
              </Typography>
              <Typography type="body-sm" className="mt-2 text-white/85">
                {BRAND_COPY.bannerHighlights}
              </Typography>
              <Button
                className="mt-4 self-start rounded-full bg-white"
                size="sm"
                onPress={() => router.push('/products')}
              >
                <Button.Label className="text-navy" style={{ fontWeight: '700' }}>
                  {BRAND_COPY.bannerCta}
                </Button.Label>
              </Button>
            </View>
          </LinearGradient>
        </View>

        <View className="mt-4 px-4">
          <Typography type="h6" className="text-navy" style={{ fontWeight: '700' }}>
            {BRAND_COPY.tagline}
          </Typography>
          <Typography type="body-sm" color="muted">
            {BRAND_COPY.subTagline}
          </Typography>
        </View>

        <View className="mt-4 px-3">
          <View className="flex-row flex-wrap">
            {(categories ?? []).slice(0, 8).map((category) => (
              <Pressable
                key={category.id}
                className="mb-2 w-1/4 items-center px-1"
                onPress={() =>
                  router.push({
                    pathname: '/products',
                    params: { categoryId: category.id, categoryName: category.name },
                  })
                }
              >
                <View
                  className="bg-surface h-16 w-full items-center justify-center rounded-2xl"
                  style={{
                    shadowColor: 'rgba(8, 38, 107, 0.08)',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 1,
                    shadowRadius: 6,
                    elevation: 1,
                  }}
                >
                  <CategoryIcon name={category.icon} size={26} color={BRAND.navy} />
                </View>
                <Typography
                  type="body-xs"
                  className="text-navy mt-1.5"
                  numberOfLines={1}
                  style={{ fontWeight: '600' }}
                >
                  {category.name}
                </Typography>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mt-3 px-4">
          <SectionHeader
            title="熱門推薦"
            onMore={() => router.push({ pathname: '/products', params: { sort: 'popular' } })}
          />
          <View className="flex-row flex-wrap justify-between">
            {(popular ?? []).map((product) => (
              <View key={product.id} className="mb-3 w-[48.5%]">
                <ProductCard
                  product={product}
                  isFavorite={isFavorite(product.id)}
                  onToggleFavorite={onToggleFavorite}
                />
              </View>
            ))}
          </View>
        </View>

        <View className="mt-2 px-4">
          <SectionHeader
            title="最新上架"
            onMore={() => router.push({ pathname: '/products', params: { sort: 'newest' } })}
          />
          <View className="flex-row flex-wrap justify-between">
            {(newest ?? []).map((product) => (
              <View key={product.id} className="mb-3 w-[48.5%]">
                <ProductCard
                  product={product}
                  isFavorite={isFavorite(product.id)}
                  onToggleFavorite={onToggleFavorite}
                />
              </View>
            ))}
          </View>
        </View>

        <View className="mt-1 px-4">
          <Pressable
            className="bg-surface flex-row items-center gap-3 rounded-2xl p-4"
            onPress={() => router.push('/(tabs)/publish')}
          >
            <View className="bg-brand-orange-soft h-11 w-11 items-center justify-center rounded-xl">
              <CategoryIcon name="Package" color={BRAND.orange} />
            </View>
            <View className="flex-1">
              <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                有東西想賣？
              </Typography>
              <Typography type="body-sm" color="muted">
                開一間極貨網店舖，讓你的商品找到對的人
              </Typography>
            </View>
            <ChevronRight size={18} color={BRAND.muted} />
          </Pressable>
        </View>

        <View className="mt-6 items-center gap-1 px-4">
          <Typography type="body-xs" color="muted">
            {BRAND_COPY.core}
          </Typography>
        </View>
      </ScrollView>

      <HomeQuickMenu isOpen={menuOpen} onOpenChange={setMenuOpen} />
    </View>
  );
}
