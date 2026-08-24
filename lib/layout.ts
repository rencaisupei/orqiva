import { Platform, useWindowDimensions, type ViewStyle } from 'react-native';

/**
 * 網頁版商品主圖的寬度上限。
 *
 * 桌機瀏覽器的版面是滿寬的，aspect-square 的商品主圖若跟著視窗放大，會變成
 * 一整個螢幕高的巨圖。限寬之後主圖置中顯示，其餘版面照舊是網頁寬度。
 */
export const WEB_MAX_MEDIA_WIDTH = 420;

/** 網頁版格狀清單裡每一張商品卡的目標寬度（含左右間距的近似值）。 */
const WEB_TARGET_CARD_WIDTH = 210;
/** 再寬的螢幕也不要超過這個欄數，卡片太小反而看不清。 */
const WEB_MAX_GRID_COLUMNS = 6;
/** 格狀清單卡片之間的間距（px）。 */
const GRID_GUTTER = 12;

/**
 * 商品主圖／圖片輪播可用的寬度：原生等於視窗寬度，網頁版最多 WEB_MAX_MEDIA_WIDTH。
 * 需要用寬度算圖片尺寸或分頁捲動距離的地方都用這個，不要直接吃 useWindowDimensions。
 */
export function useMediaWidth(max: number = WEB_MAX_MEDIA_WIDTH): number {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' ? Math.min(width, max) : width;
}

/**
 * 商品格狀清單的欄數：原生固定 2 欄，網頁版隨視窗寬度增加。
 * 桌機上維持 2 欄會把每張卡（連帶封面圖）拉到半個螢幕寬。
 */
export function useGridColumns(): number {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return 2;
  return Math.min(WEB_MAX_GRID_COLUMNS, Math.max(2, Math.floor(width / WEB_TARGET_CARD_WIDTH)));
}

type ProductGrid = {
  columns: number;
  /** FlatList 不允許動態改 numColumns，換欄數時必須連 key 一起換。 */
  key: string;
  /** 給 FlatList 的 columnWrapperStyle：抵銷每一格自己的左右內距。 */
  columnWrapperStyle: ViewStyle;
  /** 每一格外層 View 的樣式：用百分比寬度＋內距做間距，最後一排才不會被拉寬。 */
  itemStyle: ViewStyle;
};

/**
 * 商品格狀清單的版面參數（商品列表、收藏、店鋪、最近瀏覽、首頁格狀區共用）。
 *
 * 刻意不用 flex-1 + gap：那樣最後一排若只剩一格，會被撐成整列寬度，
 * 封面圖也跟著放大。百分比寬度不論欄數與筆數都對齊。
 */
export function useProductGrid(): ProductGrid {
  const columns = useGridColumns();
  return {
    columns,
    key: `grid-${columns}`,
    columnWrapperStyle: { marginHorizontal: -GRID_GUTTER / 2 },
    itemStyle: { width: `${100 / columns}%`, paddingHorizontal: GRID_GUTTER / 2 },
  };
}
