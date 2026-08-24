import { Platform, useWindowDimensions } from 'react-native';

/**
 * 桌機瀏覽器上整個 App 收成一欄手機寬度（見 components/AppShell.web.tsx）。
 * 沒有這個上限時，滿寬版面會把 aspect-square 的商品圖放大到整個視窗寬度。
 */
export const WEB_MAX_CONTENT_WIDTH = 480;

/**
 * 畫面實際可用的寬度：原生等於視窗寬度，網頁版則是 App 那一欄的寬度。
 * 需要用寬度算圖片尺寸或分頁捲動距離的地方都用這個，不要直接吃 useWindowDimensions。
 */
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' ? Math.min(width, WEB_MAX_CONTENT_WIDTH) : width;
}
