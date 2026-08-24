import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { Camera } from 'lucide-react-native';

import { RatingBreakdown } from '@/components/RatingBreakdown';
import { ReviewList } from '@/components/ReviewList';
import { SelectPill } from '@/components/SelectPill';
import { StarRating } from '@/components/StarRating';
import { useProductReviews } from '@/lib/api/catalog';
import { BRAND } from '@/lib/brand';
import { formatNumber } from '@/lib/format';
import { ratingBreakdown, type Review } from '@/lib/types';

type Filter = 'all' | 'photos' | 'good' | 'bad';

/** 一開始只展開三則，避免評價把商品頁撐得很長。 */
const PREVIEW_COUNT = 3;

function matches(review: Review, filter: Filter): boolean {
  if (filter === 'photos') return review.images.length > 0;
  if (filter === 'good') return review.rating >= 4;
  if (filter === 'bad') return review.rating <= 3;
  return true;
}

/**
 * 商品頁的「商品評價」區塊：平均星等、星等分佈、買家實拍照片與評語。
 *
 * 篩選膠囊只顯示真的有內容的那幾個（例如沒有人上傳照片就不會出現「有照片」），
 * 避免買家點了一個必然是空的條件。
 */
export function ProductReviews({
  productId,
  rating,
  ratingCount,
}: {
  productId: string;
  rating: number;
  ratingCount: number;
}) {
  const { data: reviews } = useProductReviews(productId);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState(false);

  const list = useMemo(() => reviews ?? [], [reviews]);
  const buckets = useMemo(() => ratingBreakdown(list), [list]);

  const counts = useMemo(
    () => ({
      all: list.length,
      photos: list.filter((review) => review.images.length > 0).length,
      good: list.filter((review) => review.rating >= 4).length,
      bad: list.filter((review) => review.rating <= 3).length,
    }),
    [list],
  );

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `全部 ${counts.all}` },
    ...(counts.photos > 0 ? [{ key: 'photos' as Filter, label: `有照片 ${counts.photos}` }] : []),
    ...(counts.good > 0 ? [{ key: 'good' as Filter, label: `好評 ${counts.good}` }] : []),
    ...(counts.bad > 0 ? [{ key: 'bad' as Filter, label: `三星以下 ${counts.bad}` }] : []),
  ];

  const filtered = list.filter((review) => matches(review, filter));
  const visible = expanded ? filtered : filtered.slice(0, PREVIEW_COUNT);
  const photoTotal = list.reduce((sum, review) => sum + review.images.length, 0);

  return (
    <View className="bg-surface mt-3 gap-3 p-4">
      <View className="flex-row items-center justify-between">
        <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
          商品評價
        </Typography>
        <StarRating rating={rating} count={ratingCount} />
      </View>

      {list.length === 0 ? (
        <Typography type="body-sm" color="muted">
          目前還沒有買家評價，完成訂單後即可留下評價。
        </Typography>
      ) : (
        <>
          {/* 左邊是平均分，右邊是分佈：一眼看出「四星多還是一星多」。 */}
          <View className="flex-row items-center gap-4">
            <View className="w-20 items-center">
              <Typography type="h3" className="text-navy" style={{ fontWeight: '700' }}>
                {rating > 0 ? rating.toFixed(1) : '—'}
              </Typography>
              <StarRating rating={rating} showCount={false} size={11} />
              <Typography type="body-xs" color="muted">
                {formatNumber(list.length)} 則評價
              </Typography>
              {photoTotal > 0 ? (
                <View className="mt-1 flex-row items-center gap-1">
                  <Camera size={11} color={BRAND.muted} />
                  <Typography type="body-xs" color="muted">
                    {formatNumber(photoTotal)} 張實拍
                  </Typography>
                </View>
              ) : null}
            </View>
            <RatingBreakdown buckets={buckets} className="flex-1" />
          </View>

          {filters.length > 1 ? (
            <View className="flex-row flex-wrap gap-2">
              {filters.map((item) => (
                <SelectPill
                  key={item.key}
                  size="sm"
                  tone="soft"
                  label={item.label}
                  selected={filter === item.key}
                  onPress={() => {
                    setFilter(item.key);
                    setExpanded(false);
                  }}
                />
              ))}
            </View>
          ) : null}

          <ReviewList reviews={visible} />

          {filtered.length > PREVIEW_COUNT ? (
            <Button size="sm" variant="tertiary" onPress={() => setExpanded((prev) => !prev)}>
              <Button.Label>
                {expanded ? '收起評價' : `看全部 ${formatNumber(filtered.length)} 則評價`}
              </Button.Label>
            </Button>
          ) : null}
        </>
      )}
    </View>
  );
}
