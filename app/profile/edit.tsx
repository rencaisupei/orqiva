import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import {
  Avatar,
  Button,
  FieldError,
  Input,
  Label,
  TextArea,
  Typography,
  useToast,
} from 'heroui-native';
import { Camera } from 'lucide-react-native';

import { SignInRequired } from '@/components/SignInRequired';
import { useUpdateProfile } from '@/lib/api/social';
import { pickImages, uploadImage } from '@/lib/api/upload';
import { BRAND } from '@/lib/brand';
import { goBackOrReplace } from '@/lib/navigation';
import { useSessionStore, useUserId } from '@/lib/session';

export default function EditProfileScreen() {
  const userId = useUserId();
  const profile = useSessionStore((s) => s.profile);
  const account = useSessionStore((s) => s.account);
  const reload = useSessionStore((s) => s.reload);
  const { toast } = useToast();
  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(account?.phone ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!userId) {
    return <SignInRequired title="登入後編輯個人資料" />;
  }

  const changeAvatar = async () => {
    try {
      setUploading(true);
      const picked = await pickImages(1);
      if (picked.length === 0) return;
      const url = await uploadImage('store-assets', userId, picked[0]);
      setAvatarUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗');
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    if (!displayName.trim()) {
      setError('請填寫暱稱');
      return;
    }
    setError(null);
    updateProfile.mutate(
      { userId, displayName: displayName.trim(), bio: bio.trim(), phone: phone.trim(), avatarUrl },
      {
        onSuccess: async () => {
          await reload();
          toast.show({ variant: 'success', label: '個人資料已更新' });
          goBackOrReplace('/(tabs)/profile');
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
        <View className="bg-surface items-center gap-3 rounded-2xl p-5">
          <Avatar size="lg" alt={displayName || '會員'}>
            {avatarUrl ? <Avatar.Image source={{ uri: avatarUrl }} /> : null}
            <Avatar.Fallback />
          </Avatar>
          <Pressable
            className="flex-row items-center gap-1.5"
            disabled={uploading}
            onPress={() => void changeAvatar()}
          >
            <Camera size={14} color={BRAND.blue} />
            <Typography type="body-sm" className="text-brand-blue">
              {uploading ? '上傳中…' : '更換頭像'}
            </Typography>
          </Pressable>
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <View>
            <Label>暱稱</Label>
            <Input placeholder="顯示名稱" value={displayName} onChangeText={setDisplayName} />
          </View>
          <View>
            <Label>Email</Label>
            <Input value={account?.email ?? ''} editable={false} />
          </View>
          <View>
            <Label>手機號碼</Label>
            <Input
              placeholder="09xxxxxxxx"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
          <View>
            <Label>自我介紹</Label>
            <TextArea
              placeholder="讓買家或賣家更認識你"
              value={bio}
              onChangeText={setBio}
              numberOfLines={4}
            />
          </View>

          {error ? <FieldError>{error}</FieldError> : null}

          <Button isDisabled={updateProfile.isPending} onPress={save}>
            <Button.Label>{updateProfile.isPending ? '儲存中…' : '儲存'}</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
