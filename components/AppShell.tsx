import type { ReactNode } from 'react';

/**
 * 原生沒有「視窗太寬」的問題，所以這裡只是原樣傳遞。
 * 網頁版的置中限寬版面在 AppShell.web.tsx。
 */
export function AppShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
