import { View } from 'react-native';

import { MarketHome } from '@/components/MarketHome';
import { SellerTabBar } from '@/components/SellerTabBar';

/**
 * 賣家介面的「市集」：與買家首頁一模一樣的完整內容（搜尋、分類、廣告、推薦），
 * 只是底部掛的是賣家分頁列 —— 分開的是買賣功能，不是可以看到的商品。
 */
export default function SellerMarketScreen() {
  return (
    <View className="bg-background flex-1">
      <MarketHome showLaunchAd={false} />
      <SellerTabBar />
    </View>
  );
}
