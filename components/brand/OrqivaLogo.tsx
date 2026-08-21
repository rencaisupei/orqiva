import { Image, View } from 'react-native';
import { Typography } from 'heroui-native';
import Svg, { Defs, G, LinearGradient as SvgGradient, Path, Polygon, Stop } from 'react-native-svg';

import { LinearGradient } from '@/components/ui/primitives/LinearGradient';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/utils';

/* The supplied brand artwork: full lockup (mark + ORQIVA + 歐奇瓦 + slogans). */
import LOGO_SOURCE from '@/assets/orqiva-logo.png';

const LOGO_SIZE = { w: 591, h: 521 };
/* Region of the artwork that holds only the orange↔blue ring mark. */
const MARK_CROP = { x: 124, y: 16, w: 352, h: 226 };
const MARK_RATIO = MARK_CROP.w / MARK_CROP.h;

/**
 * The real ORQIVA ring mark, cropped out of the supplied brand artwork.
 * Use on light surfaces (the artwork carries a white background).
 */
export function OrqivaMarkImage({ size = 30 }: { size?: number }) {
  const scale = size / MARK_CROP.h;
  return (
    <View style={{ width: MARK_CROP.w * scale, height: size, overflow: 'hidden' }}>
      <Image
        source={LOGO_SOURCE}
        resizeMode="stretch"
        style={{
          width: LOGO_SIZE.w * scale,
          height: LOGO_SIZE.h * scale,
          marginLeft: -MARK_CROP.x * scale,
          marginTop: -MARK_CROP.y * scale,
        }}
      />
    </View>
  );
}

/** The complete brand lockup artwork, for large light surfaces. */
export function OrqivaArtwork({ width = 220 }: { width?: number }) {
  return (
    <Image
      source={LOGO_SOURCE}
      resizeMode="contain"
      style={{ width, height: width * (LOGO_SIZE.h / LOGO_SIZE.w) }}
    />
  );
}

type MarkProps = {
  size?: number;
  topColor?: string;
  bottomColor?: string;
  strokeWidth?: number;
};

/**
 * Vector version of the ORQIVA mark — a tilted ring split into an orange and a
 * blue arrow chasing each other: 買家 ↔ 賣家, 需求 ↔ 供給, 交易 ↔ 價值.
 * Pass topColor/bottomColor for flat colours on dark surfaces; omit them for
 * the brand gradients.
 */
export function OrqivaMark({ size = 32, topColor, bottomColor, strokeWidth = 10 }: MarkProps) {
  const orange = topColor ?? 'url(#orqivaOrange)';
  const blue = bottomColor ?? 'url(#orqivaBlue)';

  return (
    <Svg width={size} height={size * 0.875} viewBox="0 4 64 56">
      <Defs>
        <SvgGradient id="orqivaOrange" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#F04A00" />
          <Stop offset="0.55" stopColor={BRAND.orange} />
          <Stop offset="1" stopColor={BRAND.yellow} />
        </SvgGradient>
        <SvgGradient id="orqivaBlue" x1="1" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0F8BFF" />
          <Stop offset="0.5" stopColor={BRAND.blue} />
          <Stop offset="1" stopColor={BRAND.navy} />
        </SvgGradient>
      </Defs>

      <G rotation={-28} originX={32} originY={32}>
        <Path
          d="M5.3 29.8 A27 15.5 0 0 1 58.7 29.8"
          stroke={orange}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Polygon points="52.9,29.8 64.5,29.8 58.7,42" fill={orange} />
        <Path
          d="M58.7 34.2 A27 15.5 0 0 1 5.3 34.2"
          stroke={blue}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Polygon points="-0.5,34.2 11.1,34.2 5.3,22" fill={blue} />
      </G>
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
      {onLight ? (
        <OrqivaMarkImage size={size} />
      ) : (
        <View style={{ width: size * MARK_RATIO, height: size }} className="justify-center">
          <OrqivaMark size={size * MARK_RATIO} topColor={BRAND.orange} bottomColor="#4DA3FF" />
        </View>
      )}
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
        size={size * 0.72}
        topColor={BRAND.white}
        bottomColor="rgba(255,255,255,0.8)"
        strokeWidth={9}
      />
    </LinearGradient>
  );
}
