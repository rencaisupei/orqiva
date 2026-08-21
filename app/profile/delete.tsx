import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, Description, FieldError, Input, Label, Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';

import { SignInRequired } from '@/components/SignInRequired';
import { useAccountDeletionSummary, useDeleteAccount } from '@/lib/api/account';
import { BRAND } from '@/lib/brand';
import { useSessionStore, useUserId } from '@/lib/session';

const REMOVED_ITEMS = [
  '個人資料、頭像與登入帳號',
  '購物車、收藏、通知與推播裝置',
  '聊天對話與商品評價',
  '賣家店舖與所有上架商品',
  '已完成或已取消的訂單紀錄',
];

export default function DeleteAccountScreen() {
  const userId = useUserId();
  const signOut = useSessionStore((s) => s.signOut);
  const summary = useAccountDeletionSummary(!!userId);
  const remove = useDeleteAccount();

  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!userId) {
    return (
      <View className="bg-background flex-1">
        <SignInRequired title="登入後才能刪除帳號" />
      </View>
    );
  }

  if (summary.isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  const data = summary.data;
  const phrase = data?.confirmPhrase ?? '刪除帳號';
  const activeOrders = (data?.activeAsBuyer ?? 0) + (data?.activeAsSeller ?? 0);
  const blocked = activeOrders > 0;

  const submit = () => {
    if (confirm.trim() !== phrase) {
      setError(`請逐字輸入「${phrase}」以確認`);
      return;
    }
    setError(null);
    remove.mutate(confirm.trim(), {
      onSuccess: () => {
        void (async () => {
          await signOut();
          router.replace('/(tabs)');
        })();
      },
      onError: (err: Error) => setError(err.message),
    });
  };

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="p-4 gap-3 pb-8" keyboardShouldPersistTaps="handled">
        <View className="bg-surface flex-row items-center gap-3 rounded-2xl p-4">
          <View className="bg-brand-blue-soft h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <TriangleAlert size={20} color={BRAND.orange} />
          </View>
          <View className="flex-1">
            <Typography type="body" className="text-navy" style={{ fontWeight: '700' }}>
              永久刪除帳號
            </Typography>
            <Typography type="body-xs" color="muted">
              刪除後無法復原，也無法用同一組資料把帳號要回來。
            </Typography>
          </View>
        </View>

        <View className="bg-surface gap-2 rounded-2xl p-4">
          <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
            會被刪除的資料
          </Typography>
          {REMOVED_ITEMS.map((item) => (
            <Typography key={item} type="body-sm" color="muted">
              ・{item}
            </Typography>
          ))}
          <Typography type="body-xs" color="muted" className="mt-1">
            依法需保留的交易與客服紀錄會去除個人識別資料後保存，不再與你的身分連結。
          </Typography>
        </View>

        <View className="bg-surface gap-2 rounded-2xl p-4">
          <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
            目前帳號
          </Typography>
          <Typography type="body-sm" color="muted">
            {data?.email ?? '—'}
          </Typography>
          <Typography type="body-xs" color="muted">
            訂單紀錄：買家 {data?.ordersAsBuyer ?? 0} 筆 · 賣家 {data?.ordersAsSeller ?? 0} 筆
          </Typography>
          {data?.storeName ? (
            <Typography type="body-xs" color="muted">
              賣家店舖「{data.storeName}」與 {data.products} 件商品會一併下架刪除
            </Typography>
          ) : null}
        </View>

        {blocked ? (
          <View className="bg-surface gap-1 rounded-2xl p-4">
            <Typography type="body-sm" className="text-danger" style={{ fontWeight: '600' }}>
              還有 {activeOrders} 筆進行中的訂單
            </Typography>
            <Typography type="body-sm" color="muted">
              待付款、備貨中或已出貨的訂單必須先完成或取消，才能刪除帳號，以免造成另一方的損失。
            </Typography>
            <Button variant="secondary" className="mt-2" onPress={() => router.push('/orders')}>
              <Button.Label>查看我的訂單</Button.Label>
            </Button>
          </View>
        ) : (
          <View className="bg-surface gap-2 rounded-2xl p-4">
            <Label isRequired>確認文字</Label>
            <Input
              placeholder={phrase}
              value={confirm}
              autoCapitalize="none"
              onChangeText={setConfirm}
            />
            <Description>請逐字輸入「{phrase}」，避免誤觸。</Description>
          </View>
        )}

        {error ? <FieldError>{error}</FieldError> : null}
      </ScrollView>

      {blocked ? null : (
        <View className="border-border bg-surface pb-safe-offset-3 border-t px-4 py-3">
          <Button
            className="bg-danger"
            isDisabled={remove.isPending || confirm.trim() !== phrase}
            onPress={submit}
          >
            <Button.Label className="text-white">
              {remove.isPending ? '刪除中…' : '永久刪除我的帳號'}
            </Button.Label>
          </Button>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
