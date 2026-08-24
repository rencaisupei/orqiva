import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import {
  Avatar,
  Button,
  Description,
  Input,
  Label,
  Separator,
  TextArea,
  Typography,
  useToast,
} from 'heroui-native';
import { router } from 'expo-router';
import { Camera, ShieldCheck, Sparkles, TrendingUp, Truck } from 'lucide-react-native';

import { EcpaySignupGuide } from '@/components/EcpaySignupGuide';
import { FormError } from '@/components/FormError';
import { SelectPill } from '@/components/SelectPill';
import { SignInRequired } from '@/components/SignInRequired';
import { useCreateStore, useMyStoreQuery } from '@/lib/api/seller';
import { pickImages, uploadImage } from '@/lib/api/upload';
import { BrandText } from '@/components/brand/BrandText';
import { BRAND } from '@/lib/brand';
import { useUserId } from '@/lib/session';
import { LOCATIONS, validateSenderCellPhone, validateSenderName } from '@/lib/types';

export default function SellerOnboardingScreen() {
  const userId = useUserId();
  const { toast } = useToast();
  const { data: existingStore } = useMyStoreQuery(userId);
  const createStore = useCreateStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [senderName, setSenderName] = useState('');
  const [senderCellPhone, setSenderCellPhone] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!userId) {
    return <SignInRequired title="登入後申請成為賣家" />;
  }

  if (existingStore) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 px-8">
        <ShieldCheck size={40} color={BRAND.blue} />
        <BrandText type="h5" align="center" className="text-navy">
          你已經有極貨網店舖
        </BrandText>
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
    createStore.mutate(
      {
        userId,
        name: name.trim(),
        description: description.trim(),
        location,
        logoUrl,
        senderName,
        senderCellPhone,
      },
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
          <BrandText type="h5" className="text-navy" style={{ fontWeight: '700' }}>
            成為極貨網賣家
          </BrandText>
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

        <EcpaySignupGuide showBackfillGuide={false} />

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
            <Input placeholder="例如：極貨網 3C 嚴選" value={name} onChangeText={setName} />
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

          <Separator className="my-1" />

          <View className="flex-row items-center gap-2">
            <Truck size={16} color={BRAND.blue} />
            <Typography type="body" className="text-navy flex-1" style={{ fontWeight: '600' }}>
              寄件人資訊（超商取貨必填）
            </Typography>
          </View>
          <Typography type="body-xs" color="muted">
            超商取貨的物流單會以這組資料當寄件人，退貨時需憑本人身分證領取，請填你本人的姓名與手機，不要填店舖名稱。只有你自己與平台管理員看得到。
          </Typography>

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
            <Description>只允許數字、10 碼、09 開頭。</Description>
          </View>

          <FormError message={error} />

          <Button isDisabled={createStore.isPending} onPress={submit}>
            <Button.Label>{createStore.isPending ? '建立中…' : '建立店舖'}</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
