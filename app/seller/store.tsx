import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import {
  Avatar,
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  Spinner,
  TextArea,
  Typography,
  useToast,
} from 'heroui-native';
import { router } from 'expo-router';
import { Camera } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { SignInRequired } from '@/components/SignInRequired';
import { useMyStoreQuery, useUpdateStore } from '@/lib/api/seller';
import { pickImages, uploadImage } from '@/lib/api/upload';
import { BRAND } from '@/lib/brand';
import { useUserId } from '@/lib/session';
import { LOCATIONS } from '@/lib/types';

export default function StoreSettingsScreen() {
  const userId = useUserId();
  const { toast } = useToast();
  const { data: store, isLoading } = useMyStoreQuery(userId);
  const updateStore = useUpdateStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (store) {
      setName(store.name);
      setDescription(store.description ?? '');
      setLocation(store.location);
      setLogoUrl(store.logo_url);
    }
  }, [store]);

  if (!userId) {
    return <SignInRequired title="登入後管理店舖" />;
  }

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (!store) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          title="還沒有店舖"
          description="先建立店舖才能設定名稱、Logo 與介紹。"
          action={
            <Button onPress={() => router.replace('/seller/onboarding')}>
              <Button.Label>建立店舖</Button.Label>
            </Button>
          }
        />
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

  const save = () => {
    if (!name.trim()) {
      setError('請填寫店舖名稱');
      return;
    }
    setError(null);
    updateStore.mutate(
      { storeId: store.id, name: name.trim(), description: description.trim(), location, logoUrl },
      {
        onSuccess: () => toast.show({ variant: 'success', label: '店舖資料已更新' }),
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
        <View className="bg-surface gap-3 rounded-2xl p-4">
          <View className="items-center gap-2">
            <Avatar size="lg" alt={name}>
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
                {uploading ? '上傳中…' : '更換店舖 Logo'}
              </Typography>
            </Pressable>
          </View>

          <View>
            <Label isRequired>店舖名稱</Label>
            <Input value={name} onChangeText={setName} />
          </View>

          <View>
            <Label>店舖介紹</Label>
            <TextArea value={description} onChangeText={setDescription} numberOfLines={4} />
          </View>

          <View className="gap-2">
            <Label>店舖所在地</Label>
            <View className="flex-row flex-wrap gap-2">
              {LOCATIONS.map((item) => (
                <Chip
                  key={item}
                  size="sm"
                  variant={location === item ? 'primary' : 'tertiary'}
                  onPress={() => setLocation(item)}
                >
                  {item}
                </Chip>
              ))}
            </View>
          </View>

          {error ? <FieldError>{error}</FieldError> : null}

          <Button isDisabled={updateStore.isPending} onPress={save}>
            <Button.Label>{updateStore.isPending ? '儲存中…' : '儲存變更'}</Button.Label>
          </Button>
          <Button
            variant="secondary"
            onPress={() => router.push({ pathname: '/store/[id]', params: { id: store.id } })}
          >
            <Button.Label>預覽店舖頁面</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
