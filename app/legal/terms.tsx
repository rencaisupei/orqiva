import { ScrollView, View } from 'react-native';
import { Button, Separator, Typography } from 'heroui-native';
import { router } from 'expo-router';

import { protectBrand } from '@/components/brand/BrandText';
import { NoTranslate } from '@/components/brand/NoTranslate';
import { BRAND_COPY } from '@/lib/brand';

const UPDATED_AT = '2026 年 8 月 21 日';

type Section = { title: string; paragraphs: string[]; bullets?: string[] };

const SECTIONS: Section[] = [
  {
    title: '一、關於本條款',
    paragraphs: [
      `${BRAND_COPY.nameZh}（${BRAND_COPY.name}，以下稱「本平台」）提供的是實體商品的交易撮合服務，買家與賣家使用同一組帳號。註冊、瀏覽或使用本平台任何功能，即表示你已閱讀並同意本條款與隱私權政策。`,
      '本平台是交易場所的提供者，不是買賣契約的當事人。商品的來源、品質、瑕疵擔保與出貨責任由賣家承擔；本平台負責審核機制、爭議協助與帳號管理。',
    ],
  },
  {
    title: '二、帳號與資格',
    paragraphs: ['使用本平台的帳號需符合下列條件：'],
    bullets: [
      '滿 18 歲，或未滿 18 歲但已取得法定代理人同意。',
      '註冊資料（Email、聯絡電話、收件資訊）必須真實可聯絡，不得冒用他人身分。',
      '一人原則上只使用一組帳號；不得為規避停權或操作評價而開設分身帳號。',
      '帳號與密碼由你自行保管，透過你的帳號進行的行為視為你本人的行為。',
      '你可以隨時在「我的 → 刪除帳號」刪除帳號，但有進行中的訂單需先完成或取消。',
    ],
  },
  {
    title: '三、禁止販售的商品',
    paragraphs: [
      '本平台僅供實體商品交易。下列商品與服務一律禁止上架，違者商品直接下架，並可能限制或永久停權：',
    ],
    bullets: [
      '數位與虛擬商品：遊戲點數、序號、啟用金鑰、帳號、代練代儲、外掛、電子書、軟體與訂閱授權、虛擬貨幣、線上課程等任何不需實體寄送的商品（平台已停用「數位虛擬」分類）。',
      '管制與危險物品：槍砲彈藥刀械、爆裂物、毒品與成癮藥物、易燃易爆品、危險化學品、運送受限的散裝鋰電池。',
      '藥品與醫療器材：處方藥、未經核准的藥品或保健品、隱形眼鏡、注射針劑、二手醫療器材。',
      '菸酒、電子煙、加熱菸及其煙彈、耗材與相關零件。',
      '仿冒品、盜版影音與軟體、破解裝置，以及任何侵害他人商標、著作權或專利的物品。',
      '成人情色物品與服務、色情影音內容。',
      '活體動物、保育類動植物及其製品（象牙、犀牛角、珊瑚等）。',
      '來源不明、贓物、失竊或遺失的物品，以及已被召回的商品。',
      '個人資料、名單、帳號密碼、身分證件或其複本。',
      '金融商品、有價證券、彩券、賭博相關物品與服務、代辦借貸。',
      '未依食品法規標示、逾期或來源不明的食品；需低溫但無法以超商物流寄送的生鮮。',
      '其他違反中華民國法令、公共秩序善良風俗，或違反超商與物流業者託運規定的物品。',
    ],
  },
  {
    title: '四、賣家責任',
    paragraphs: ['開設店鋪並上架商品，代表你承諾：'],
    bullets: [
      '你對商品有合法的販售權利，商品不屬於前條的禁售範圍。',
      '商品資訊必須真實：照片為實物、規格與數量正確，二手商品的使用痕跡與瑕疵必須主動揭露。',
      '依標示的價格與庫存供貨，不得在買家下單後拒賣、要求加價或誘導改用其他付款方式。',
      '訂單成立後 2 個工作日內完成出貨並建立物流單；確定無法出貨時，應立即在賣家中心取消並告知買家。',
      '不得引導買家在站外交易或站外付款，站內訊息會自動掃描此類風險。',
      '依法負擔自身的稅務義務，並在買家要求時提供必要的交易憑證。',
      '不得以分身帳號自我評價、互刷評價或干擾其他賣家。',
      '在合理時間內回覆買家訊息，並依第六條處理退換貨。',
    ],
  },
  {
    title: '五、交易規則',
    paragraphs: ['買賣雙方在本平台的交易依下列規則進行：'],
    bullets: [
      '買家送出訂單後即向賣家提出締約要約，賣家確認並出貨後買賣契約成立。',
      '目前支援的付款方式為超商取貨付款（由綠界科技提供物流與代收服務），代收金額為商品總金額加運費，單筆金額限制為新台幣 1 元至 20,000 元。',
      '結帳時選擇的取貨門市與收件資訊由買家負責確認，門市代號錯誤導致無法配送的風險由買家承擔。',
      '商品到店後請於物流業者通知的期限內（一般為 7 日）完成取貨；逾期未取件視為取消訂單，退回運費由買家負擔，並可能影響帳號的下單權限。',
      '站內訊息、訂單紀錄與物流貨態會被保存，作為爭議處理的依據。',
      '禁止惡意下單、洗單、重複棄單，或以下單方式騷擾賣家。',
    ],
  },
  {
    title: '六、退款、取消與退貨',
    paragraphs: ['取貨付款的訂單在取貨前尚未發生金流，因此取消與退款分為下列情形：'],
    bullets: [
      '出貨前：買家可在「我的訂單」取消；賣家如缺貨或無法出貨也應主動取消。此時未產生付款，不涉及退款。',
      '已出貨、尚未取貨：買家未到門市付款即完成取消，但重複棄單會影響帳號權限。',
      '取貨後發現商品有瑕疵、與描述不符、缺件或運送破損：請於取貨後 3 日內拍照並聯繫賣家或送出客服工單，成立時由賣家負擔退回運費並辦理退款或換貨。',
      '以營業為目的的賣家（企業經營者）依《消費者保護法》提供收到商品後 7 日的猶豫期；但依通訊交易解除權合理例外情事適用範圍，個人衛生用品、客製化商品、易腐敗食品、已拆封的影音與軟體不適用。',
      '個人之間的二手交易不屬於《消費者保護法》的通訊交易範圍，以商品描述與雙方約定為準；但賣家有不實描述或隱匿重大瑕疵時，買家仍可要求退貨退款。',
      '退款以原付款路徑退回；取貨付款的款項由賣家在平台客服協助下退回買家指定帳戶，一般於雙方確認退貨後 3 至 7 個工作日內完成。',
      '爭議處理順序：先在站內訊息與對方溝通 → 送出客服工單 → 平台依訊息、訂單與物流紀錄協助調處。平台非交易當事人，不代替賣家承擔履約責任，但可對違規賣家採取下架、限制或停權措施。',
    ],
  },
  {
    title: '七、內容審核與檢舉',
    paragraphs: ['我們對違法與不當內容採零容忍態度，並以下列機制執行：'],
    bullets: [
      '商品上架與涉及內容的編輯都會經過 AI 自動審核（判定為通過、待人工覆核或退回），未通過審核的商品不會對外顯示。',
      '被退回的商品可以修改後重新送審；賣家可在商品管理看到判定原因。',
      '站內訊息會自動掃描詐騙、站外交易與不當內容，命中時會建立紀錄並通知管理員。',
      '任何使用者都可以檢舉商品、店鋪或訊息；聊天室提供檢舉與封鎖，封鎖後雙方都無法再傳送訊息。',
      '違規內容會被移除，帳號可能被警告、限制功能、暫停或永久停權；涉及違法者會通報主管機關並保留相關紀錄。',
      '你上傳的商品文字與圖片，授權本平台在提供與推廣服務的必要範圍內展示與重製；你必須擁有這些內容的合法權利。',
    ],
  },
  {
    title: '八、停權與服務終止',
    paragraphs: [
      '若你違反本條款、法令，或有詐欺、重複棄單、規避平台交易、操作評價等行為，我們可以在必要範圍內移除內容、限制功能、暫停或終止帳號。帳號被限制時，已成立的訂單義務仍須履行。',
      '你也可以隨時停止使用並刪除帳號；刪除後的資料處理方式詳見隱私權政策。',
    ],
  },
  {
    title: '九、免責與責任限制',
    paragraphs: [
      '本平台會盡合理努力維持服務運作與審核品質，但不保證每一件商品的品質、真偽或賣家的履約能力，也不保證服務永不中斷（例如維護、網路或第三方服務異常）。',
      '在法律允許的範圍內，本平台對單一爭議所負的責任，以該筆訂單的成交金額為上限，且不包含間接損失或預期利益。本條不排除因故意或重大過失依法應負的責任。',
    ],
  },
  {
    title: '十、條款變更與適用法律',
    paragraphs: [
      `本條款如有重大變更，我們會在 App 內公告；公告後繼續使用即視為同意變更後的條款。最後更新日期：${UPDATED_AT}。`,
      '本條款以中華民國法律為準據法。因本條款或平台交易所生爭議，雙方同意以臺灣臺北地方法院為第一審管轄法院。',
    ],
  },
];

