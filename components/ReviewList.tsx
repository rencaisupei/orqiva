import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Separator, Typography } from 'heroui-native';
import { X } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { StarRating } from '@/components/StarRating';
import { BRAND } from '@/lib/brand';
import { formatDate } from '@/lib/format';
import type { Review } from '@/lib/types';

/** 一則評價 + 可選的商品標題（賣家分析頁一次看整間店的評價時需要）。 */
type Props = {
  reviews: (Review & { productTitle?: string | null })[];
  /** 顯示 buyer 頭像。賣家分析頁的窄卡片可以關掉。 */
  showAvatar?: boolean;
};

/**
 * 評價清單（買家名稱、星等、文字、實拍照片）。
 *
 * 照片點下去用全螢幕 Modal 放大：買家看實拍圖是評價的重點，縮圖看不出東西。
 * 商品頁與賣家分析頁共用這一份，兩邊的評價長相才會一致。
 */
export function ReviewList({ reviews, showAvatar = true }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <View className="gap-3">
      {reviews.map((review) => (
        <View key={review.id} className="gap-2">
          <Separator />
          <View className="flex-row items-center gap-2 pt-1">
            {showAvatar ? (
              <AppImage
                uri={review.profile?.avatar_url}
                className="h-7 w-7 rounded-full"
                placeholderSize={12}
              />
            ) : null}
            <Typography
              type="body-sm"
              numberOfLines={1}
              className="text-navy flex-1"
              style={{ fontWeight: '600' }}
            >
              {review.profile?.display_name ?? '買家'}
            </Typography>
            <StarRating rating={review.rating} showCount={false} />
          </View>

          {review.productTitle ? (
            <Typography type="body-xs" color="muted" numberOfLines={1}>
              {review.productTitle}
            </Typography>
          ) : null}

          <Typography type="body-sm" color="muted">
            {review.comment || '（未填寫評語）'}
          </Typography>

          {review.images.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {review.images.map((url) => (
                <Pressable
                  key={url}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="放大照片"
                  onPress={() => setPreview(url)}
                >
                  <AppImage uri={url} className="rounded-xl" style={{ width: 72, height: 72 }} />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <Typography type="body-xs" color="muted">
            {formatDate(review.created_at)}
          </Typography>
        </View>
      ))}

      <Modal
        visible={preview !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/90 p-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="關閉"
            className="absolute top-12 right-5 h-10 w-10 items-center justify-center rounded-full bg-white/15"
            onPress={() => setPreview(null)}
          >
            <X size={20} color="#FFFFFF" />
          </Pressable>
          {preview ? (
            <AppImage
              uri={preview}
              resizeMode="contain"
              className="w-full"
              style={{ width: '100%', height: '70%', backgroundColor: 'transparent' }}
            />
          ) : null}
          <Typography type="body-xs" className="mt-3" style={{ color: BRAND.border }}>
            點右上角關閉
          </Typography>
        </View>
      </Modal>
    </View>
  );
}
