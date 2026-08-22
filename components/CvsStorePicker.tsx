import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, Label, Spinner, Typography } from 'heroui-native';
import * as WebBrowser from 'expo-web-browser';
import { MapPin, RefreshCw, Store } from 'lucide-react-native';

import { SelectPill } from '@/components/SelectPill';
import { useMapSelection, useStoreMapUrl } from '@/lib/api/logistics';
import { BRAND } from '@/lib/brand';
import type { CvsPickup } from '@/lib/api/commerce';
import { LOGISTICS_SUB_TYPE_LABEL, toLogisticsSubType, type LogisticsSubType } from '@/lib/types';

type Props = {
  availableSubTypes: LogisticsSubType[];
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
export function CvsStorePicker({ availableSubTypes, value, onChange, orderId }: Props) {
  // 先選超商才能開地圖：綠界的地圖網址必須帶 LogisticsSubType。
  const [subType, setSubType] = useState<LogisticsSubType | null>(
    toLogisticsSubType(value?.logisticsSubType),
  );
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const mapUrl = useStoreMapUrl();
  const selection = useMapSelection();

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
    if (!subType) return;
    setError(null);
    mapUrl.mutate(
      { logisticsSubType: subType, orderId },
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

  if (availableSubTypes.length === 0) return null;

  return (
    <View className="gap-3">
      <View>
        <Label isRequired>取貨超商</Label>
        <View className="flex-row flex-wrap gap-2">
          {availableSubTypes.map((item) => (
            <SelectPill
              key={item}
              size="sm"
              label={`${LOGISTICS_SUB_TYPE_LABEL[item]} 取貨付款`}
              selected={subType === item}
              onPress={() => {
                setSubType(item);
                setToken(null);
                setError(null);
                onChange(null);
              }}
            />
          ))}
        </View>
      </View>

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
          isDisabled={!subType || mapUrl.isPending || pulling}
          onPress={openMap}
        >
          <View className="flex-row items-center gap-2">
            {mapUrl.isPending || pulling ? (
              <Spinner size="sm" />
            ) : (
              <MapPin size={15} color={value ? BRAND.navy : BRAND.white} />
            )}
            <Typography type="body-sm" className={value ? 'text-navy' : 'text-white'}>
              {value ? '重新選擇門市' : '選擇取貨門市'}
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
        {subType
          ? '選店頁會在瀏覽器開啟；關閉瀏覽器後會自動帶回門市，若沒帶回請按「讀取門市」。'
          : '請先選擇要取貨的超商，才能開啟門市電子地圖。'}
      </Typography>
    </View>
  );
}