export default function TermsOfServiceScreen() {
  return (
    <View className="bg-background flex-1">
      <ScrollView contentContainerClassName="p-4 gap-3 pb-10">
        <View className="bg-surface gap-2 rounded-2xl p-4">
          <Typography type="h5" className="text-navy" style={{ fontWeight: '700' }}>
            服務條款
          </Typography>
          <Typography type="body-xs" color="muted">
            最後更新：{UPDATED_AT}
          </Typography>
          <Typography type="body-sm" color="muted">
            以下內容說明在<NoTranslate>{BRAND_COPY.nameZh}</NoTranslate>
            買賣的規則，包含禁售物品、賣家責任、交易與退款方式，以及我們如何審核內容。
          </Typography>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} className="bg-surface gap-2 rounded-2xl p-4">
            <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
              {section.title}
            </Typography>
            {section.paragraphs.map((paragraph) => (
              <Typography key={paragraph} type="body-sm" color="muted">
                {protectBrand(paragraph)}
              </Typography>
            ))}
            {section.bullets ? (
              <View className="gap-1.5">
                {section.bullets.map((bullet) => (
                  <View key={bullet} className="flex-row gap-2">
                    <View className="bg-brand-orange mt-2 h-1.5 w-1.5 shrink-0 rounded-full" />
                    <Typography type="body-sm" color="muted" className="flex-1">
                      {protectBrand(bullet)}
                    </Typography>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            十一、聯絡我們
          </Typography>
          <Typography type="body-sm" color="muted">
            對條款有疑問、要檢舉違規商品，或需要協助處理交易爭議，都可以直接送出客服工單。
          </Typography>
          <Separator />
          <Button variant="secondary" onPress={() => router.push('/support/contact')}>
            <Button.Label>前往聯絡我們</Button.Label>
          </Button>
          <Button variant="ghost" onPress={() => router.push('/legal/privacy')}>
            <Button.Label>閱讀隱私權政策</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
