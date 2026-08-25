import { View } from 'react-native';

import { MarketHome } from '@/components/MarketHome';

/**
 * 賣家介面的「市集」：與買家首頁一模一樣的完整內容（搜尋、分類、廣告、推薦），
 * 只是底部掛的是賣家分頁列 —— 分開的是買賣功能，不是可以看到的商品。
 *
 * 分頁列由 app/seller/(tabs)/_layout.tsx 提供，這裡不用自己畫。
 */
export default function SellerMarketScreen() {
  return (
    <View className="bg-background flex-1">
      <MarketHome showLaunchAd={false} />
    </View>
  );
}
