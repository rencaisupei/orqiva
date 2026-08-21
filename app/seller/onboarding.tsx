import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import {
  Avatar,
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  Separator,
  TextArea,
  Typography,
  useToast,
} from 'heroui-native';
import { router } from 'expo-router';
import { Camera, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react-native';

import { SignInRequired } from '@/components/SignInRequired';
import { useCreateStore, useMyStoreQuery } from '@/lib/api/seller';
import { pickImages, uploadImage } from '@/lib/api/upload';
import { BRAND } from '@/lib/brand';
import { useUserId } from '@/lib/session';
import { LOCATIONS } from '@/lib/types';

export default function SellerOnboardingScreen() {
  const userId = useUserId();
  const { toast } = useToast();
  const { data: existingStore } = useMyStoreQuery(userId);
  const createStore = useCreateStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!userId) {
    return <SignInRequired title="登入後申請成為賣家" />;
  }

  if (existingStore) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 px-8">
        <ShieldCheck size={40} color={BRAND.blue} />
        <Typography type="h5" align="center" className="text-navy">
          你已經有 ORQIVA 店舖
        </Typography>
        <Typography type="body-sm" align="center" color="muted">
          {existingStore.name}
        </Typography>
        <Button onPress={() => router.replace('/seller')}>
          <Button.Label>前往賣家中心</Button.Label>
        </Button>
      </View>
    );
  }

  const uploadLogo = async () => {
    try {
      setUploading(true);
      const picked = await pickImages(1);
      if (picked.length === 0) return;
      const url = await uploadImage('store-assets', userId, picked[0]);
      setLogoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗');
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (!name.trim()) {
      setError('請填寫店舖名稱');
      return;
    }
    setError(null);
    createStore.mutate(
      { userId, name: name.trim(), description: description.trim(), location, logoUrl },
      {
        onSuccess: () => {
          toast.show({ variant: 'success', label: '店舖建立成功' });
          router.replace('/seller');
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
      <ScrollView contentContainerClassName="p-4 gap-3 pb-8" keyboardShouldPersistTaps="handled">
        <View className="bg-surface gap-2 rounded-2xl p-4">
          <Typography type="h5" className="text-navy" style={{ fontWeight: '700' }}>
            成為 ORQIVA 賣家
          </Typography>
          <Typography type="body-sm" color="muted">
            買賣，不只是交易。是讓價值找到彼此。
          </Typography>
          <Separator className="my-1" />
          <View className="flex-row items-center gap-2">
            <Sparkles size={15} color={BRAND.orange} />
            <Typography type="body-sm" className="text-navy flex-1">
              同一個帳號同時是買家與賣家，不需要另外註冊
            </Typography>
          </View>
          <View className="flex-row items-center gap-2">
            <TrendingUp size={15} color={BRAND.orange} />
            <Typography type="body-sm" className="text-navy flex-1">
              賣家中心可查看瀏覽、訂單、營收與評價
            </Typography>
          </View>
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <View className="items-center gap-2">
            <Avatar size="lg" alt={name || '店舖'}>
              {logoUrl ? <Avatar.Image source={{ uri: logoUrl }} /> : null}
              <Avatar.Fallback />
            </Avatar>
            <Pressable
              className="flex-row items-center gap-1.5"
              disabled={uploading}
              onPress={() => void uploadLogo()}
            >
              <Camera size={14} color={BRAND.blue} />
              <Typography type="body-sm" className="text-brand-blue">
                {uploading ? '上傳中…' : '上傳店舖 Logo'}
              </Typography>
            </Pressable>
          </View>

          <View>
            <Label isRequired>店舖名稱</Label>
            <Input placeholder="例如：歐奇瓦 3C 嚴選" value={name} onChangeText={setName} />
          </View>

          <View>
            <Label>店舖介紹</Label>
            <TextArea
              placeholder="介紹你的商品類型、出貨速度與服務"
              value={description}
              onChangeText={setDescription}
              numberOfLines={4}
            />
          </View>

          <View className="gap-2">
            <Label>店舖所在地</Label>
            <View className="flex-row flex-wrap gap-2">
              {LOCATIONS.map((item) => (
                <Pressable key={item} onPress={() => setLocation(item)}>
                  <Chip size="sm" variant={location === item ? 'primary' : 'tertiary'}>
                    {item}
                  </Chip>
                </Pressable>
              ))}
            </View>
          </View>

          {error ? <FieldError>{error}</FieldError> : null}

          <Button isDisabled={createStore.isPending} onPress={submit}>
            <Button.Label>{createStore.isPending ? '建立中…' : '建立店舖'}</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
