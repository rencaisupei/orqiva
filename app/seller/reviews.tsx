import { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { Button, Spinner, TextArea, Typography } from 'heroui-native';
import { useBrandToast } from '@/components/brand/BrandToast';
import { MessageSquareQuote, Star } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { RatingBreakdown } from '@/components/RatingBreakdown';
import { ReviewList } from '@/components/ReviewList';
import { SelectPill } from '@/components/SelectPill';
import { SellerTabBar } from '@/components/SellerTabBar';
import { SignInRequired } from '@/components/SignInRequired';
import { StarRating } from '@/components/StarRating';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useMyStoreQuery, useReplyToReview, useStoreReviews } from '@/lib/api/seller';
import { BRAND } from '@/lib/brand';
import { formatNumber } from '@/lib/format';
import { useUserId } from '@/lib/session';
import { MAX_REVIEW_REPLY, ratingBreakdown, type Review, type StoreReview } from '@/lib/types';

type Filter = 'unanswered' | 'all' | 'answered' | 'photos' | 'low';

const FILTER_LABEL: Record<Filter, string> = {
  unanswered: '待回覆',
  all: '全部',
  answered: '已回覆',
  photos: '有照片',
  low: '三星以下',
};

function matches(review: StoreReview, filter: Filter): boolean {
  switch (filter) {
    case 'unanswered':
      return !review.seller_reply;
    case 'answered':
      return !!review.seller_reply;
    case 'photos':
      return review.images.length > 0;
    case 'low':
      return review.rating <= 3;
    default:
      return true;
  }
}

/**
 * 賣家的評價管理：看整間店的買家評價並公開回覆。
 *
 * 回覆走 notify 函式（service key）而不是直接 update reviews —— RLS 沒辦法限制
 * 可寫的欄位，給賣家 update 政策等於讓他們改得動買家的星等與評語。
 */
