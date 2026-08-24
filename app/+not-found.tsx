import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { Typography } from 'heroui-native';

import { BrandText } from '@/components/brand/BrandText';
import { JihuoMark } from '@/components/brand/JihuoLogo';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '找不到頁面' }} />
      <View className="bg-background flex-1 items-center justify-center gap-4 px-8">
        <JihuoMark size={56} />
        <Typography type="h5" align="center" className="text-navy">
          這個頁面不存在
        </Typography>
        <BrandText type="body-sm" align="center" color="muted">
          連結可能已失效，回到首頁繼續探索極貨網。
        </BrandText>
        <Link href="/(tabs)">
          <Typography type="body" className="text-brand-blue">
            回到首頁
          </Typography>
        </Link>
      </View>
    </>
  );
}
