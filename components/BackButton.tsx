import { Button } from 'heroui-native';
import { ChevronLeft } from 'lucide-react-native';

import { BRAND } from '@/lib/brand';
import { goBackOrReplace } from '@/lib/navigation';

/**
 * Header back control that always works, including on a directly opened route.
 */
export function BackButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      isIconOnly
      className="ml-1"
      onPress={() => goBackOrReplace('/(tabs)')}
      accessibilityLabel="返回"
    >
      <ChevronLeft size={24} color={BRAND.navy} />
    </Button>
  );
}
