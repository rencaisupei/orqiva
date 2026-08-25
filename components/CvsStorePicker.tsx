import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, Spinner, Typography } from 'heroui-native';
import * as WebBrowser from 'expo-web-browser';
import { MapPin, RefreshCw, Store } from 'lucide-react-native';

import { useMapSelection, useStoreMapUrl } from '@/lib/api/logistics';
import { BRAND } from '@/lib/brand';
import type { CvsPickup } from '@/lib/api/commerce';
import { LOGISTICS_SUB_TYPE_LABEL, type CvsSubType } from '@/lib/types';

type Props = {
  /** 買家在結帳頁選的取貨超商，決定電子地圖要開哪一家。 */
  subType: CvsSubType;
  /**
   * 這次要出貨的賣家。地圖表單用他自己的綠界特店簽章，代收貨款才會進他的帳戶，
   * 所以沒有這個值就不能開地圖。
   */
  sellerId: string;
  value: CvsPickup | null;
  onChange: (value: CvsPickup | null) => void;
  orderId?: string;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 綠界門市電子地圖選店。
 * 綠界的地圖必須以表單 POST 開啟網頁，因此透過系統／App 內瀏覽器（不使用內嵌
 * iframe，綠界文件明確禁止），選完後由後端回拋寫入，App 再拉回結果。
 */
export function CvsStorePicker({ subType, sellerId, value, onChange, orderId }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const mapUrl = useStoreMapUrl();
  const selection = useMapSelection();
  const brand = LOGISTICS_SUB_TYPE_LABEL[subType];

  // 換一家超商時舊的選店連結就作廢了（門市代號不能跨通路使用）。
  useEffect(() => {
    setToken(null);
    setError(null);
  }, [subType]);

  /** 回拋寫入可能比瀏覽器關閉稍慢，所以重試幾次再回報失敗。 */
  const pullSelection = async (activeToken: string, attempts: number) => {
    setError(null);
    setPulling(true);
    try {
      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          const result = await selection.mutateAsync(activeToken);
          if (result.status === 'selected' && result.store_id) {
            onChange({
              logisticsSubType: result.logistics_sub_type,
              storeId: result.store_id,
              storeName: result.store_name,
              storeAddress: result.store_address,
              storePhone: result.store_phone,
            });
            return;
          }
        } catch (err) {
          if (attempt === attempts - 1) {
            setError(err instanceof Error ? err.message : '讀取門市資料失敗，請再試一次。');
            return;
          }
        }
        if (attempt < attempts - 1) await wait(1200);
      }
      setError('還沒收到門市資料，請確認已在瀏覽器完成選店，再按「讀取門市」。');
    } finally {
      setPulling(false);
    }
  };

  const openMap = () => {
    setError(null);
    mapUrl.mutate(
      { logisticsSubType: subType, sellerId, orderId },
      {
        onSuccess: async ({ token: newToken, url }) => {
          setToken(newToken);
          if (Platform.OS === 'web') {
            globalThis.open?.(url, '_blank');
          } else {
            // openBrowserAsync resolves when the in-app browser is dismissed, so
            // the chosen store can be pulled back without an extra tap.
            await WebBrowser.openBrowserAsync(url);
            await pullSelection(newToken, 3);
          }
        },
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  return (
    <View className="gap-3">
      {value ? (
        <View className="bg-background gap-1 rounded-xl p-3">
          <View className="flex-row items-center gap-2">
            <Store size={15} color={BRAND.blue} />
            <Typography type="body-sm" className="text-navy flex-1" style={{ fontWeight: '600' }}>
              已選門市：{value.storeName ?? '未提供店名'}（門市代號：{value.storeId}）
            </Typography>
          </View>
          {value.storeAddress ? (
            <Typography type="body-xs" color="muted">
              地址 {value.storeAddress}
            </Typography>
          ) : null}
          {value.storePhone ? (
            <Typography type="body-xs" color="muted">
              電話 {value.storePhone}
            </Typography>
          ) : null}
        </View>
      ) : null}

      <View className="flex-row gap-2">
        <Button
          variant={value ? 'secondary' : 'primary'}
          className="flex-1"
          isDisabled={mapUrl.isPending || pulling}
          onPress={openMap}
        >
          <View className="flex-row items-center gap-2">
            {mapUrl.isPending || pulling ? (
              <Spinner size="sm" />
            ) : (
              <MapPin size={15} color={value ? BRAND.navy : BRAND.white} />
            )}
            <Typography type="body-sm" className={value ? 'text-navy' : 'text-white'}>
              {value ? `重新選擇${brand}門市` : `選擇${brand}取貨門市`}
            </Typography>
          </View>
        </Button>

        {token ? (
          <Button
            variant="secondary"
            isDisabled={pulling}
            onPress={() => void pullSelection(token, 1)}
          >
            <View className="flex-row items-center gap-2">
              <RefreshCw size={15} color={BRAND.navy} />
              <Typography type="body-sm" className="text-navy">
                {pulling ? '讀取中…' : '讀取門市'}
              </Typography>
            </View>
          </Button>
        ) : null}
      </View>

      {error ? (
        <Typography type="body-xs" className="text-danger">
          {error}
        </Typography>
      ) : null}

      <Typography type="body-xs" color="muted">
        選店頁會在瀏覽器開啟；關閉瀏覽器後會自動帶回門市，若沒帶回請按「讀取門市」。
      </Typography>
    </View>
  );
}
