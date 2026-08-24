import type { ReactNode } from 'react';

/** 原生沒有瀏覽器翻譯，原樣傳遞即可。網頁版實作在 NoTranslate.web.tsx。 */
export function NoTranslate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
