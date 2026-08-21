import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Button, Chip, Label, Spinner, Typography } from 'heroui-native';
import * as WebBrowser from 'expo-web-browser';
import { MapPin, RefreshCw, Store } from 'lucide-react-native';

import { useMapSelection, useStoreMapUrl } from '@/lib/api/logistics';
import { BRAND } from '@/lib/brand';
import type { CvsPickup } from '@/lib/api/commerce';
import { LOGISTICS_SUB_TYPE_LABEL, type LogisticsSubType } from '@/lib/types';

type Props = {
  availableSubTypes: LogisticsSubType[];
  value: CvsPickup | null;
  onChange: (value: CvsPickup | null) => void;
  orderId?: string;
};

/**
 * 綠界門市電子地圖選店。
 * 綠界的地圖必須以表單 POST 開啟網頁，因此透過系統瀏覽器（不使用內嵌 iframe，
 * 綠界文件明確禁止），選完後由後端回拋寫入，App 再拉回結果。
 */
export function CvsStorePicker({ availableSubTypes, value, onChange, orderId }: Props) {
  const [subType, setSubType] = useState<LogisticsSubType>(
    (value?.logisticsSubType as LogisticsSubType | undefined) ?? availableSubTypes[0],
  );
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapUrl = useStoreMapUrl();
  const selection = useMapSelection();

  const openMap = () => {
    setError(null);
    mapUrl.mutate(
      { logisticsSubType: subType, orderId },
      {
        onSuccess: async ({ token: newToken, url }) => {
          setToken(newToken);
          if (Platform.OS === 'web') {
            globalThis.open?.(url, '_blank');
          } else {
            await WebBrowser.openBrowserAsync(url);
          }
        },
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  const loadSelection = () => {
    if (!token) return;
    setError(null);
    selection.mutate(token, {
      onSuccess: (result) => {
        if (result.status !== 'selected' || !result.store_id) {
          setError('還沒收到門市資料，請先在瀏覽器完成選店再回來讀取。');
          return;
        }
        onChange({
          logisticsSubType: result.logistics_sub_type,
          storeId: result.store_id,
          storeName: result.store_name,
          storeAddress: result.store_address,
          storePhone: result.store_phone,
        });
      },
      onError: (err: Error) => setError(err.message),
    });
  };

  if (availableSubTypes.length === 0) return null;

  return (
    <View className="gap-3">
      <View>
        <Label isRequired>選擇超商</Label>
        <View className="flex-row flex-wrap gap-2">
          {availableSubTypes.map((item) => (
            <Pressable
              key={item}
              onPress={() => {
                setSubType(item);
                setToken(null);
                onChange(null);
              }}
            >
              <Chip size="sm" variant={subType === item ? 'primary' : 'tertiary'}>
                {LOGISTICS_SUB_TYPE_LABEL[item]}
              </Chip>
            </Pressable>
          ))}
        </View>
      </View>

      {value ? (
        <View className="bg-background gap-1 rounded-xl p-3">
          <View className="flex-row items-center gap-2">
            <Store size={15} color={BRAND.blue} />
            <Typography type="body-sm" className="text-navy flex-1" style={{ fontWeight: '600' }}>
              {value.storeName ?? '已選擇門市'}
            </Typography>
          </View>
          <Typography type="body-xs" color="muted">
            店號 {value.storeId}
            {value.storeAddress ? ` · ${value.storeAddress}` : ''}
          </Typography>
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
          isDisabled={mapUrl.isPending}
          onPress={openMap}
        >
          <View className="flex-row items-center gap-2">
            {mapUrl.isPending ? <Spinner size="sm" /> : <MapPin size={15} color={BRAND.white} />}
            <Typography type="body-sm" className={value ? 'text-navy' : 'text-white'}>
              {value ? '重新選擇門市' : '選擇取貨門市'}
            </Typography>
          </View>
        </Button>

        {token ? (
          <Button variant="secondary" isDisabled={selection.isPending} onPress={loadSelection}>
            <View className="flex-row items-center gap-2">
              <RefreshCw size={15} color={BRAND.navy} />
              <Typography type="body-sm" className="text-navy">
                {selection.isPending ? '讀取中…' : '讀取門市'}
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
        選店頁會在瀏覽器開啟，選完請回到 App 按「讀取門市」帶回資料。
      </Typography>
    </View>
  );
}
