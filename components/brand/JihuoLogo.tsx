import { useId } from 'react';
import { View } from 'react-native';
import { Typography } from 'heroui-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Polygon, Stop } from 'react-native-svg';

import { LinearGradient } from '@/components/ui/primitives/LinearGradient';
import { NoTranslate } from '@/components/brand/NoTranslate';
import { BRAND, BRAND_COPY } from '@/lib/brand';
import { cn } from '@/lib/utils';

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
 *
 * Gradient ids are made unique per instance: several marks can live on the same
 * screen (header + hero artwork) and shared `<Defs>` ids collide on native, which
 * leaves one of them unpainted until something forces a re-render.
 */
export function JihuoMark({
  size = 32,
  shieldColor,
  accentColor,
  arrowColor,
  letterColor = BRAND.white,
}: MarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const navyId = `jihuoNavy${uid}`;
  const orangeId = `jihuoOrange${uid}`;
  const arrowId = `jihuoArrow${uid}`;

  const shield = shieldColor ?? `url(#${navyId})`;
  const accent = accentColor ?? `url(#${orangeId})`;
  const arrow = arrowColor ?? `url(#${arrowId})`;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        {shieldColor ? null : (
          <SvgGradient id={navyId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={BRAND.navySoft} />
            <Stop offset="0.55" stopColor="#0B2E7D" />
            <Stop offset="1" stopColor={BRAND.navy} />
          </SvgGradient>
        )}
        {accentColor ? null : (
          <SvgGradient id={orangeId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={BRAND.yellow} />
            <Stop offset="0.55" stopColor={BRAND.orange} />
            <Stop offset="1" stopColor="#E0620A" />
          </SvgGradient>
        )}
        {arrowColor ? null : (
          <SvgGradient id={arrowId} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#7FBEFF" />
            <Stop offset="1" stopColor={BRAND.blue} />
          </SvgGradient>
        )}
      </Defs>

      <Path d={SHIELD_OUTER} fill={shield} />
      <Path d={SHIELD_INNER} fill={accent} />
      {/* The "J" drawn as a stroke so it renders identically on every platform (no font lookup). */}
      <Path
        d="M35.4 20.5 V35.2 C35.4 40.6 30.2 42.9 26.6 39.3"
        stroke={letterColor}
        strokeWidth={4.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M39 47 L55 19" stroke={arrow} strokeWidth={5.6} strokeLinecap="round" fill="none" />
      <Polygon points="59,12 57.6,21.4 50,17" fill={arrow} />
    </Svg>
  );
}

/**
 * The stacked brand lockup (mark over 極貨網 / JIHUOWANG) for large light surfaces
 * such as the sign-in screen. Drawn as vector + text so it paints on the very
 * first frame — a bitmap lockup has to be decoded first and shows up a beat late.
 */
export function JihuoArtwork({
  width = 220,
  showTagline = false,
}: {
  width?: number;
  showTagline?: boolean;
}) {
  return (
    <View className="items-center" style={{ width }}>
      <View style={{ width: width * 0.52, height: width * 0.52, flexShrink: 0 }}>
        <JihuoMark size={width * 0.52} />
      </View>
      <NoTranslate>
        <Typography
          className="text-navy"
          style={{ fontSize: width * 0.2, lineHeight: width * 0.28, fontWeight: '700' }}
        >
          {BRAND_COPY.nameZh}
        </Typography>
        <Typography
          className="text-brand-blue"
          style={{
            fontSize: width * 0.085,
            letterSpacing: width * 0.028,
            fontWeight: '600',
          }}
        >
          {BRAND_COPY.name}
        </Typography>
      </NoTranslate>
      {showTagline ? (
        <Typography color="muted" align="center" style={{ fontSize: width * 0.075 }}>
          {BRAND_COPY.tagline}
        </Typography>
      ) : null}
    </View>
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
      <View style={{ width: size, height: size, flexShrink: 0 }}>
        {onLight ? (
          <JihuoMark size={size} />
        ) : (
          <JihuoMark
            size={size}
            shieldColor="rgba(255,255,255,0.24)"
            accentColor={BRAND.orange}
            arrowColor="rgba(255,255,255,0.92)"
          />
        )}
      </View>
      <View className="shrink">
        <NoTranslate>
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
        </NoTranslate>
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
