import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { ImageOff } from 'lucide-react-native';

import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/utils';

type Props = {
  uri?: string | null;
  /** Size classes for the wrapper, e.g. "w-full aspect-square" or "h-16 w-16". */
  className?: string;
  style?: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain';
  placeholderSize?: number;
};

/**
 * Remote image with a wrapper that owns the box size. The inner RN Image always
 * gets explicit width/height so Expo web sizes it reliably.
 */
export function AppImage({
  uri,
  className,
  style,
  resizeMode = 'cover',
  placeholderSize = 22,
}: Props) {
  return (
    <View className={cn('bg-surface-tertiary overflow-hidden', className)} style={style}>
      {uri ? (
        <Image source={{ uri }} resizeMode={resizeMode} style={{ width: '100%', height: '100%' }} />
      ) : (
        <View className="flex-1 items-center justify-center">
          <ImageOff size={placeholderSize} color={BRAND.muted} />
        </View>
      )}
    </View>
  );
}
