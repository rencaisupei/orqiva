import { Tabs } from 'expo-router';

import { SellerTabBar } from '@/components/SellerTabBar';
import { BRAND } from '@/lib/brand';

/** 自訂分頁列（市集／首頁／發布／訂單／訊息／我的），發布不是分頁而是推入的頁面。 */
const renderTabBar = () => <SellerTabBar />;

/**
 * 賣家介面的分頁導覽 —— 與買家 (tabs) 同一套機制：畫面第一次進去後就留在記憶體裡，
 * 之後切分頁只是切換焦點，不會重新掛載，所以底部導覽與頁首在載入資料時不會消失。
 *
 * 檔案是群組目錄 (tabs)，所以網址仍然是 /seller、/seller/market、/seller/orders…
 */
export default function SellerTabsLayout() {
  return (
    <Tabs
      tabBar={renderTabBar}
      screenOptions={{
        headerShown: false,
        // 切分頁不做轉場動畫，點下去就換頁。
        animation: 'none',
        // 沒在看的分頁停止重新渲染：訊息與訂單是輪詢來的，沒有這個設定時每次輪詢
        // 都會讓所有已載入的分頁一起重繪，點分頁列就會有延遲感。
        freezeOnBlur: true,
        sceneStyle: { backgroundColor: BRAND.background },
      }}
    >
      {/* index 放第一個：它是這個群組的預設落點（/seller）。 */}
      <Tabs.Screen name="index" />
      <Tabs.Screen name="market" />
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
