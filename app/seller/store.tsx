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
import { Camera, KeyRound, Truck } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { SelectPill } from '@/components/SelectPill';
import { SellerLogisticsStatusCard } from '@/components/SellerLogisticsStatusCard';
import { SignInRequired } from '@/components/SignInRequired';
import { useSellerEcpaySettings } from '@/lib/api/logistics';
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
  const { data: ecpaySettings } = useSellerEcpaySettings(userId);
  const updateStore = useUpdateStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [senderName, setSenderName] = useState('');
  const [senderCellPhone, setSenderCellPhone] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [hashKey, setHashKey] = useState('');
  const [hashIv, setHashIv] = useState('');
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

  // 商店代號可以帶回來（不是機密），HashKey / HashIV 永遠不回傳，只顯示「已設定」。
  useEffect(() => {
    if (ecpaySettings?.ecpay.merchantId) setMerchantId(ecpaySettings.ecpay.merchantId);
  }, [ecpaySettings?.ecpay.merchantId]);

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

  const hasStoredKeys = ecpaySettings?.ecpay.hasHashKey === true && ecpaySettings?.ecpay.hasHashIv;
  const hadCredentials = !!ecpaySettings?.ecpay.merchantId || hasStoredKeys;
  const ecpayTouched =
    merchantId.trim().length > 0 || hashKey.trim().length > 0 || hashIv.trim().length > 0;

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
    if (ecpayTouched) {
      if (!/^\d{4,10}$/.test(merchantId.trim())) {
        setError('綠界商店代號需為 4~10 位數字（例如 2000933）');
        return;
      }
      if (!hasStoredKeys && (hashKey.trim().length < 8 || hashIv.trim().length < 8)) {
        setError('請填寫綠界 HashKey 與 HashIV（各 8 個字元以上）');
        return;
      }
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
        // 只有動過這三欄、或原本就有金鑰（可能是要清空）時才送，避免每次存店名都重打綠界。
        ecpay:
          ecpayTouched || hadCredentials
            ? { merchantId: merchantId.trim(), hashKey: hashKey.trim(), hashIv: hashIv.trim() }
            : undefined,
      },
      {
        onSuccess: () => {
          setHashKey('');
          setHashIv('');
          toast.show({ variant: 'success', label: '已儲存並重新檢查開通狀態' });
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

          <SellerLogisticsStatusCard profile={shippingProfile} showSettingsLink={false} />
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <View className="flex-row items-center gap-2">
            <KeyRound size={16} color={BRAND.blue} />
            <Typography type="body" className="text-navy flex-1" style={{ fontWeight: '600' }}>
              綠界物流帳號（超商取貨必填）
            </Typography>
          </View>
          <Typography type="body-xs" color="muted">
            填入你自己的綠界特店資料，物流單就會建立在你的綠界帳號下（物流費用、代收貨款與退件都歸你）。
            在綠界廠商後台的「系統開發管理 → 系統介面設定」可以查到這三項。金鑰只會存在伺服器端，
            存好之後不會再回傳給任何裝置，連你自己也只看得到「已設定」。
          </Typography>

          <Separator />

          <View>
            <Label isRequired>綠界商店代號（MerchantID）</Label>
            <Input
              placeholder="例如 2000933"
              keyboardType="number-pad"
              inputMode="numeric"
              value={merchantId}
              onChangeText={(value) => setMerchantId(value.replace(/\D/g, '').slice(0, 10))}
            />
            <Description>4~10 位數字，綠界後台的「商店代號」。</Description>
          </View>

          <View>
            <Label isRequired={!hasStoredKeys}>HashKey</Label>
            <Input
              placeholder={hasStoredKeys ? '已設定，留空表示不變更' : '綠界後台提供的 HashKey'}
              autoCapitalize="none"
              autoCorrect={false}
              value={hashKey}
              onChangeText={setHashKey}
            />
          </View>

          <View>
            <Label isRequired={!hasStoredKeys}>HashIV</Label>
            <Input
              placeholder={hasStoredKeys ? '已設定，留空表示不變更' : '綠界後台提供的 HashIV'}
              autoCapitalize="none"
              autoCorrect={false}
              value={hashIv}
              onChangeText={setHashIv}
            />
          </View>

          <Typography type="body-xs" color="muted">
            {hasStoredKeys
              ? `HashKey 與 HashIV 已設定${
                  ecpaySettings?.ecpay.updatedAt
                    ? `（${new Date(ecpaySettings.ecpay.updatedAt).toLocaleString('zh-TW')} 更新）`
                    : ''
                }。要更換就直接填新的，三欄全部清空則改用平台的綠界帳號。`
              : '還沒有綠界帳號可以先留空，開通狀態會顯示為審核中，商品仍可正常上架。'}
          </Typography>
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          {error ? <FieldError>{error}</FieldError> : null}
          <Button isDisabled={updateStore.isPending} onPress={save}>
            <Button.Label>{updateStore.isPending ? '儲存並驗證中…' : '儲存並驗證'}</Button.Label>
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
