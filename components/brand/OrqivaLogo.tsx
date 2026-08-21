import { View } from 'react-native';
import { Typography } from 'heroui-native';
import Svg, { Path } from 'react-native-svg';

import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/utils';

type MarkProps = {
  size?: number;
  topColor?: string;
  bottomColor?: string;
};

/**
 * ORQIVA mark — two opposing arrows: 買家 ↔ 賣家, 需求 ↔ 供給, 交易 ↔ 價值.
 * Also used standalone as the app icon.
 */
export function OrqivaMark({
  size = 32,
  topColor = BRAND.orange,
  bottomColor = BRAND.blue,
}: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M12 24H44" stroke={topColor} strokeWidth={8} strokeLinecap="round" fill="none" />
      <Path
        d="M38 15L52 24L38 33"
        stroke={topColor}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M52 40H20" stroke={bottomColor} strokeWidth={8} strokeLinecap="round" fill="none" />
      <Path
        d="M26 31L12 40L26 49"
        stroke={bottomColor}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

type LogoProps = {
  size?: number;
  showZh?: boolean;
  className?: string;
  onLight?: boolean;
};

export function OrqivaLogo({ size = 30, showZh = true, className, onLight = true }: LogoProps) {
  return (
    <View className={cn('flex-row items-center gap-2', className)}>
      <OrqivaMark size={size} />
      <View>
        <Typography
          type="h5"
          className={cn('tracking-[3px]', onLight ? 'text-navy' : 'text-white')}
          style={{ fontWeight: '700' }}
        >
          ORQIVA
        </Typography>
        {showZh ? (
          <Typography
            type="body-xs"
            className={cn('tracking-[4px]', onLight ? 'text-muted' : 'text-white/70')}
          >
            歐奇瓦
          </Typography>
        ) : null}
      </View>
    </View>
  );
}
