import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { BarChart3, Eye, Receipt, Wallet } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { BarChart } from '@/components/BarChart';
import { EmptyState } from '@/components/EmptyState';
import { RatingBreakdown } from '@/components/RatingBreakdown';
import { ReviewList } from '@/components/ReviewList';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { SelectPill } from '@/components/SelectPill';
import { SellerTabBar } from '@/components/SellerTabBar';
import { SignInRequired } from '@/components/SignInRequired';
import { StarRating } from '@/components/StarRating';
import {
  useMyStoreQuery,
  useSellerSalesReport,
  useStoreReviews,
  type SalesGrain,
} from '@/lib/api/seller';
import { BRAND } from '@/lib/brand';
import { formatCompact, formatNumber, formatPrice } from '@/lib/format';
import { useUserId } from '@/lib/session';
import { ORDER_STATUS_LABEL, ratingBreakdown, type OrderStatus } from '@/lib/types';

type Metric = 'revenue' | 'orders' | 'views';

const GRAINS: Segment<SalesGrain>[] = [
  { key: 'day', label: '每日' },
  { key: 'week', label: '每週' },
  { key: 'month', label: '每月' },
];

/** 每個顆粒度有自己合理的日期範圍選項，避免出現「每月 × 近 7 天」這種組合。 */
const RANGES: Record<SalesGrain, { count: number; label: string }[]> = {
  day: [
    { count: 7, label: '近 7 天' },
    { count: 14, label: '近 14 天' },
    { count: 30, label: '近 30 天' },
  ],
  week: [
    { count: 4, label: '近 4 週' },
    { count: 8, label: '近 8 週' },
    { count: 12, label: '近 12 週' },
  ],
  month: [
    { count: 3, label: '近 3 個月' },
    { count: 6, label: '近 6 個月' },
    { count: 12, label: '近 12 個月' },
  ],
};

const STATUS_ORDER: OrderStatus[] = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];

/** 可點選的指標磚：選中的那一個決定下方圖表畫什麼。 */
function MetricTile({
  label,
  value,
  delta,
  icon,
  selected,
  onPress,
}: {
  label: string;
  value: string;
  delta: number | null;
  icon: React.ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={Platform.OS === 'web' ? { cursor: 'pointer' } : undefined}
      className={`flex-1 gap-1 rounded-2xl border p-3 ${
        selected ? 'border-brand-blue bg-brand-blue-soft' : 'border-border bg-surface'
      }`}
    >
      <View className="flex-row items-center gap-1.5">
        {icon}
        <Typography type="body-xs" color="muted" numberOfLines={1} className="flex-1">
          {label}
        </Typography>
      </View>
      <Typography type="body" numberOfLines={1} className="text-navy" style={{ fontWeight: '700' }}>
        {value}
      </Typography>
      <Typography
        type="body-xs"
        numberOfLines={1}
        style={{
          color: delta === null ? BRAND.muted : delta >= 0 ? '#12A150' : '#DC2626',
        }}
      >
        {delta === null ? '無前期資料' : `${delta >= 0 ? '+' : ''}${delta}% 對比前期`}
      </Typography>
    </Pressable>
  );
}

