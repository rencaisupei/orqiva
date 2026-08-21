import { View } from 'react-native';
import { Button } from 'heroui-native';
import { router } from 'expo-router';
import { Monitor } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { BRAND } from '@/lib/brand';

/**
 * Shown on native builds for screens that only exist on the web build
 * (the admin console). Mobile never links here — this is the fallback for a
 * deep link or a manually typed route.
 */
export function WebOnlyNotice({
  title = '請使用網頁版',
  description = '此功能僅提供網頁版操作。請用電腦或手機瀏覽器開啟極貨網網頁版，登入同一組帳號後即可使用。',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <View className="bg-background flex-1">
      <EmptyState
        icon={<Monitor size={26} color={BRAND.blue} />}
        title={title}
        description={description}
        action={
          <Button variant="secondary" onPress={() => router.replace('/(tabs)')}>
            <Button.Label>回到首頁</Button.Label>
          </Button>
        }
      />
    </View>
  );
}
