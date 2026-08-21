import { Image, View } from 'react-native';
import { Typography } from 'heroui-native';
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Polygon,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { LinearGradient } from '@/components/ui/primitives/LinearGradient';
import { BRAND, BRAND_COPY } from '@/lib/brand';
import { cn } from '@/lib/utils';

/* The supplied brand artwork: full lockup (shield mark + 極貨網 + JIHUOWANG + slogan). */
import LOGO_SOURCE from '@/assets/jihuowang-logo.png';

/** Artwork aspect only — the crop below is expressed in fractions, so real pixel size does not matter. */
const ART = { w: 353, h: 481 };
/**
 * Region of the artwork that holds only the shield mark (no wordmark).
 * Kept generous on every edge so the shield outline and the arrow tip that breaks
 * out of the top-right corner are never clipped.
 */
const MARK_CROP = { x: 0.075, y: 0.008, w: 0.905, h: 0.492 };
const MARK_IMAGE_RATIO = (MARK_CROP.w * ART.w) / (MARK_CROP.h * ART.h);

/**
 * The real shield mark, cropped out of the supplied brand artwork.
 * Use on light surfaces (the artwork carries a near-white background).
 */
export function JihuoMarkImage({ size = 30 }: { size?: number }) {
  const boxWidth = size * MARK_IMAGE_RATIO;
  const imageWidth = boxWidth / MARK_CROP.w;
  const imageHeight = size / MARK_CROP.h;

  return (
    <View style={{ width: boxWidth, height: size, overflow: 'hidden' }}>
      <Image
        source={LOGO_SOURCE}
        resizeMode="stretch"
        style={{
          width: imageWidth,
          height: imageHeight,
          marginLeft: -MARK_CROP.x * imageWidth,
          marginTop: -MARK_CROP.y * imageHeight,
        }}
      />
    </View>
  );
}

/** The complete brand lockup artwork, for large light surfaces. */
export function JihuoArtwork({ width = 220 }: { width?: number }) {
  return (
    <Image
      source={LOGO_SOURCE}
      resizeMode="contain"
      style={{ width, height: width * (ART.h / ART.w) }}
    />
  );
}

type MarkProps = {
  size?: number;
  shieldColor?: string;
  accentColor?: string;
  arrowColor?: string;
  letterColor?: string;
};

const SHIELD_OUTER = 'M32 3 L58 11.5 V31 C58 46 46 56.5 32 61 C18 56.5 6 46 6 31 V11.5 Z';
const SHIELD_INNER = 'M32 13 L48.5 18.5 V31 C48.5 41 41 47 32 50.5 C23 47 15.5 41 15.5 31 V18.5 Z';

/**
 * Vector version of the 極貨網 mark — a navy shield holding the orange "J" core with
 * a rising arrow breaking out of the top-right corner: 收貨入庫 → 成長向上.
 * Pass flat colours for dark surfaces; omit them for the brand gradients.
 */
export function JihuoMark({
  size = 32,
  shieldColor,
  accentColor,
  arrowColor,
  letterColor = BRAND.white,
}: MarkProps) {
  const shield = shieldColor ?? 'url(#jihuoNavy)';
  const accent = accentColor ?? 'url(#jihuoOrange)';
  const arrow = arrowColor ?? 'url(#jihuoArrow)';

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <SvgGradient id="jihuoNavy" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={BRAND.navySoft} />
          <Stop offset="0.55" stopColor="#0B2E7D" />
          <Stop offset="1" stopColor={BRAND.navy} />
        </SvgGradient>
        <SvgGradient id="jihuoOrange" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={BRAND.yellow} />
          <Stop offset="0.55" stopColor={BRAND.orange} />
          <Stop offset="1" stopColor="#E0620A" />
        </SvgGradient>
        <SvgGradient id="jihuoArrow" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#7FBEFF" />
          <Stop offset="1" stopColor={BRAND.blue} />
        </SvgGradient>
      </Defs>

      <Path d={SHIELD_OUTER} fill={shield} />
      <Path d={SHIELD_INNER} fill={accent} />
      <SvgText x={32} y={41} fontSize={27} fontWeight="700" fill={letterColor} textAnchor="middle">
        J
      </SvgText>
      <Path d="M40 50 L56 17" stroke={arrow} strokeWidth={6} strokeLinecap="round" fill="none" />
      <Polygon points="61,6 50.1,12.6 61.5,18.8" fill={arrow} />
    </Svg>
  );
}

type LogoProps = {
  size?: number;
  showEn?: boolean;
  className?: string;
  onLight?: boolean;
};

export function JihuoLogo({ size = 30, showEn = true, className, onLight = true }: LogoProps) {
  return (
    <View className={cn('flex-row items-center gap-2', className)}>
      {onLight ? (
        <JihuoMarkImage size={size} />
      ) : (
        <JihuoMark
          size={size}
          shieldColor="rgba(255,255,255,0.24)"
          accentColor={BRAND.orange}
          arrowColor="rgba(255,255,255,0.92)"
        />
      )}
      <View className="shrink">
        <Typography
          type="h5"
          numberOfLines={1}
          className={cn(onLight ? 'text-navy' : 'text-white')}
          style={{ fontWeight: '700' }}
        >
          {BRAND_COPY.nameZh}
        </Typography>
        {showEn ? (
          <Typography
            type="body-xs"
            numberOfLines={1}
            className={cn('tracking-[1px]', onLight ? 'text-muted' : 'text-white/70')}
          >
            {BRAND_COPY.name}
          </Typography>
        ) : null}
      </View>
    </View>
  );
}

/** App-icon style badge: the mark in white on the brand gradient square. */
export function JihuoBadge({ size = 40 }: { size?: number }) {
  return (
    <LinearGradient
      colors={[BRAND.navySoft, BRAND.blue]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <JihuoMark
        size={size * 0.8}
        shieldColor="rgba(255,255,255,0.26)"
        accentColor={BRAND.orange}
        arrowColor="rgba(255,255,255,0.95)"
      />
    </LinearGradient>
  );
}
