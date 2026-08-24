import { Pressable, View } from 'react-native';
import { Typography } from 'heroui-native';
import { router, usePathname, type Href } from 'expo-router';
import { House, MessageCircle, Plus, Receipt, Store, User } from 'lucide-react-native';

import { BRAND } from '@/lib/brand';

type Item = {
  label: string;
  href: Href;
  match: string;
  icon: typeof House;
  /** 發布用實心圓底突顯，其他是一般的圖示 + 文字。 */
  filled?: boolean;
};

/**
 * 賣家分頁：市集（完整的商品首頁）、賣家中心首頁、發布、訂單、訊息、我的。
 *
 * 「市集」與買家首頁是同一份內容 —— 買賣分開的是功能，賣家一樣看得到全部商品。
 */
const ITEMS: Item[] = [
  { label: '市集', href: '/seller/market', match: '/seller/market', icon: Store },
  { label: '首頁', href: '/seller', match: '/seller', icon: House },
  {
    label: '發布',
    href: '/seller/new-product',
    match: '/seller/new-product',
    icon: Plus,
    filled: true,
  },
  { label: '訂單', href: '/seller/orders', match: '/seller/orders', icon: Receipt },
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
      onPress={() => (item.filled ? router.push(item.href) : router.replace(item.href))}
    >
      {item.filled ? (
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 26, height: 26, backgroundColor: BRAND.blue }}
        >
          <item.icon size={18} color={BRAND.white} strokeWidth={2.8} />
        </View>
      ) : (
        <item.icon size={22} color={color} />
      )}
      <Typography type="body-xs" numberOfLines={1} style={{ color, fontWeight: '600' }}>
        {item.label}
      </Typography>
    </Pressable>
  );
}

/**
 * 賣家介面的底部分頁列。與買家分頁列是兩套完全獨立的導覽：買家看到的是
 * 首頁／分類／購物車／訊息／我的，賣家看到的是市集／首頁／發布／訂單／訊息／我的。
 */
export function SellerTabBar() {
  const pathname = usePathname();

  return (
    <View className="border-border bg-surface pb-safe-offset-2 w-full flex-row border-t pt-2">
      {ITEMS.map((item) => (
        <TabItem key={item.label} item={item} isActive={pathname === item.match} />
      ))}
    </View>
  );
}
