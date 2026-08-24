import { View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';

import { protectBrand } from '@/components/brand/BrandText';
import { BRAND, BRAND_COPY } from '@/lib/brand';

type Props = {
  title?: string;
  description?: string;
};

export function SignInRequired({
  title = '請先登入極貨網',
  description = BRAND_COPY.subTagline,
}: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <View className="bg-brand-blue-soft h-16 w-16 items-center justify-center rounded-full">
        <LockKeyhole size={26} color={BRAND.blue} />
      </View>
      <Typography type="h5" align="center" className="text-navy">
        {protectBrand(title)}
      </Typography>
      <Typography type="body-sm" align="center" color="muted">
        {protectBrand(description)}
      </Typography>
      <Button className="mt-2 w-full" onPress={() => router.push('/auth/sign-in')}>
        <Button.Label>登入 / 註冊</Button.Label>
      </Button>
    </View>
  );
}
