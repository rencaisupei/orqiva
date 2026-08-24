import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, Label, Spinner, TextArea, Typography, useToast } from 'heroui-native';
import { useLocalSearchParams } from 'expo-router';
import { Camera, Star, X } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { FormError } from '@/components/FormError';
import { SignInRequired } from '@/components/SignInRequired';
import { useCreateReview, useProduct } from '@/lib/api/catalog';
import { pickImages, uploadImage } from '@/lib/api/upload';
import { BRAND } from '@/lib/brand';
import { goBackOrReplace } from '@/lib/navigation';
import { useUserId } from '@/lib/session';
import { MAX_REVIEW_IMAGES } from '@/lib/types';

/** 星等對應的一句話，讓買家知道自己選的分數代表什麼。 */
const RATING_HINT: Record<number, string> = {
  1: '很不滿意，想反映問題',
  2: '不太滿意，有明顯缺點',
  3: '普通，還可以接受',
  4: '滿意，小地方可以更好',
  5: '非常滿意，會再回購',
};

export default function ReviewScreen() {
  const { productId, orderId, orderItemId } = useLocalSearchParams<{
    productId: string;
    orderId?: string;
    orderItemId?: string;
  }>();
  const userId = useUserId();
  const { toast } = useToast();
  const { data: product } = useProduct(productId);
  const createReview = useCreateReview();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!userId) {
    return <SignInRequired title="登入後才能評價" />;
  }

  /* 照片挑完就直接上傳到 review-images：送出時只帶網址，按下送出不用等傳圖。 */
  const addPhotos = async () => {
    const remaining = MAX_REVIEW_IMAGES - images.length;
    if (remaining <= 0) return;
    setError(null);
    setUploading(true);
    try {
      const picked = await pickImages(remaining);
      const urls: string[] = [];
      for (const image of picked.slice(0, remaining)) {
        urls.push(await uploadImage('review-images', userId, image));
      }
      if (urls.length > 0) setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '照片上傳失敗，請再試一次');
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    setError(null);
    createReview.mutate(
      {
        productId,
        orderId: orderId ?? null,
        orderItemId: orderItemId ?? null,
        userId,
        rating,
        comment: comment.trim(),
        images,
      },
      {
        onSuccess: () => {
          toast.show({ variant: 'success', label: '感謝你的評價' });
          goBackOrReplace('/orders');
        },
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  const busy = createReview.isPending || uploading;

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="p-4 gap-3 pb-8" keyboardShouldPersistTaps="handled">
        <View className="bg-surface flex-row items-center gap-3 rounded-2xl p-4">
          <AppImage uri={product?.cover_url} className="h-16 w-16 rounded-xl" />
          <Typography type="body-sm" numberOfLines={2} className="text-navy flex-1">
            {product?.title ?? '商品'}
          </Typography>
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <Label>給幾顆星？</Label>
          <View className="flex-row items-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => setRating(value)}
                accessibilityLabel={`${value} 星`}
              >
                <Star
                  size={32}
                  color={BRAND.yellow}
                  fill={value <= rating ? BRAND.yellow : 'transparent'}
                />
              </Pressable>
            ))}
            <Typography type="body-xs" color="muted" className="ml-1 flex-1">
              {RATING_HINT[rating]}
            </Typography>
          </View>

          <Label>評價內容（選填）</Label>
          <TextArea
            placeholder="分享商品品質、賣家服務與配送速度"
            value={comment}
            onChangeText={setComment}
            numberOfLines={5}
          />

          <Label>實拍照片（選填，最多 {MAX_REVIEW_IMAGES} 張）</Label>
          <View className="flex-row flex-wrap gap-2">
            {images.map((url) => (
              <View key={url}>
                <AppImage uri={url} className="rounded-xl" style={{ width: 76, height: 76 }} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="移除照片"
                  hitSlop={6}
                  className="bg-navy/85 absolute -top-1.5 -right-1.5 h-6 w-6 items-center justify-center rounded-full"
                  onPress={() => setImages((prev) => prev.filter((item) => item !== url))}
                >
                  <X size={13} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}

            {images.length < MAX_REVIEW_IMAGES ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="新增照片"
                disabled={uploading}
                onPress={() => void addPhotos()}
                className="border-border items-center justify-center gap-1 rounded-xl border border-dashed"
                style={{
                  width: 76,
                  height: 76,
                  ...(Platform.OS === 'web' && !uploading ? { cursor: 'pointer' } : null),
                  ...(uploading ? { opacity: 0.6 } : null),
                }}
              >
                {uploading ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Camera size={20} color={BRAND.blue} />
                    <Typography type="body-xs" color="muted">
                      加照片
                    </Typography>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>

          <FormError message={error} />

          <Button isDisabled={busy} onPress={submit}>
            <Button.Label>
              {createReview.isPending ? '送出中…' : uploading ? '照片上傳中…' : '送出評價'}
            </Button.Label>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
