import type { ReactNode } from 'react';

/**
 * 擋掉瀏覽器（Chrome／Google 翻譯）對品牌名稱的翻譯 —— 開著翻譯時「極貨網」
 * 會被改成「計貨網」這類字，商標必須永遠是原字。
 *
 * translate="no" 與 class="notranslate" 兩者都給：前者是 HTML 標準屬性，後者是
 * Google 翻譯自己的標記，兩個都會往下繼承到整個子樹。display: contents 讓這層
 * 不參與版面計算，包上去不會影響 flex 排列。
 */
export function NoTranslate({ children }: { children: ReactNode }) {
  return (
    <span translate="no" className="notranslate" style={{ display: 'contents' }}>
      {children}
    </span>
  );
}
