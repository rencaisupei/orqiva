import { Pressable, View } from 'react-native';
import { BottomSheet, Typography } from 'heroui-native';
import { router, type Href } from 'expo-router';
import {
  Bell,
  ChevronRight,
  Heart,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Store as StoreIcon,
} from 'lucide-react-native';

import { BRAND } from '@/lib/brand';
import { useIsAdmin } from '@/lib/session';

type Props = {
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
};

type Item = {
  label: string;
  description: string;
  href: Href;
  icon: React.ReactNode;
};

/** Quick-jump sheet behind the home header menu button. */
export function HomeQuickMenu({ isOpen, onOpenChange }: Props) {
  const isAdmin = useIsAdmin();

  const items: Item[] = [
    {
      label: '我的收藏',
      description: '收藏起來的好商品',
      href: '/favorites',
      icon: <Heart size={18} color={BRAND.orange} />,
    },
    {
      label: '我的訂單',
      description: '查看訂單與配送狀態',
      href: '/orders',
      icon: <Receipt size={18} color={BRAND.blue} />,
    },
    {
      label: '購物車',
      description: '結帳前再確認一次',
      href: '/cart',
      icon: <ShoppingCart size={18} color={BRAND.blue} />,
    },
    {
      label: '通知中心',
      description: '訂單、訊息與系統通知',
      href: '/notifications',
      icon: <Bell size={18} color={BRAND.blue} />,
    },
    {
      label: '賣家中心',
      description: '銷售數據、商品與訂單',
      href: '/seller',
      icon: <StoreIcon size={18} color={BRAND.orange} />,
    },
  ];

  if (isAdmin) {
    items.push({
      label: '平台管理',
      description: '會員、商品與檢舉',
      href: '/admin',
      icon: <ShieldCheck size={18} color={BRAND.navy} />,
    });
  }

  const go = (href: Href) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <View className="pb-safe-offset-4 gap-1 px-4 pt-1">
            <View className="mb-2 flex-row items-center gap-2">
              <LayoutDashboard size={16} color={BRAND.navy} />
              <Typography type="body" className="text-navy" style={{ fontWeight: '700' }}>
                快速前往
              </Typography>
            </View>
            {items.map((item) => (
              <Pressable
                key={item.label}
                className="flex-row items-center gap-3 rounded-2xl px-2 py-3"
                onPress={() => go(item.href)}
              >
                <View className="bg-surface-secondary h-10 w-10 items-center justify-center rounded-xl">
                  {item.icon}
                </View>
                <View className="flex-1">
                  <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
                    {item.label}
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    {item.description}
                  </Typography>
                </View>
                <ChevronRight size={18} color={BRAND.muted} />
              </Pressable>
            ))}
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
