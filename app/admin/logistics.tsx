import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import {
  Button,
  Chip,
  Description,
  FieldError,
  Input,
  Label,
  Separator,
  Spinner,
  Switch,
  Typography,
  useToast,
} from 'heroui-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { CheckCircle2, Copy, ShieldAlert, Truck, XCircle } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { OptionSelect } from '@/components/OptionSelect';
import { SignInRequired } from '@/components/SignInRequired';
import {
  useAdminLogistics,
  useSaveLogisticsSettings,
  useVerifyLogistics,
} from '@/lib/api/logistics';
import { BRAND } from '@/lib/brand';
import { formatDate } from '@/lib/format';
import { WebOnlyNotice } from '@/components/WebOnlyNotice';
import { ADMIN_CONSOLE_IS_WEB, useIsAdminConsole, useUserId } from '@/lib/session';
import {
  LOGISTICS_SUB_TYPE_LABEL,
  LOGISTICS_TEST_STORE_ID,
  type LogisticsEnvironment,
  type LogisticsSettings,
  type LogisticsSubType,
} from '@/lib/types';

const SUB_TYPES: LogisticsSubType[] = ['UNIMARTC2C', 'FAMIC2C', 'HILIFEC2C', 'OKMARTC2C'];

const ENV_OPTIONS = [
  { value: 'stage', label: '測試環境 (Stage)', hint: 'logistics-stage.ecpay.com.tw' },
  { value: 'production', label: '正式環境 (Production)', hint: 'logistics.ecpay.com.tw' },
];

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-surface gap-3 rounded-2xl p-4">
      <View className="gap-0.5">
        <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography type="body-xs" color="muted">
            {subtitle}
          </Typography>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1">
        <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
          {label}
        </Typography>
        {hint ? (
          <Typography type="body-xs" color="muted">
            {hint}
          </Typography>
        ) : null}
      </View>
      <Switch isSelected={value} onSelectedChange={onChange} />
    </View>
  );
}