export default function SellerReviewsScreen() {
  const userId = useUserId();
  const { toast } = useBrandToast();
  const { data: store, isLoading: storeLoading } = useMyStoreQuery(userId);
  const { data: reviews, isLoading } = useStoreReviews(store?.id ?? null);
  const replyToReview = useReplyToReview();
  const { refreshing, onRefresh } = usePullToRefresh();

  const [filter, setFilter] = useState<Filter>('unanswered');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const list = reviews ?? [];
  const counts: Record<Filter, number> = {
    all: list.length,
    unanswered: list.filter((review) => matches(review, 'unanswered')).length,
    answered: list.filter((review) => matches(review, 'answered')).length,
    photos: list.filter((review) => matches(review, 'photos')).length,
    low: list.filter((review) => matches(review, 'low')).length,
  };
  const filtered = list.filter((review) => matches(review, filter));
  const avgRating =
    list.length > 0 ? list.reduce((sum, review) => sum + review.rating, 0) / list.length : 0;

  if (!userId) {
    return <SignInRequired title="登入後回覆買家評價" />;
  }

  if (storeLoading || isLoading) {
    // 分頁列留著，否則整條底部導覽會在換頁時消失一下。
    return (
      <View className="bg-background flex-1">
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
        <SellerTabBar />
      </View>
    );
  }

  if (!store) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          icon={<MessageSquareQuote size={26} color={BRAND.blue} />}
          title="還沒有店鋪"
          description="建立店鋪並完成第一筆訂單後，買家的評價會出現在這裡。"
        />
        <SellerTabBar />
      </View>
    );
  }

  const startReply = (review: Review) => {
    setActiveId(review.id);
    setDraft(review.seller_reply ?? '');
  };

  const closeReply = () => {
    setActiveId(null);
    setDraft('');
  };

  const submit = (review: Review, text: string) => {
    replyToReview.mutate(
      { reviewId: review.id, productId: review.product_id, reply: text },
      {
        onSuccess: (result) => {
          closeReply();
          toast.show({
            variant: 'success',
            label: text
              ? result.notified
                ? '回覆已送出，買家會收到通知'
                : '回覆已更新'
              : '回覆已刪除',
          });
        },
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  const renderAction = (review: Review) => {
    if (activeId === review.id) {
      const text = draft.trim();
      return (
        <View className="gap-2">
          <TextArea
            value={draft}
            onChangeText={setDraft}
            numberOfLines={4}
            maxLength={MAX_REVIEW_REPLY}
            placeholder="謝謝你的回饋…（買家會在商品頁看到這段回覆）"
          />
          <View className="flex-row items-center gap-2">
            <Typography type="body-xs" color="muted" className="flex-1">
              {text.length} / {MAX_REVIEW_REPLY}
            </Typography>
            <Button size="sm" variant="tertiary" onPress={closeReply}>
              <Button.Label>取消</Button.Label>
            </Button>
            <Button
              size="sm"
              isDisabled={replyToReview.isPending || text.length === 0}
              onPress={() => submit(review, text)}
            >
              <Button.Label>{replyToReview.isPending ? '送出中…' : '送出回覆'}</Button.Label>
            </Button>
          </View>
        </View>
      );
    }

    return (
      <View className="flex-row gap-2">
        <Button size="sm" variant="secondary" onPress={() => startReply(review)}>
          <Button.Label>{review.seller_reply ? '編輯回覆' : '回覆買家'}</Button.Label>
        </Button>
        {review.seller_reply ? (
          <Button
            size="sm"
            variant="danger-soft"
            isDisabled={replyToReview.isPending}
            onPress={() => submit(review, '')}
          >
            <Button.Label>刪除回覆</Button.Label>
          </Button>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-3 pb-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND.blue}
            colors={[BRAND.blue]}
          />
        }
      >
        <View className="bg-surface gap-3 rounded-2xl p-4">
          <View className="flex-row items-center justify-between gap-3">
            <Typography
              type="body"
              numberOfLines={1}
              className="text-navy flex-1"
              style={{ fontWeight: '600' }}
            >
              {store.name} 的買家評價
            </Typography>
            <StarRating rating={avgRating} count={list.length} />
          </View>

          {list.length === 0 ? (
            <Typography type="body-sm" color="muted">
              還沒有買家評價。訂單完成後買家就能留下星等、照片與評語，你可以在這裡回覆。
            </Typography>
          ) : (
            <>
              <View className="flex-row items-center gap-4">
                <View className="w-20 items-center">
                  <Typography type="h3" className="text-navy" style={{ fontWeight: '700' }}>
                    {avgRating.toFixed(1)}
                  </Typography>
                  <View className="flex-row items-center gap-1">
                    <Star size={11} color={BRAND.yellow} fill={BRAND.yellow} />
                    <Typography type="body-xs" color="muted">
                      {formatNumber(list.length)} 則
                    </Typography>
                  </View>
                  <Typography type="body-xs" className="text-brand-orange">
                    {formatNumber(counts.unanswered)} 則待回覆
                  </Typography>
                </View>
                <RatingBreakdown buckets={ratingBreakdown(list)} className="flex-1" />
              </View>

              <View className="flex-row flex-wrap gap-2">
                {(['unanswered', 'all', 'answered', 'photos', 'low'] as Filter[])
                  .filter((key) => key === 'all' || counts[key] > 0)
                  .map((key) => (
                    <SelectPill
                      key={key}
                      size="sm"
                      tone="soft"
                      label={`${FILTER_LABEL[key]} ${counts[key]}`}
                      selected={filter === key}
                      onPress={() => {
                        setFilter(key);
                        closeReply();
                      }}
                    />
                  ))}
              </View>
            </>
          )}
        </View>

        {list.length > 0 ? (
          <View className="bg-surface gap-3 rounded-2xl p-4">
            {filtered.length === 0 ? (
              <Typography type="body-sm" color="muted">
                這個篩選目前沒有評價，換一個看看。
              </Typography>
            ) : (
              <ReviewList
                renderAction={renderAction}
                reviews={filtered.map((review) => ({
                  ...review,
                  productTitle: review.product?.title ?? null,
                }))}
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      <SellerTabBar />
    </KeyboardAvoidingView>
  );
}
