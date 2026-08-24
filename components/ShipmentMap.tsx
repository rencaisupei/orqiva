import { Linking, Platform, View } from 'react-native';
import { Button, Chip, Spinner, Typography } from 'heroui-native';
import { ExternalLink, Navigation } from 'lucide-react-native';

import MapView from '@/components/MapView';
import { useGeocode } from '@/lib/api/geocode';
import { useLogisticsOrder } from '@/lib/api/logistics';
import { BRAND } from '@/lib/brand';
import { formatDate } from '@/lib/format';
import {
  SHIPMENT_STAGE_LABEL,
  isCvsOrder,
  isHomeSubType,
  shipmentStage,
  toLogisticsSubType,
  type Order,
  type ShipmentStage,
} from '@/lib/types';

type Props = { order: Order };

/**
 * 進度條的階段順序。綠界只回報貨態（已收件／運送中／已到店／已取貨），
 * 不提供貨車座標，所以位置一律標示目的地：超商取貨＝取貨門市，宅配＝收件地址。
 */
const CVS_STEPS: { stage: ShipmentStage; label: string }[] = [
  { stage: 'created', label: '已建單' },
  { stage: 'in_transit', label: '運送中' },
  { stage: 'arrived', label: '到店待取' },
  { stage: 'picked_up', label: '已取貨' },
];

const HOME_STEPS: { stage: ShipmentStage; label: string }[] = [
  { stage: 'created', label: '已建單' },
  { stage: 'in_transit', label: '運送中' },
  { stage: 'picked_up', label: '已送達' },
];

const STAGE_RANK: Record<ShipmentStage, number> = {
  awaiting: 0,
  created: 1,
  in_transit: 2,
  arrived: 3,
  picked_up: 4,
  issue: -1,
};

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/** 依貨態推估送達時間。沒有貨態就給出貨後的一般作業天數，不假裝有精確時間。 */
function estimate(stage: ShipmentStage, isHome: boolean, at: string): string {
  if (stage === 'picked_up') {
    return isHome ? `已於 ${formatDate(at)} 送達` : `已於 ${formatDate(at)} 完成取貨`;
  }
  if (stage === 'issue') return '包裹退回或發生異常，請與賣家確認';
  if (stage === 'arrived') return `包裹已到店，請於 ${formatDate(addDays(at, 7))} 前取貨`;
  if (stage === 'in_transit') {
    return isHome
      ? `預計 ${formatDate(addDays(at, 1))} ~ ${formatDate(addDays(at, 2))} 送達`
      : `預計 ${formatDate(addDays(at, 1))} ~ ${formatDate(addDays(at, 3))} 到店`;
  }
  if (stage === 'created') {
    return isHome
      ? `預計 ${formatDate(addDays(at, 1))} ~ ${formatDate(addDays(at, 3))} 送達`
      : `預計 ${formatDate(addDays(at, 2))} ~ ${formatDate(addDays(at, 4))} 到店`;
  }
  return isHome ? '賣家出貨後 1-3 個工作日送達' : '賣家出貨後 2-4 個工作日到店';
}

/** 「臺北市中正區」這種行政區層級的退路查詢，完整地址查不到時才用得到。 */
function districtOf(address: string): string | null {
  const matched = address.match(/([\u4e00-\u9fff]{2,3}[市縣])([\u4e00-\u9fff]{1,4}[區鄉鎮市])/);
  return matched ? `${matched[1]}${matched[2]}` : null;
}

function destinationQueries(order: Order, isHome: boolean): string[] {
  const list: string[] = [];
  if (isHome) {
    const full = [order.receiver_city, order.receiver_address].filter(Boolean).join('');
    if (full) list.push(full);
    const district = districtOf(full);
    if (district) list.push(district);
    if (order.receiver_city) list.push(order.receiver_city);
  } else {
    const address = order.cvs_store_address ?? '';
    if (address) list.push(address);
    const district = districtOf(address);
    if (district) list.push(district);
  }
  return [...new Set(list.map((query) => query.trim()).filter((query) => query.length >= 3))].slice(
    0,
    4,
  );
}

/**
 * 訂單詳情頁的配送地圖：目的地位置＋貨態進度＋預估送達。
 *
 * 刻意不畫「物流車輛目前位置」——綠界物流 API 只回傳貨態代碼，沒有 GPS 座標，
 * 畫一個插值出來的車子等於給買家看假資料。
 */
