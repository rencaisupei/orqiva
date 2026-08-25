import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Grid2x2, House, MessageCircle, ShoppingCart, User } from 'lucide-react-native';

import { useCartCount } from '@/lib/api/commerce';
import { BRAND } from '@/lib/brand';
import { useUserId } from '@/lib/session';

type IconProps = { color: string; size?: number };

// 圖示宣告在模組層，切分頁時整條分頁列不用重建這些元件。
const HomeIcon = ({ color, size }: IconProps) => <House color={color} size={size ?? 22} />;
const CategoriesIcon = ({ color, size }: IconProps) => <Grid2x2 color={color} size={size ?? 22} />;
const CartIcon = ({ color, size }: IconProps) => <ShoppingCart color={color} size={size ?? 22} />;
const MessagesIcon = ({ color, size }: IconProps) => (
  <MessageCircle color={color} size={size ?? 22} />
);
const ProfileIcon = ({ color, size }: IconProps) => <User color={color} size={size ?? 22} />;

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
        // 切分頁不做轉場動畫，點下去就換頁。
        animation: 'none',
        // 沒在看的分頁停止重新渲染 —— 訊息與通知數量是輪詢來的，沒有這個設定時
        // 每次輪詢都會讓所有已載入的分頁一起重繪，點分頁列就會有延遲感。
        freezeOnBlur: true,
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
          tabBarIcon: HomeIcon,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: '分類',
          tabBarIcon: CategoriesIcon,
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
            lineHeight: 13,
            fontWeight: '700',
          },
          tabBarIcon: CartIcon,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: '訊息',
          tabBarIcon: MessagesIcon,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ProfileIcon,
        }}
      />
    </Tabs>
  );
}
