import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Typography } from 'heroui-native';

import { protectBrand } from '@/components/brand/BrandText';

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <View className="items-center justify-center gap-3 px-8 py-16">
      {icon ? (
        <View className="bg-brand-blue-soft h-16 w-16 items-center justify-center rounded-full">
          {icon}
        </View>
      ) : null}
      <Typography type="h6" align="center" className="text-navy">
        {protectBrand(title)}
      </Typography>
      {description ? (
        <Typography type="body-sm" align="center" color="muted">
          {protectBrand(description)}
        </Typography>
      ) : null}
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  );
}
