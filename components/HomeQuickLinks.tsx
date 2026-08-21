import { Pressable, ScrollView, View } from 'react-native';
import { Typography } from 'heroui-native';
import { router, type Href } from 'expo-router';
import {
  Bell,
  Heart,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Store as StoreIcon,
} from 'lucide-react-native';

import { BRAND } from '@/lib/brand';
import { useIsAdmin } from '@/lib/session';

type Item = {
  label: string;
  href: Href;
  icon: React.ReactNode;
};

/** Always-visible quick-jump shortcuts under the home search field. */
export function HomeQuickLinks() {
  const isAdmin = useIsAdmin();

  const items: Item[] = [
    { label: '我的訂單', href: '/orders', icon: <Receipt size={15} color={BRAND.blue} /> },
    { label: '我的收藏', href: '/favorites', icon: <Heart size={15} color={BRAND.orange} /> },
    { label: '購物車', href: '/cart', icon: <ShoppingCart size={15} color={BRAND.blue} /> },
    { label: '通知中心', href: '/notifications', icon: <Bell size={15} color={BRAND.blue} /> },
    { label: '賣家中心', href: '/seller', icon: <StoreIcon size={15} color={BRAND.orange} /> },
  ];

  if (isAdmin) {
    items.push({
      label: '平台管理',
      href: '/admin',
      icon: <ShieldCheck size={15} color={BRAND.navy} />,
    });
  }

  return (
    <View className="pb-3">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4"
      >
        {items.map((item) => (
          <Pressable
            key={item.label}
            className="bg-surface-secondary flex-row items-center gap-1.5 rounded-full px-3 py-2"
            onPress={() => router.push(item.href)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            {item.icon}
            <Typography type="body-xs" className="text-navy" style={{ fontWeight: '600' }}>
              {item.label}
            </Typography>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
