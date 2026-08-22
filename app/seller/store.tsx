import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import {
  Avatar,
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Separator,
  Spinner,
  TextArea,
  Typography,
  useToast,
} from 'heroui-native';
import { router } from 'expo-router';
import { Camera, Truck } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { SelectPill } from '@/components/SelectPill';
import { SignInRequired } from '@/components/SignInRequired';
import { useMyStoreQuery, useSellerShippingProfile, useUpdateStore } from '@/lib/api/seller';
import { pickImages, uploadImage } from '@/lib/api/upload';
import { BRAND } from '@/lib/brand';
import { useUserId } from '@/lib/session';
import { LOCATIONS, validateSenderCellPhone, validateSenderName } from '@/lib/types';

export default function StoreSettingsScreen() {
  const userId = useUserId();
  const { toast } = useToast();
  const { data: store, isLoading } = useMyStoreQuery(userId);
  const { data: shippingProfile, isLoading: profileLoading } = useSellerShippingProfile(userId);
  const updateStore = useUpdateStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [senderName, setSenderName] = useState('');
  const [senderCellPhone, setSenderCellPhone] = useState('');
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

  useEffect(() => {
    if (shippingProfile) {
      setSenderName(shippingProfile.sender_name);
      setSenderCellPhone(shippingProfile.sender_cell_phone);
    }
  }, [shippingProfile]);

  if (!userId) {
    return <SignInRequired title="登入後管理店舖" />;
  }

  if (isLoading || profileLoading) {
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
    const nameError = validateSenderName(senderName);
    if (nameError) {
      setError(nameError);
      return;
    }
    const phoneError = validateSenderCellPhone(senderCellPhone);
    if (phoneError) {
      setError(phoneError);
      return;
    }
    setError(null);
    updateStore.mutate(
      {
        userId,
        storeId: store.id,
        name: name.trim(),
        description: description.trim(),
        location,
        logoUrl,
        senderName,
        senderCellPhone,
      },
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
                <SelectPill
                  key={item}
                  size="sm"
                  label={item}
                  selected={location === item}
                  onPress={() => setLocation(item)}
                />
              ))}
            </View>
          </View>
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <View className="flex-row items-center gap-2">
            <Truck size={16} color={BRAND.blue} />
            <Typography type="body" className="text-navy flex-1" style={{ fontWeight: '600' }}>
              寄件人資訊（超商取貨必填）
            </Typography>
          </View>
          <Typography type="body-xs" color="muted">
            建立超商取貨物流單時會用這組資料當寄件人。C2C
            退貨需憑本人身分證領取，請填你本人的姓名與手機，不要填店舖名稱。這兩個欄位只有你自己與平台管理員看得到。
          </Typography>

          <Separator />

          <View>
            <Label isRequired>寄件人姓名（本名）</Label>
            <Input
              placeholder="2~5 個字，例如：王小明"
              value={senderName}
              onChangeText={(value) => setSenderName(value.slice(0, 5))}
            />
            <Description>需與身分證相同，長度 2~5 個字。</Description>
          </View>

          <View>
            <Label isRequired>寄件人手機</Label>
            <Input
              placeholder="09xxxxxxxx"
              keyboardType="number-pad"
              value={senderCellPhone}
              onChangeText={(value) => setSenderCellPhone(value.replace(/\D/g, '').slice(0, 10))}
            />
            <Description>只允許數字、10 碼、09 開頭；綠界會用這支手機發送物流通知。</Description>
          </View>

          {!shippingProfile ? (
            <Typography type="body-xs" className="text-brand-orange">
              尚未填寫寄件人資訊，填好並儲存後才能建立超商取貨物流單。
            </Typography>
          ) : null}
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
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
