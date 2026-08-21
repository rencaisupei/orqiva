import { View } from 'react-native';
import { Typography } from 'heroui-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { LinearGradient } from '@/components/ui/primitives/LinearGradient';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/utils';

type MarkProps = {
  size?: number;
  topColor?: string;
  bottomColor?: string;
  strokeWidth?: number;
};

/**
 * ORQIVA mark — two interlocking rings in orange + blue:
 * 買家 ↔ 賣家, 需求 ↔ 供給, 交易 ↔ 價值.
 * Also used standalone as the app icon.
 */
export function OrqivaMark({
  size = 32,
  topColor = BRAND.orange,
  bottomColor = BRAND.blue,
  strokeWidth = 7,
}: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx={23} cy={32} r={13} stroke={topColor} strokeWidth={strokeWidth} fill="none" />
      <Circle cx={41} cy={32} r={13} stroke={bottomColor} strokeWidth={strokeWidth} fill="none" />
      {/* The orange ring weaves over the blue one at the upper crossing. */}
      <Path
        d="M27.4 19.8 A13 13 0 0 1 34.8 26.5"
        stroke={topColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
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

/** App-icon style badge: the mark in white on the brand gradient square. */
export function OrqivaBadge({ size = 40 }: { size?: number }) {
  return (
    <LinearGradient
      colors={[BRAND.orange, BRAND.blue]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <OrqivaMark
        size={size * 0.66}
        topColor={BRAND.white}
        bottomColor="rgba(255,255,255,0.78)"
        strokeWidth={8}
      />
    </LinearGradient>
  );
}
