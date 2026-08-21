import { ScrollView, View } from 'react-native';
import { Button, Separator, Typography } from 'heroui-native';
import { router } from 'expo-router';

import { BRAND_COPY } from '@/lib/brand';

const UPDATED_AT = '2026 年 8 月 21 日';

type Section = { title: string; paragraphs: string[]; bullets?: string[] };

const SECTIONS: Section[] = [
  {
    title: '一、我們是誰',
    paragraphs: [
      `${BRAND_COPY.nameZh}（${BRAND_COPY.name}）是一個買家與賣家共用同一組帳號的交易平台。本政策說明我們收集哪些資料、如何使用，以及你可以如何控制這些資料。`,
    ],
  },
  {
    title: '二、我們收集的資料',
    paragraphs: ['我們只收集提供服務所必要的資料：'],
    bullets: [
      '帳號資料：電子郵件、密碼驗證狀態、暱稱、頭像、自我介紹、聯絡電話。',
      '交易資料：訂單內容、金額、收件人姓名與電話、宅配地址或超商取貨門市、訂單備註。',
      '商店與商品資料：賣家的店舖資訊、商品圖片、描述、價格與庫存。',
      '互動資料：站內訊息、評價、收藏、檢舉內容與客服工單。',
      '裝置資料：推播通知用的裝置代碼（Expo Push Token）、平台與裝置名稱。',
      '使用紀錄：商品瀏覽次數與賣家統計數據（以彙總方式呈現，不會公開個別使用者行為）。',
    ],
  },
  {
    title: '三、資料如何被使用',
    paragraphs: ['我們使用上述資料來：'],
    bullets: [
      '建立與維護你的帳號、店舖與訂單。',
      '寄送訂單狀態、物流貨態、新訊息與審核結果的通知與推播。',
      '以 AI 協助審核商品上架內容、偵測聊天訊息中的詐騙與站外交易風險，並為檢舉分級。',
      '處理你透過「聯絡我們」提出的問題。',
      '維護平台安全，包含防止詐騙、濫用與違法商品。',
    ],
  },
  {
    title: '四、我們共享資料的對象',
    paragraphs: ['我們不販售你的個人資料。僅在提供服務必要範圍內與下列服務商共享：'],
    bullets: [
      '綠界科技（ECPay）：處理超商取貨付款的物流訂單，會傳送收件人姓名、手機、取貨門市、商品名稱與代收金額。',
      'OpenAI：進行內容審核時傳送商品文案或被檢舉／被掃描的訊息文字，不會傳送你的姓名、電話或地址。',
      'Expo 推播服務、Apple 與 Google：投遞推播通知所需的裝置代碼與通知內容。',
      '交易對方：完成交易必要的收件資訊會提供給該筆訂單的賣家。',
    ],
  },
  {
    title: '五、資料保存與安全',
    paragraphs: [
      '帳號與交易資料在帳號存續期間保存，交易紀錄依商業與稅務需求保留。密碼由後端加密保管，平台人員無法讀取。物流與金流的商店金鑰只存在伺服器端環境變數，不會寫入資料庫，也不會包含在 App 內。',
      '資料庫以列級權限（RLS）隔離：你只能讀取自己的訂單、購物車、收藏、訊息與工單；賣家只能看到自己店舖的訂單與商品。',
    ],
  },
  {
    title: '六、你的權利',
    paragraphs: ['你可以隨時：'],
    bullets: [
      '在「編輯個人資料」查閱與更新你的資料。',
      '在「通知中心 → 推播設定」分別關閉訊息、訂單與審核的推播。',
      '在「我的 → 刪除帳號」直接刪除帳號與個人資料（進行中的訂單需先完成或取消）。',
      '在聊天室封鎖對方或檢舉不當內容，被封鎖後雙方都無法再傳送訊息。',
      '透過「聯絡我們」要求查詢、更正或刪除你的個人資料。',
    ],
  },
  {
    title: '七、未成年人',
    paragraphs: [
      '未滿 18 歲者應在法定代理人同意下使用本平台。若我們得知帳號屬於未取得同意的未成年人，將停用該帳號。',
    ],
  },
  {
    title: '八、政策更新',
    paragraphs: [`本政策若有重大變更，我們會在 App 內公告。最後更新日期：${UPDATED_AT}。`],
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <View className="bg-background flex-1">
      <ScrollView contentContainerClassName="p-4 gap-3 pb-10">
        <View className="bg-surface gap-2 rounded-2xl p-4">
          <Typography type="h5" className="text-navy" style={{ fontWeight: '700' }}>
            隱私權政策
          </Typography>
          <Typography type="body-xs" color="muted">
            最後更新：{UPDATED_AT}
          </Typography>
          <Typography type="body-sm" color="muted">
            {BRAND_COPY.nameZh}重視你的隱私。以下內容說明我們如何處理你的個人資料。
          </Typography>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} className="bg-surface gap-2 rounded-2xl p-4">
            <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
              {section.title}
            </Typography>
            {section.paragraphs.map((paragraph) => (
              <Typography key={paragraph} type="body-sm" color="muted">
                {paragraph}
              </Typography>
            ))}
            {section.bullets ? (
              <View className="gap-1.5">
                {section.bullets.map((bullet) => (
                  <View key={bullet} className="flex-row gap-2">
                    <View className="bg-brand-orange mt-2 h-1.5 w-1.5 shrink-0 rounded-full" />
                    <Typography type="body-sm" color="muted" className="flex-1">
                      {bullet}
                    </Typography>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            九、聯絡我們
          </Typography>
          <Typography type="body-sm" color="muted">
            對本政策有任何疑問，或想行使上述權利，都可以直接送出客服工單，我們會在收到後盡快回覆。
          </Typography>
          <Separator />
          <Button variant="secondary" onPress={() => router.push('/support/contact')}>
            <Button.Label>前往聯絡我們</Button.Label>
          </Button>
          <Button variant="ghost" onPress={() => router.push('/legal/terms')}>
            <Button.Label>閱讀服務條款</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
