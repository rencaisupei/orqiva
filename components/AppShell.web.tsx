import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { BRAND } from '@/lib/brand';
import { WEB_MAX_CONTENT_WIDTH } from '@/lib/layout';

/**
 * 網頁版的外框：把整個 App 收成置中的一欄，最寬 WEB_MAX_CONTENT_WIDTH。
 *
 * 滿寬時所有以寬度為基準的元素（商品主圖、雙欄商品卡、廣告輪播）都會跟著視窗
 * 放大，桌機上看起來像被拉開的海報。限寬之後手機與桌機看到的比例一致，窄視窗
 * （手機瀏覽器、PWA）則完全維持原樣。
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const wide = width > WEB_MAX_CONTENT_WIDTH;

  return (
    <View
      className="flex-1 items-center"
      style={{ backgroundColor: wide ? '#E7ECF4' : BRAND.background }}
    >
      <View
        className="bg-background w-full flex-1"
        style={{
          maxWidth: WEB_MAX_CONTENT_WIDTH,
          borderLeftWidth: wide ? 1 : 0,
          borderRightWidth: wide ? 1 : 0,
          borderColor: BRAND.border,
        }}
      >
        {children}
      </View>
    </View>
  );
}
