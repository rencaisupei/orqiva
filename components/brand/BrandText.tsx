import type { ComponentProps, ReactNode } from 'react';
import { Typography } from 'heroui-native';

import { NoTranslate } from '@/components/brand/NoTranslate';
import { BRAND_COPY } from '@/lib/brand';

/**
 * 品牌名稱是商標，開著瀏覽器翻譯時不能被改字（「極貨網」會變成「計貨網」）。
 * 但整句文案該翻的還是要翻，所以這裡只把句子裡的品牌名切出來包 NoTranslate，
 * 其餘文字原樣留給翻譯器處理。
 *
 * 原生沒有瀏覽器翻譯，NoTranslate 是 passthrough，所以切出來的片段等同原字串。
 */
const BRAND_TOKENS = [BRAND_COPY.nameZh, BRAND_COPY.name] as const;

// 依長度排序，避免短的 token 先吃掉長的（目前兩個沒有重疊，加新名稱時仍安全）。
const BRAND_PATTERN = new RegExp(
  `(${[...BRAND_TOKENS].sort((a, b) => b.length - a.length).join('|')})`,
  'g',
);

/**
 * 把字串切成「一般文字」與「不可翻譯的品牌名」兩種片段。
 * 沒有品牌名時原樣回傳字串，不會多包一層節點。
 */
export function protectBrand(text: string | null | undefined): ReactNode {
  if (!text) return text ?? null;
  if (!text.includes(BRAND_COPY.nameZh) && !text.includes(BRAND_COPY.name)) return text;

  const parts = text.split(BRAND_PATTERN).filter((part) => part.length > 0);
  return parts.map((part, index) => {
    if (!(BRAND_TOKENS as readonly string[]).includes(part)) return part;
    // eslint-disable-next-line react/no-array-index-key -- 靜態切出的片段順序即身分，內容可重複，沒有更穩定的鍵可用
    return <NoTranslate key={`brand-${index}`}>{part}</NoTranslate>;
  });
}

type BrandTextProps = Omit<ComponentProps<typeof Typography>, 'children'> & {
  children: string | null | undefined;
};

/** Typography 的替代品：文字照樣顯示，但句中的品牌名不會被瀏覽器翻譯。 */
export function BrandText({ children, ...rest }: BrandTextProps) {
  return <Typography {...rest}>{protectBrand(children)}</Typography>;
}
