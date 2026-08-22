import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, Label, TextArea, Typography, useToast } from 'heroui-native';
import { useLocalSearchParams } from 'expo-router';
import { Star } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { FormError } from '@/components/FormError';
import { SignInRequired } from '@/components/SignInRequired';
import { useCreateReview, useProduct } from '@/lib/api/catalog';
import { BRAND } from '@/lib/brand';
import { goBackOrReplace } from '@/lib/navigation';
import { useUserId } from '@/lib/session';

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
  const [error, setError] = useState<string | null>(null);

  if (!userId) {
    return <SignInRequired title="登入後才能評價" />;
  }

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

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="p-4 gap-3" keyboardShouldPersistTaps="handled">
        <View className="bg-surface flex-row items-center gap-3 rounded-2xl p-4">
          <AppImage uri={product?.cover_url} className="h-16 w-16 rounded-xl" />
          <Typography type="body-sm" numberOfLines={2} className="text-navy flex-1">
            {product?.title ?? '商品'}
          </Typography>
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <Label>給幾顆星？</Label>
          <View className="flex-row gap-2">
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
          </View>

          <Label>評價內容（選填）</Label>
          <TextArea
            placeholder="分享商品品質、賣家服務與配送速度"
            value={comment}
            onChangeText={setComment}
            numberOfLines={5}
          />

          <FormError message={error} />

          <Button isDisabled={createReview.isPending} onPress={submit}>
            <Button.Label>{createReview.isPending ? '送出中…' : '送出評價'}</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
