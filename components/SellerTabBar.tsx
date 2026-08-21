import { Pressable, View } from 'react-native';
import { Typography } from 'heroui-native';
import { router, usePathname, type Href } from 'expo-router';
import { BarChart3, House, Package, Receipt, User } from 'lucide-react-native';

import { BRAND } from '@/lib/brand';

type Item = {
  label: string;
  href: Href;
  match: string;
  icon: typeof House;
};

const ITEMS: Item[] = [
  { label: '首頁', href: '/seller', match: '/seller', icon: House },
  { label: '訂單', href: '/seller/orders', match: '/seller/orders', icon: Receipt },
  { label: '商品', href: '/seller/products', match: '/seller/products', icon: Package },
  { label: '分析', href: '/seller/analytics', match: '/seller/analytics', icon: BarChart3 },
  { label: '我的', href: '/(tabs)/profile', match: '/profile', icon: User },
];

/** Seller-only bottom navigation, mirrored across the seller center screens. */
export function SellerTabBar() {
  const pathname = usePathname();

  return (
    <View className="border-border bg-surface pb-safe-offset-2 w-full flex-row border-t pt-2">
      {ITEMS.map((item) => {
        const isActive = pathname === item.match;
        const color = isActive ? BRAND.orange : BRAND.muted;
        return (
          <Pressable
            key={item.label}
            className="flex-1 items-center gap-1 py-1"
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => router.replace(item.href)}
          >
            <item.icon size={22} color={color} />
            <Typography type="body-xs" style={{ color, fontSize: 11, fontWeight: '600' }}>
              {item.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}
