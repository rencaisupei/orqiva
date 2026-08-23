import { Pressable, View } from 'react-native';
import { Typography } from 'heroui-native';
import { router, usePathname, type Href } from 'expo-router';
import { House, MessageCircle, Plus, Receipt, User } from 'lucide-react-native';

import { BRAND } from '@/lib/brand';

type Item = {
  label: string;
  href: Href;
  match: string;
  icon: typeof House;
};

/** 賣家分頁：發布放在中央凸起的按鈕，左右各兩個目的地。 */
const LEFT: Item[] = [
  { label: '首頁', href: '/seller', match: '/seller', icon: House },
  { label: '訂單', href: '/seller/orders', match: '/seller/orders', icon: Receipt },
];

const RIGHT: Item[] = [
  { label: '訊息', href: '/seller/messages', match: '/seller/messages', icon: MessageCircle },
  { label: '我的', href: '/seller/account', match: '/seller/account', icon: User },
];

function TabItem({ item, isActive }: { item: Item; isActive: boolean }) {
  const color = isActive ? BRAND.orange : BRAND.muted;
  return (
    <Pressable
      className="flex-1 items-center gap-1 py-1"
      accessibilityRole="button"
      accessibilityLabel={item.label}
      onPress={() => router.replace(item.href)}
    >
      <item.icon size={22} color={color} />
      <Typography type="body-xs" numberOfLines={1} style={{ color, fontWeight: '600' }}>
        {item.label}
      </Typography>
    </Pressable>
  );
}

/**
 * 賣家介面的底部分頁列。與買家分頁列是兩套完全獨立的導覽：買家看到的是
 * 首頁／分類／購物車／訊息／我的，賣家看到的是首頁／訂單／發布／訊息／我的。
 */
export function SellerTabBar() {
  const pathname = usePathname();

  return (
    <View className="border-border bg-surface pb-safe-offset-2 w-full flex-row border-t pt-2">
      {LEFT.map((item) => (
        <TabItem key={item.label} item={item} isActive={pathname === item.match} />
      ))}

      <View className="flex-1 items-center justify-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="發布商品"
          onPress={() => router.push('/seller/new-product')}
          className="items-center justify-center rounded-full"
          style={{
            width: 54,
            height: 54,
            marginTop: -22,
            backgroundColor: BRAND.blue,
            borderWidth: 4,
            borderColor: BRAND.white,
            shadowColor: BRAND.blue,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Plus size={26} color={BRAND.white} strokeWidth={2.8} />
        </Pressable>
      </View>

      {RIGHT.map((item) => (
        <TabItem key={item.label} item={item} isActive={pathname === item.match} />
      ))}
    </View>
  );
}
