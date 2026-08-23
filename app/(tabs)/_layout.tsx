import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Grid2x2, House, MessageCircle, ShoppingCart, User } from 'lucide-react-native';

import { useCartCount } from '@/lib/api/commerce';
import { BRAND } from '@/lib/brand';
import { useUserId } from '@/lib/session';

/**
 * 買家分頁列：只有買東西會用到的目的地。賣家功能全部收在賣家介面（/seller），
 * 入口是「我的」裡的模式切換，所以這裡不再有發布商品之類的賣家動作。
 */
export default function TabLayout() {
  // A hard-coded tabBar height overrides React Navigation's automatic bottom
  // inset, which pushes the labels under the iOS home indicator and the Android
  // gesture bar. Add the inset back explicitly.
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const { data: cartCount } = useCartCount(userId);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: BRAND.background },
        tabBarStyle: {
          backgroundColor: BRAND.white,
          borderTopColor: BRAND.border,
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 6 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarActiveTintColor: BRAND.orange,
        tabBarInactiveTintColor: BRAND.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首頁',
          tabBarIcon: ({ color, size }) => <House color={color} size={size ?? 22} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: '分類',
          tabBarIcon: ({ color, size }) => <Grid2x2 color={color} size={size ?? 22} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: '購物車',
          tabBarBadge: cartCount && cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: BRAND.orange,
            color: BRAND.white,
            fontSize: 10,
            fontWeight: '700',
          },
          tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size ?? 22} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: '訊息',
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size ?? 22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => <User color={color} size={size ?? 22} />,
        }}
      />
    </Tabs>
  );
}
