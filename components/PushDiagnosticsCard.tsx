import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Button, Separator, Spinner, Typography, useToast } from 'heroui-native';
import * as Clipboard from 'expo-clipboard';
import {
  BellRing,
  Copy,
  RefreshCw,
  Send,
  Settings,
  SquareArrowOutUpRight,
} from 'lucide-react-native';

import { useSendTestPush } from '@/lib/api/social';
import { BRAND } from '@/lib/brand';
import {
  enablePushOnThisDevice,
  getPushDiagnostics,
  openSystemNotificationSettings,
  scheduleLocalLinkTest,
  type PushDiagnostics,
} from '@/lib/push';

const PERMISSION_LABEL: Record<PushDiagnostics['permission'], string> = {
  granted: '已允許',
  denied: '已拒絕',
  undetermined: '尚未詢問',
};

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View className="flex-row items-start gap-3">
      <Typography type="body-xs" color="muted" className="w-24">
        {label}
      </Typography>
      <Typography
        type="body-xs"
        className={warn ? 'text-danger flex-1' : 'text-navy flex-1'}
        style={{ fontWeight: '600' }}
      >
        {value}
      </Typography>
    </View>
  );
}

/**
 * 推播自我檢查：權限、Expo token、Android 通知頻道，以及兩種測試
 * （伺服器推播 + 本機通知點擊跳轉）。僅在 iOS / Android 顯示。
 */
export function PushDiagnosticsCard() {
  const { toast } = useToast();
  const [state, setState] = useState<PushDiagnostics | null>(null);
  const [busy, setBusy] = useState<'refresh' | 'enable' | 'link' | null>(null);
  const testPush = useSendTestPush();

  const refresh = useCallback(async () => {
    setBusy('refresh');
    try {
      setState(await getPushDiagnostics());
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void refresh();
  }, [refresh]);

  if (Platform.OS === 'web') return null;

  const granted = state?.permission === 'granted';
  const hasToken = !!state?.token;

  const enable = async () => {
    setBusy('enable');
    try {
      const result = await enablePushOnThisDevice();
      setState(await getPushDiagnostics());
      toast.show(
        result.ok
          ? { variant: 'success', label: '這台裝置已可接收推播' }
          : { variant: 'danger', label: '沒有取得推播權限或 token，請檢查系統設定' },
      );
    } finally {
      setBusy(null);
    }
  };

  const sendServerTest = () => {
    testPush.mutate(undefined, {
      onSuccess: (result) => {
        toast.show(
          result.sent > 0
            ? { variant: 'success', label: '測試推播已送出，稍等幾秒' }
            : {
                variant: 'danger',
                label: '沒有可用的裝置 token，請先按「重新註冊這台裝置」',
              },
        );
      },
      onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
    });
  };

  const testDeepLink = async () => {
    setBusy('link');
    try {
      const ok = await scheduleLocalLinkTest('/orders');
      toast.show(
        ok
          ? { variant: 'success', label: '6 秒後跳出通知，先把 App 切到背景再點它' }
          : { variant: 'danger', label: '無法建立本機通知，請確認通知權限' },
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="bg-surface gap-3 rounded-2xl p-3">
      <View className="flex-row items-center gap-2">
        <BellRing size={15} color={BRAND.blue} />
        <Typography type="body-sm" className="text-navy flex-1" style={{ fontWeight: '600' }}>
          推播自我檢查
        </Typography>
        <Pressable
          className="h-7 w-7 shrink-0 items-center justify-center"
          onPress={() => void refresh()}
        >
          {busy === 'refresh' ? <Spinner size="sm" /> : <RefreshCw size={14} color={BRAND.muted} />}
        </Pressable>
      </View>

      {state ? (
        <View className="gap-1.5">
          <Row
            label="裝置"
            value={
              state.isDevice
                ? state.isExpoGo
                  ? '實機（Expo Go：推播支援有限）'
                  : '實機'
                : '模擬器 / 模擬裝置（收不到推播）'
            }
            warn={!state.isDevice}
          />
          <Row
            label="系統權限"
            value={PERMISSION_LABEL[state.permission]}
            warn={state.permission !== 'granted'}
          />
          <Row
            label="裝置 token"
            value={state.token ? `${state.token.slice(0, 26)}…` : '尚未取得'}
            warn={!state.token}
          />
          {Platform.OS === 'android' ? (
            <Row
              label="通知頻道"
              value={
                state.channel ? `${state.channel.id} · ${state.channel.importance}` : '尚未建立'
              }
              warn={!state.channel}
            />
          ) : null}
          <Row
            label="Expo 專案"
            value={state.projectId ?? '未設定（發佈或建置後才會有）'}
            warn={!state.projectId}
          />
        </View>
      ) : (
        <Spinner size="sm" />
      )}

      {state?.token ? (
        <Pressable
          className="border-border flex-row items-center gap-2 rounded-xl border px-3 py-2"
          onPress={() => {
            void Clipboard.setStringAsync(state.token!);
            toast.show({ variant: 'success', label: 'token 已複製' });
          }}
        >
          <Typography type="body-xs" color="muted" className="flex-1" numberOfLines={1}>
            複製 token 到 expo.dev/notifications 手動測試
          </Typography>
          <Copy size={14} color={BRAND.muted} />
        </Pressable>
      ) : null}

      <Separator />

      <View className="gap-2">
        <Button
          size="sm"
          variant={granted && hasToken ? 'secondary' : 'primary'}
          isDisabled={busy === 'enable'}
          onPress={() => void enable()}
        >
          <View className="flex-row items-center gap-2">
            {busy === 'enable' ? <Spinner size="sm" /> : null}
            <Typography
              type="body-sm"
              className={granted && hasToken ? 'text-navy' : 'text-white'}
              style={{ fontWeight: '600' }}
            >
              {granted && hasToken ? '重新註冊這台裝置' : '允許通知並註冊裝置'}
            </Typography>
          </View>
        </Button>

        <Button
          size="sm"
          variant="secondary"
          isDisabled={testPush.isPending || !hasToken}
          onPress={sendServerTest}
        >
          <View className="flex-row items-center gap-2">
            {testPush.isPending ? <Spinner size="sm" /> : <Send size={14} color={BRAND.navy} />}
            <Typography type="body-sm" className="text-navy">
              發送伺服器測試推播
            </Typography>
          </View>
        </Button>

        <Button
          size="sm"
          variant="secondary"
          isDisabled={busy === 'link'}
          onPress={() => void testDeepLink()}
        >
          <View className="flex-row items-center gap-2">
            <SquareArrowOutUpRight size={14} color={BRAND.navy} />
            <Typography type="body-sm" className="text-navy">
              測試通知點擊跳轉（我的訂單）
            </Typography>
          </View>
        </Button>

        <Button size="sm" variant="tertiary" onPress={() => void openSystemNotificationSettings()}>
          <View className="flex-row items-center gap-2">
            <Settings size={14} color={BRAND.navy} />
            <Typography type="body-sm" className="text-navy">
              開啟系統通知設定
            </Typography>
          </View>
        </Button>
      </View>

      <Typography type="body-xs" color="muted">
        測試順序：允許通知 → 發送伺服器測試推播（App 切到背景才看得到橫幅）→ 測試點擊跳轉。 Android
        若沒有音效或橫幅，代表頻道重要性被使用者調低，需在系統設定調回。
      </Typography>
    </View>
  );
}