export default function AdminLogisticsScreen() {
  const userId = useUserId();
  const isAdmin = useIsAdminConsole();
  const { toast } = useToast();

  const query = useAdminLogistics(isAdmin);
  const save = useSaveLogisticsSettings();
  const verify = useVerifyLogistics();

  const [draft, setDraft] = useState<Partial<LogisticsSettings>>({});
  const [error, setError] = useState<string | null>(null);

  const settings = query.data?.settings;

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const environment: LogisticsEnvironment = draft.environment ?? 'stage';
  const activeCredentials = query.data?.credentials?.[environment];
  const enabledSubTypes = draft.enabled_sub_types ?? [];
  const returnStoreIds = draft.return_store_ids ?? {};

  const envVarNames = useMemo(
    () =>
      environment === 'production'
        ? ['ECPAY_MERCHANT_ID', 'ECPAY_HASH_KEY', 'ECPAY_HASH_IV']
        : ['ECPAY_STAGE_MERCHANT_ID', 'ECPAY_STAGE_HASH_KEY', 'ECPAY_STAGE_HASH_IV'],
    [environment],
  );

  if (!ADMIN_CONSOLE_IS_WEB) {
    return (
      <WebOnlyNotice
        title="物流串接設定僅提供網頁版"
        description="綠界物流串接設定屬於平台管理後台，已改為網頁版專用。請用瀏覽器開啟極貨網網頁版後操作。"
      />
    );
  }

  if (!userId) {
    return <SignInRequired title="登入後設定物流串接" />;
  }

  if (!isAdmin) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          icon={<ShieldAlert size={26} color={BRAND.blue} />}
          title="需要管理員權限"
          description="物流串接設定僅開放給 admin 角色。"
          action={
            <Button variant="secondary" onPress={() => router.replace('/(tabs)')}>
              <Button.Label>回到首頁</Button.Label>
            </Button>
          }
        />
      </View>
    );
  }

  if (query.isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          title="讀取設定失敗"
          description={query.error instanceof Error ? query.error.message : undefined}
          action={
            <Button onPress={() => void query.refetch()}>
              <Button.Label>重新載入</Button.Label>
            </Button>
          }
        />
      </View>
    );
  }

  const patch = (next: Partial<LogisticsSettings>) => setDraft((prev) => ({ ...prev, ...next }));

  const toggleSubType = (subType: LogisticsSubType) => {
    const next = enabledSubTypes.includes(subType)
      ? enabledSubTypes.filter((s) => s !== subType)
      : [...enabledSubTypes, subType];
    patch({ enabled_sub_types: next });
  };

  const submit = () => {
    if (draft.is_enabled) {
      if (enabledSubTypes.length === 0) {
        setError('啟用前請至少選擇一家超商');
        return;
      }
      if (!draft.sender_name?.trim()) {
        setError('請填寫寄件人姓名（綠界必填，2~5 個中文字）');
        return;
      }
      if (!/^09\d{8}$/.test(draft.sender_cell_phone ?? '')) {
        setError('寄件人手機需為 09 開頭的 10 碼數字（C2C 必填）');
        return;
      }
    }
    setError(null);

    save.mutate(
      {
        environment: draft.environment,
        is_enabled: draft.is_enabled,
        enabled_sub_types: enabledSubTypes,
        is_collection_enabled: draft.is_collection_enabled,
        use_test_credentials: draft.use_test_credentials ?? true,
        sender_name: draft.sender_name ?? null,
        sender_phone: draft.sender_phone ?? null,
        sender_cell_phone: draft.sender_cell_phone ?? null,
        sender_zip_code: draft.sender_zip_code ?? null,
        sender_address: draft.sender_address ?? null,
        return_store_ids: returnStoreIds,
        default_goods_name: draft.default_goods_name || '商品一批',
        platform_id: draft.platform_id ?? null,
      },
      {
        onSuccess: () => toast.show({ variant: 'success', label: '物流設定已儲存' }),
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  const runVerify = () => {
    setError(null);
    verify.mutate(undefined, {
      onSuccess: (result) => {
        toast.show({
          variant: result.ok ? 'success' : 'danger',
          label: result.ok ? '綠界連線正常' : '綠界連線失敗',
        });
      },
      onError: (err: Error) => setError(err.message),
    });
  };

  const verifyResult = verify.data ?? (settings?.last_verify_result as typeof verify.data);
  const callbackUrl = query.data?.callbackUrl ?? '';

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="p-4 gap-3 pb-8" keyboardShouldPersistTaps="handled">
        <View className="bg-surface flex-row items-center gap-3 rounded-2xl p-4">
          <View className="bg-brand-blue-soft h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <Truck size={20} color={BRAND.blue} />
          </View>
          <View className="flex-1">
            <Typography type="body" className="text-navy" style={{ fontWeight: '700' }}>
              綠界 C2C 超商取貨付款
            </Typography>
            <Typography type="body-xs" color="muted">
              使用綠界物流整合 Web API（門市電子地圖 + 門市訂單建立）
            </Typography>
          </View>
        </View>

        <SectionCard
          title="介接環境"
          subtitle="切換後所有請求會改打對應的綠界網址，並改用該環境的金鑰。"
        >
          <OptionSelect
            label="環境"
            options={ENV_OPTIONS}
            value={environment}
            onChange={(value) => patch({ environment: value as LogisticsEnvironment })}
          />

          {environment === 'stage' ? (
            <ToggleRow
              label="使用綠界公用測試特店"
              hint={`測試主機只認得綠界的測試特店（${query.data?.testAccountMerchantId ?? '2000933'}），自己的正式特店編號在測試環境會被拒絕。`}
              value={draft.use_test_credentials ?? true}
              onChange={(value) => patch({ use_test_credentials: value })}
            />
          ) : null}

          <View className="bg-background gap-2 rounded-xl p-3">
            <View className="flex-row items-center gap-2">
              {activeCredentials?.ready ? (
                <CheckCircle2 size={16} color="#16A34A" />
              ) : (
                <XCircle size={16} color="#DC2626" />
              )}
              <Typography type="body-sm" className="text-navy flex-1" style={{ fontWeight: '600' }}>
                {activeCredentials?.ready ? '金鑰已設定' : '尚未設定金鑰'}
              </Typography>
            </View>
            <Typography type="body-xs" color="muted">
              MerchantID：{activeCredentials?.merchantId ?? '未設定'}
              {activeCredentials?.source === 'ecpay_test' ? '（綠界公用測試特店）' : ''}
            </Typography>
            <Typography type="body-xs" color="muted">
              {activeCredentials?.source === 'ecpay_test'
                ? '目前用的是綠界文件公開的測試金鑰，正式環境會自動改用專案環境變數。'
                : `金鑰放在後端環境變數，前端讀不到：${envVarNames.join('、')}`}
            </Typography>
            <Typography type="body-xs" color="muted">
              檢查碼演算法：{query.data?.checkMacAlgorithm ?? 'MD5'}
              （物流 API 規格，不送 EncryptType；SHA256 只用於金流 AIO API）
            </Typography>
          </View>

          <Button variant="secondary" isDisabled={verify.isPending} onPress={runVerify}>
            <Button.Label>{verify.isPending ? '驗證中…' : '驗證與綠界的連線'}</Button.Label>
          </Button>

          {verifyResult?.message ? (
            <View className="bg-background gap-1 rounded-xl p-3">
              <Typography
                type="body-sm"
                className={verifyResult.ok ? 'text-navy' : 'text-danger'}
                style={{ fontWeight: '600' }}
              >
                {verifyResult.ok ? '連線正常' : '連線異常'}
              </Typography>
              <Typography type="body-xs" color="muted">
                {verifyResult.message}
              </Typography>
              {settings?.last_verified_at ? (
                <Typography type="body-xs" color="muted">
                  最後驗證：{formatDate(settings.last_verified_at)}
                </Typography>
              ) : null}
            </View>
          ) : null}
        </SectionCard>

        <SectionCard
          title="回拋網址 (ServerReplyURL)"
          subtitle="由程式在每一次請求中自動帶入，綠界後台沒有這個欄位，不需要也無法填寫。"
        >
          <Pressable
            className="border-border bg-background flex-row items-center gap-2 rounded-xl border px-3 py-3"
            onPress={() => {
              void Clipboard.setStringAsync(callbackUrl);
              toast.show({ variant: 'success', label: '網址已複製' });
            }}
          >
            <Typography type="body-xs" className="text-navy flex-1">
              {callbackUrl}
            </Typography>
            <Copy size={15} color={BRAND.muted} />
          </Pressable>
          <Description>
            門市電子地圖 (/Express/map) 與門市訂單建立 (/Express/Create) 的表單都會帶上這個
            ServerReplyURL，綠界選店結果與後續貨態通知都回拋到這裡，並用 CheckMacValue 驗章。
            這組網址是公開 HTTPS 端點，不需要登入即可接收綠界的 POST。
          </Description>
        </SectionCard>

        <SectionCard title="開放設定">
          <ToggleRow
            label="啟用超商取貨付款"
            hint="關閉時買家結帳看不到超商取貨選項。"
            value={draft.is_enabled ?? false}
            onChange={(value) => patch({ is_enabled: value })}
          />
          <Separator />
          <ToggleRow
            label="代收貨款"
            hint="7-ELEVEN 交貨便的代收金額必須等於商品金額。"
            value={draft.is_collection_enabled ?? true}
            onChange={(value) => patch({ is_collection_enabled: value })}
          />
          <Separator />
          <Label>開放的超商（可多選）</Label>
          <View className="flex-row flex-wrap gap-2">
            {SUB_TYPES.map((subType) => (
              <Pressable key={subType} onPress={() => toggleSubType(subType)}>
                <Chip
                  size="sm"
                  variant={enabledSubTypes.includes(subType) ? 'primary' : 'tertiary'}
                >
                  {LOGISTICS_SUB_TYPE_LABEL[subType]}
                </Chip>
              </Pressable>
            ))}
          </View>
          <Description>綠界申請的物流模式需為 C2C（店到店）才能使用這些子類型。</Description>
        </SectionCard>

        <SectionCard
          title="寄件人資訊"
          subtitle="會寫進每一張物流單，C2C 退貨需憑本人身分證領取，請勿填公司名稱。"
        >
          <View>
            <Label isRequired>寄件人姓名</Label>
            <Input
              placeholder="2~5 個中文字"
              value={draft.sender_name ?? ''}
              onChangeText={(value) => patch({ sender_name: value })}
            />
          </View>
          <View>
            <Label isRequired>寄件人手機</Label>
            <Input
              placeholder="09xxxxxxxx"
              keyboardType="number-pad"
              value={draft.sender_cell_phone ?? ''}
              onChangeText={(value) =>
                patch({ sender_cell_phone: value.replace(/\D/g, '').slice(0, 10) })
              }
            />
            <Description>只允許數字、10 碼、09 開頭</Description>
          </View>
          <View>
            <Label>寄件人電話</Label>
            <Input
              placeholder="02-12345678"
              value={draft.sender_phone ?? ''}
              onChangeText={(value) => patch({ sender_phone: value })}
            />
          </View>
          <View>
            <Label>寄件人郵遞區號</Label>
            <Input
              placeholder="100"
              keyboardType="number-pad"
              value={draft.sender_zip_code ?? ''}
              onChangeText={(value) =>
                patch({ sender_zip_code: value.replace(/\D/g, '').slice(0, 6) })
              }
            />
          </View>
          <View>
            <Label>寄件人地址</Label>
            <Input
              placeholder="縣市 / 區 / 路名門牌"
              value={draft.sender_address ?? ''}
              onChangeText={(value) => patch({ sender_address: value })}
            />
          </View>
        </SectionCard>

        <SectionCard
          title="退貨門市代號"
          subtitle="留空時退件會回到原寄件門市。目前僅 7-ELEVEN C2C 會採用指定的退貨門市。"
        >
          {SUB_TYPES.map((subType) => (
            <View key={subType}>
              <Label>{LOGISTICS_SUB_TYPE_LABEL[subType]}</Label>
              <Input
                placeholder={`測試門市代號：${LOGISTICS_TEST_STORE_ID[subType]}`}
                value={returnStoreIds[subType] ?? ''}
                onChangeText={(value) =>
                  patch({ return_store_ids: { ...returnStoreIds, [subType]: value.trim() } })
                }
              />
            </View>
          ))}
        </SectionCard>

        <SectionCard title="其他">
          <View>
            <Label>預設商品名稱</Label>
            <Input
              placeholder="商品一批"
              value={draft.default_goods_name ?? ''}
              onChangeText={(value) => patch({ default_goods_name: value })}
            />
            <Description>
              7-ELEVEN、萊爾富、OK 的 C2C 訂單商品名稱不可為空，也不可含特殊符號。
            </Description>
          </View>
          <View>
            <Label>PlatformID（特約平台商代號）</Label>
            <Input
              placeholder="一般商店請留空"
              value={draft.platform_id ?? ''}
              onChangeText={(value) => patch({ platform_id: value.trim() })}
            />
          </View>
        </SectionCard>

        {error ? <FieldError>{error}</FieldError> : null}
      </ScrollView>

      <View className="border-border bg-surface pb-safe-offset-3 border-t px-4 py-3">
        <Button isDisabled={save.isPending} onPress={submit}>
          <Button.Label>{save.isPending ? '儲存中…' : '儲存物流設定'}</Button.Label>
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