export default function SellerAnalyticsScreen() {
  const userId = useUserId();
  const { data: store, isLoading: storeLoading } = useMyStoreQuery(userId);

  const [grain, setGrain] = useState<SalesGrain>('day');
  const [count, setCount] = useState(14);
  const [metric, setMetric] = useState<Metric>('revenue');

  const { data: report, isLoading } = useSellerSalesReport(userId, store?.id ?? null, {
    grain,
    count,
  });
  const { data: reviews } = useStoreReviews(store?.id ?? null);

  const reviewList = reviews ?? [];
  const buckets = ratingBreakdown(reviewList);
  const avgRating =
    reviewList.length > 0
      ? reviewList.reduce((sum, review) => sum + review.rating, 0) / reviewList.length
      : 0;
  const photoReviews = reviewList.filter((review) => review.images.length > 0).length;
  const unansweredReviews = reviewList.filter((review) => !review.seller_reply).length;

  const points = useMemo(
    () =>
      (report?.buckets ?? []).map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        value:
          metric === 'revenue'
            ? bucket.revenue
            : metric === 'orders'
              ? bucket.orders
              : bucket.views,
      })),
    [report, metric],
  );

  /* 換顆粒度時把範圍換成該顆粒度的中間選項，數字才不會突然變成 30 個月。 */
  const changeGrain = (next: SalesGrain) => {
    setGrain(next);
    setCount(RANGES[next][1].count);
  };

  if (!userId) {
    return <SignInRequired title="登入後查看銷售分析" />;
  }

  if (storeLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (!store) {
    return (
      <View className="bg-background flex-1">
        <View className="flex-1">
          <EmptyState
            icon={<BarChart3 size={26} color={BRAND.blue} />}
            title="還沒有店鋪數據"
            description="建立店鋪並上架商品後，這裡會顯示瀏覽、訂單與營收趨勢。"
          />
        </View>
        <SellerTabBar />
      </View>
    );
  }

  const formatMetric = (value: number) =>
    metric === 'revenue' ? formatPrice(value) : formatNumber(value);

  return (
    <View className="bg-background flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-3 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-surface gap-3 rounded-2xl p-4">
          <SegmentedControl items={GRAINS} value={grain} onChange={changeGrain} size="sm" />
          <View className="flex-row flex-wrap gap-2">
            {RANGES[grain].map((item) => (
              <SelectPill
                key={item.count}
                size="sm"
                tone="soft"
                label={item.label}
                selected={count === item.count}
                onPress={() => setCount(item.count)}
              />
            ))}
          </View>
          <Typography type="body-xs" color="muted">
            {report?.rangeLabel ?? '　'}
          </Typography>
        </View>

        <View className="flex-row gap-2">
          <MetricTile
            label="營收"
            value={formatPrice(report?.revenue ?? 0)}
            delta={report?.revenueDelta ?? null}
            icon={<Wallet size={13} color={BRAND.blue} />}
            selected={metric === 'revenue'}
            onPress={() => setMetric('revenue')}
          />
          <MetricTile
            label="訂單數"
            value={formatNumber(report?.orders ?? 0)}
            delta={report?.ordersDelta ?? null}
            icon={<Receipt size={13} color={BRAND.blue} />}
            selected={metric === 'orders'}
            onPress={() => setMetric('orders')}
          />
          <MetricTile
            label="瀏覽"
            value={formatCompact(report?.views ?? 0)}
            delta={report?.viewsDelta ?? null}
            icon={<Eye size={13} color={BRAND.blue} />}
            selected={metric === 'views'}
            onPress={() => setMetric('views')}
          />
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <View className="flex-row items-center justify-between gap-3">
            <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
              {metric === 'revenue' ? '營收趨勢' : metric === 'orders' ? '訂單數趨勢' : '瀏覽趨勢'}
            </Typography>
            <Typography type="body-xs" color="muted">
              平均客單價 {formatPrice(report?.avgOrderValue ?? 0)}
            </Typography>
          </View>

          {isLoading ? (
            <View className="h-32 items-center justify-center">
              <Spinner />
            </View>
          ) : (
            <BarChart
              points={points}
              formatValue={formatMetric}
              color={metric === 'views' ? BRAND.yellow : BRAND.blue}
            />
          )}
        </View>

        <View className="bg-surface gap-2 rounded-2xl p-4">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            期間訂單狀態
          </Typography>
          <View className="flex-row flex-wrap gap-x-4 gap-y-1">
            {STATUS_ORDER.map((status) => (
              <View key={status} className="flex-row items-center gap-1.5">
                <Typography type="body-xs" color="muted">
                  {ORDER_STATUS_LABEL[status]}
                </Typography>
                <Typography type="body-sm" className="text-navy" style={{ fontWeight: '700' }}>
                  {formatNumber(report?.statusCounts[status] ?? 0)}
                </Typography>
              </View>
            ))}
          </View>
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            期間熱門商品
          </Typography>
          {(report?.topProducts ?? []).length === 0 ? (
            <Typography type="body-sm" color="muted">
              這段期間還沒有成交紀錄，換個日期範圍看看。
            </Typography>
          ) : (
            (report?.topProducts ?? []).map((product, rank) => (
              <Pressable
                key={product.productId ?? product.title}
                className="flex-row items-center gap-3"
                disabled={!product.productId}
                onPress={() =>
                  product.productId
                    ? router.push({
                        pathname: '/products/[id]',
                        params: { id: product.productId },
                      })
                    : undefined
                }
              >
                <View className="bg-brand-blue-soft h-6 w-6 items-center justify-center rounded-full">
                  <Typography
                    type="body-xs"
                    className="text-brand-blue"
                    style={{ fontWeight: '700' }}
                  >
                    {rank + 1}
                  </Typography>
                </View>
                <AppImage uri={product.imageUrl} className="h-12 w-12 rounded-xl" />
                <View className="flex-1">
                  <Typography type="body-sm" numberOfLines={1} className="text-navy">
                    {product.title}
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    售出 {formatNumber(product.quantity)} 件
                  </Typography>
                </View>
                <Typography
                  type="body-sm"
                  className="text-brand-orange"
                  style={{ fontWeight: '600' }}
                >
                  {formatPrice(product.revenue)}
                </Typography>
              </Pressable>
            ))
          )}
        </View>

        {/* 評價概況：買家的星等與實拍照片，賣家不用一件一件商品點進去看。 */}
        <View className="bg-surface gap-3 rounded-2xl p-4">
          <View className="flex-row items-center justify-between">
            <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
              買家評價
            </Typography>
            <StarRating rating={avgRating} count={reviewList.length} />
          </View>

          {reviewList.length === 0 ? (
            <Typography type="body-sm" color="muted">
              還沒有買家評價。訂單完成後買家就能留下星等、照片與評語。
            </Typography>
          ) : (
            <>
              <View className="flex-row items-center gap-4">
                <View className="w-20 items-center">
                  <Typography type="h3" className="text-navy" style={{ fontWeight: '700' }}>
                    {avgRating.toFixed(1)}
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    {formatNumber(reviewList.length)} 則
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    {formatNumber(photoReviews)} 則有照片
                  </Typography>
                </View>
                <RatingBreakdown buckets={buckets} className="flex-1" />
              </View>

              <ReviewList
                reviews={reviewList.slice(0, 3).map((review) => ({
                  ...review,
                  productTitle: review.product?.title ?? null,
                }))}
              />
            </>
          )}

          <Button variant="secondary" size="sm" onPress={() => router.push('/seller/reviews')}>
            <Button.Label>
              {unansweredReviews > 0
                ? `回覆買家評價（${unansweredReviews} 則待回覆）`
                : '管理買家評價'}
            </Button.Label>
          </Button>
        </View>
      </ScrollView>

      <SellerTabBar />
    </View>
  );
}