export function ShipmentMap({ order }: Props) {
  const { data: shipment } = useLogisticsOrder(order.id);

  const subType = toLogisticsSubType(order.logistics_sub_type ?? shipment?.logistics_sub_type);
  const isHome = isHomeSubType(subType) || order.logistics_type === 'HOME';
  const queries = destinationQueries(order, isHome);
  const { data: hit, isLoading } = useGeocode(queries);

  if (!isCvsOrder(order) || order.status === 'cancelled' || queries.length === 0) return null;

  const stage = shipmentStage(shipment?.status ?? null);
  const steps = isHome ? HOME_STEPS : CVS_STEPS;
  const rank = STAGE_RANK[stage];
  const updatedAt = shipment?.updated_at ?? order.updated_at;

  const title = isHome ? '收件地址' : (order.cvs_store_name ?? '取貨門市');
  const address = isHome
    ? [order.receiver_zip_code, order.receiver_city, order.receiver_address]
        .filter(Boolean)
        .join(' ')
    : (order.cvs_store_address ?? '');

  const coordinate = hit?.found ? { latitude: hit.latitude, longitude: hit.longitude } : null;

  const openInMaps = () => {
    const label = encodeURIComponent(`${title} ${address}`.trim());
    const point = coordinate ? `${coordinate.latitude},${coordinate.longitude}` : '';
    if (Platform.OS === 'ios' && coordinate) {
      void Linking.openURL(`http://maps.apple.com/?ll=${point}&q=${label}`);
      return;
    }
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${point || label}`);
  };

  return (
    <View className="border-border gap-3 rounded-2xl border border-dashed p-3">
      <View className="flex-row items-center gap-2">
        <Navigation size={16} color={BRAND.blue} />
        <Typography type="body-sm" className="text-navy flex-1" style={{ fontWeight: '600' }}>
          配送進度與位置
        </Typography>
        <Chip size="sm" variant="soft" color={stage === 'issue' ? 'danger' : 'accent'}>
          {SHIPMENT_STAGE_LABEL[stage]}
        </Chip>
      </View>

      {stage === 'issue' ? null : (
        <View className="flex-row items-center">
          {steps.map((step) => {
            const done = rank >= STAGE_RANK[step.stage];
            return (
              <View key={step.stage} className="flex-1 items-center">
                <View
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: done ? BRAND.blue : BRAND.border }}
                />
                <Typography type="body-xs" className={done ? 'text-navy' : 'text-muted'}>
                  {step.label}
                </Typography>
              </View>
            );
          })}
        </View>
      )}

      <View className="bg-background gap-0.5 rounded-xl p-3">
        <Typography type="body-xs" color="muted">
          {stage === 'picked_up' ? '送達狀態' : '預計送達'}
        </Typography>
        <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
          {estimate(stage, isHome, updatedAt)}
        </Typography>
      </View>

      {isLoading ? (
        <View
          className="bg-background items-center justify-center rounded-2xl"
          style={{ height: 180 }}
        >
          <Spinner size="sm" />
          <Typography type="body-xs" color="muted" className="mt-2">
            正在定位{isHome ? '收件地址' : '取貨門市'}…
          </Typography>
        </View>
      ) : coordinate ? (
        <MapView
          style={{ height: 180, borderRadius: 16, overflow: 'hidden' }}
          initialRegion={{
            ...coordinate,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          markers={[
            {
              id: 'destination',
              coordinate,
              title,
              description: address || undefined,
              color: isHome ? 'blue' : 'orange',
            },
          ]}
          scrollEnabled={false}
          zoomEnabled={false}
        />
      ) : (
        <View className="bg-background rounded-2xl p-3">
          <Typography type="body-xs" color="muted">
            這個地址在地圖上找不到精確位置，可以用下面的按鈕在地圖 App 中搜尋。
          </Typography>
        </View>
      )}

      <View className="gap-0.5">
        <Typography type="body-sm" numberOfLines={2} className="text-navy">
          {title}
        </Typography>
        {address ? (
          <Typography type="body-xs" color="muted">
            {address}
          </Typography>
        ) : null}
      </View>

      <Button size="sm" variant="secondary" onPress={openInMaps}>
        <View className="flex-row items-center gap-1.5">
          <ExternalLink size={14} color={BRAND.blue} />
          <Typography type="body-sm" className="text-brand-blue">
            在地圖 App 開啟
          </Typography>
        </View>
      </Button>

      <Typography type="body-xs" color="muted" className="leading-5">
        地圖標示的是{isHome ? '收件地址' : '取貨門市'}
        位置。物流商只回報貨態（已收件、運送中、已到店），不提供貨車的即時座標，因此不顯示車輛位置。
      </Typography>
    </View>
  );
}
