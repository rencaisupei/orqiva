import { Platform, View } from 'react-native';
import { Button, Separator, Typography } from 'heroui-native';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, Info, ShieldAlert } from 'lucide-react-native';

import { BrandText, protectBrand } from '@/components/brand/BrandText';
import { NoTranslate } from '@/components/brand/NoTranslate';
import { BRAND } from '@/lib/brand';

/** 綠界廠商註冊（官方唯一入口）。 */
const ECPAY_SIGNUP_URL = 'https://vendor.ecpay.com.tw/User/LogOn_Step1';

/** 註冊前要先準備好的檔案；綠界審核缺件就會退回重送。 */
const CHECKLIST = [
  '🪪 身分證正反面照片（個人實名認證用，需清晰、四角完整）',
  '🏦 銀行帳戶存摺封面照片（戶名須與身分證同一人，用於撥款）',
  '📱 可接聽的手機號碼與常用 Email（收驗證碼與審核通知）',
];

/** 綠界現行規則；不符合就無法完成註冊，寫在最前面避免白跑一趟。 */
const RULES = [
  '申請人須年滿 20 歲，未滿 20 歲無法通過實名認證。',
  '綠界不開放海外個人註冊，須為在台灣的個人或公司行號。',
  '填寫的姓名、身分證字號與銀行戶名必須一致，任一項不符都會被退件。',
];

/**
 * 賣家物流入職卡：註冊前的準備清單與法規提醒、開啟綠界官方註冊頁的按鈕，
 * 以及審核通過後把五個欄位填回極貨網的指南。
 *
 * 註冊頁以 App 內瀏覽器開啟（不使用內嵌 iframe），賣家按瀏覽器的「關閉」
 * 就直接回到這一頁繼續填資料。
 */
export function EcpaySignupGuide({ showBackfillGuide = true }: { showBackfillGuide?: boolean }) {
  const openSignup = async () => {
    if (Platform.OS === 'web') {
      globalThis.open?.(ECPAY_SIGNUP_URL, '_blank');
      return;
    }
    await WebBrowser.openBrowserAsync(ECPAY_SIGNUP_URL, {
      // 左上角固定顯示「關閉」，關掉就回到極貨網原本的畫面。
      dismissButtonStyle: 'close',
      toolbarColor: BRAND.navy,
      controlsColor: BRAND.white,
      enableBarCollapsing: false,
    });
  };

  return (
    <View className="bg-surface gap-3 rounded-2xl p-4">
      <View className="flex-row items-center gap-2">
        <ShieldAlert size={16} color={BRAND.orange} />
        <Typography type="body" className="text-navy flex-1" style={{ fontWeight: '600' }}>
          第一步：註冊綠界物流帳號
        </Typography>
      </View>
      <BrandText type="body-xs" color="muted" className="leading-5">
        超商取貨付款由綠界科技（ECPay）提供。請先在綠界完成個人實名認證，才能在極貨網開通取貨付款。
      </BrandText>

      <Separator />

      <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
        先準備好這些資料
      </Typography>
      <View className="gap-1.5">
        {CHECKLIST.map((item) => (
          <Typography key={item} type="body-xs" className="text-navy leading-5">
            {item}
          </Typography>
        ))}
      </View>

      <View
        className="gap-1.5 rounded-2xl border p-3"
        style={{ borderColor: BRAND.orange, backgroundColor: BRAND.orangeSoft }}
      >
        <Typography type="body-xs" className="text-navy" style={{ fontWeight: '700' }}>
          註冊前請確認
        </Typography>
        {RULES.map((rule) => (
          <View key={rule} className="flex-row gap-2">
            <Typography type="body-xs" className="text-brand-orange">
              ·
            </Typography>
            <Typography type="body-xs" color="muted" className="flex-1 leading-5">
              {rule}
            </Typography>
          </View>
        ))}
      </View>

      <Button onPress={() => void openSignup()}>
        <ExternalLink size={16} color={BRAND.white} />
        <Button.Label>前往綠界註冊（官方網站）</Button.Label>
      </Button>
      <Typography type="body-xs" color="muted" className="leading-5">
        {protectBrand(
          Platform.OS === 'web'
            ? '綠界官方註冊頁會在新分頁開啟，註冊完關掉分頁即可回到極貨網。'
            : '綠界官方註冊頁會在 App 內瀏覽器開啟，完成後按左上角「關閉」就回到這一頁。',
        )}
      </Typography>

      {showBackfillGuide ? (
        <View
          className="gap-1.5 rounded-2xl border p-3"
          style={{ borderColor: BRAND.blue, backgroundColor: BRAND.blueSoft }}
        >
          <View className="flex-row items-center gap-2">
            <Info size={14} color={BRAND.blue} />
            <Typography type="body-xs" className="text-navy flex-1" style={{ fontWeight: '700' }}>
              註冊通過之後要做的事
            </Typography>
          </View>
          <Typography type="body-xs" color="muted" className="leading-5">
            💡
            註冊驗證通過後（約需2-3個工作日），請登入綠界廠商後台，至「系統開發管理」➔「系統介面設定」找到
            <Typography type="body-xs" className="text-navy" style={{ fontWeight: '700' }}>
              物流
            </Typography>
            區塊的 HashKey 與 HashIV（注意：金流／全方位金流也有一組，兩組不一樣，貼錯會驗證失敗），
            商店代號（MerchantID）在後台首頁或帳戶資訊即可看到， 再把下面五個欄位填回
            <NoTranslate>極貨網</NoTranslate>，才會正式開通超商貨到付款。
          </Typography>
        </View>
      ) : (
        <BrandText type="body-xs" color="muted" className="leading-5">
          💡 註冊驗證通過後（約需2-3個工作日），到「賣家中心 → 店舖設定」把綠界商店代號與「物流」的
          HashKey、HashIV（不是金流那一組）填回極貨網，就會開通超商貨到付款。
        </BrandText>
      )}
    </View>
  );
}
