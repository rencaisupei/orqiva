import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Separator, Spinner, Switch, Typography, useToast } from 'heroui-native';
import { Eraser } from 'lucide-react-native';

import {
  isCleanupDue,
  useAppSettings,
  useMaintenanceStatus,
  useRunCleanup,
  useSaveAppSettings,
} from '@/lib/api/system';
import { BRAND } from '@/lib/brand';
import { formatDateTime } from '@/lib/format';
import type { CleanupTaskResult } from '@/lib/api/contracts';

type Draft = { interval: string; notifications: string; history: string };

function clamp(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function TaskRow({ task }: { task: CleanupTaskResult }) {
  return (
    <View className="flex-row items-center gap-3">
      <Typography type="body-xs" color="muted" numberOfLines={1} className="flex-1">
        {task.label}
      </Typography>
      <Typography
        type="body-xs"
        className={task.error ? 'text-brand-orange' : 'text-navy'}
        style={{ fontWeight: '600' }}
      >
        {task.error ? '失敗' : `${task.deleted} 筆`}
      </Typography>
    </View>
  );
}

/**
 * 平台管理 → 自動清理。
 *
 * 清理本身由 `maintenance` edge function 執行，App 只在到期時觸發一次，
 * 這裡負責顯示狀態、調整保留天數，以及需要時手動執行一次。
 */
export function CleanupPanel() {
  const { toast } = useToast();
  const { data: settings } = useAppSettings();
  const status = useMaintenanceStatus(true);
  const save = useSaveAppSettings();
  const run = useRunCleanup();

  const [draft, setDraft] = useState<Draft>({
    interval: '12',
    notifications: '30',
    history: '180',
  });
  const hydrated = useRef(false);

  useEffect(() => {
    if (!settings || hydrated.current) return;
    hydrated.current = true;
    setDraft({
      interval: String(settings.cleanup_interval_hours),
      notifications: String(settings.cleanup_notification_days),
      history: String(settings.cleanup_history_days),
    });
  }, [settings]);

  const submit = () => {
    save.mutate(
      {
        cleanup_enabled: settings?.cleanup_enabled ?? true,
        cleanup_interval_hours: clamp(draft.interval, 1, 168, 12),
        cleanup_notification_days: clamp(draft.notifications, 7, 365, 30),
        cleanup_history_days: clamp(draft.history, 30, 1095, 180),
      },
      {
        onSuccess: (data) => {
          setDraft({
            interval: String(data.cleanup_interval_hours),
            notifications: String(data.cleanup_notification_days),
            history: String(data.cleanup_history_days),
          });
          toast.show({ variant: 'success', label: '清理設定已儲存' });
          void status.refetch();
        },
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  const toggle = (value: boolean) => {
    save.mutate(
      { cleanup_enabled: value },
      {
        onSuccess: () =>
          toast.show({ variant: 'success', label: value ? '已開啟自動清理' : '已關閉自動清理' }),
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  const runNow = () => {
    run.mutate(
      { force: true },
      {
        onSuccess: (result) => {
          toast.show({
            variant: result.ok ? 'success' : 'danger',
            label: result.ran ? `已清理 ${result.totalDeleted} 筆資料` : '目前無法執行，稍後再試',
          });
          void status.refetch();
        },
        onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
      },
    );
  };

  const enabled = settings?.cleanup_enabled ?? true;
  const dueNow = settings ? isCleanupDue(settings) : false;
  const pending = status.data?.pending ?? [];
  const pendingTotal = pending.reduce((sum, item) => sum + item.rows, 0);
  const lastRun = status.data?.recentRuns?.[0] ?? null;

  return (
    <View className="bg-surface gap-3 rounded-2xl p-4">
      <View className="flex-row items-center gap-3">
        <View className="bg-brand-blue-soft h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <Eraser size={20} color={BRAND.blue} />
        </View>
        <View className="flex-1">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            自動清理（背景維護）
          </Typography>
          <Typography type="body-xs" color="muted">
            到期時由 App
            自動觸發一次，只刪過期資料：舊通知、歷史貨態與審核紀錄、已結案檢舉、失效推播裝置、久放購物車。訂單與商品永遠保留。
          </Typography>
        </View>
      </View>

      <Separator />

      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
            自動清理
          </Typography>
          <Typography type="body-xs" color="muted">
            {enabled
              ? dueNow
                ? '已到期，下一位開啟 App 的使用者會觸發一次。'
                : `下次可執行：${status.data?.nextDueAt ? formatDateTime(status.data.nextDueAt) : '—'}`
              : '已關閉：資料會一直累積，建議保持開啟。'}
          </Typography>
        </View>
        <Switch isSelected={enabled} onSelectedChange={toggle} />
      </View>

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Typography type="body-xs" color="muted" className="mb-1">
            最短間隔（小時）
          </Typography>
          <Input
            keyboardType="number-pad"
            value={draft.interval}
            onChangeText={(value) =>
              setDraft((p) => ({ ...p, interval: value.replace(/\D/g, '') }))
            }
          />
        </View>
        <View className="flex-1">
          <Typography type="body-xs" color="muted" className="mb-1">
            通知保留（天）
          </Typography>
          <Input
            keyboardType="number-pad"
            value={draft.notifications}
            onChangeText={(value) =>
              setDraft((p) => ({ ...p, notifications: value.replace(/\D/g, '') }))
            }
          />
        </View>
        <View className="flex-1">
          <Typography type="body-xs" color="muted" className="mb-1">
            歷史保留（天）
          </Typography>
          <Input
            keyboardType="number-pad"
            value={draft.history}
            onChangeText={(value) => setDraft((p) => ({ ...p, history: value.replace(/\D/g, '') }))}
          />
        </View>
      </View>

      <Button size="sm" variant="secondary" isDisabled={save.isPending} onPress={submit}>
        <Button.Label>{save.isPending ? '儲存中…' : '儲存清理設定'}</Button.Label>
      </Button>

      <Separator />

      {status.isLoading ? (
        <View className="py-4">
          <Spinner size="sm" />
        </View>
      ) : (
        <>
          <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
            現在可以清掉 {pendingTotal} 筆
          </Typography>
          <View className="gap-1">
            {pending.map((item) => (
              <View key={item.key} className="flex-row items-center gap-3">
                <Typography type="body-xs" color="muted" numberOfLines={1} className="flex-1">
                  {item.label}
                </Typography>
                <Typography type="body-xs" className="text-navy" style={{ fontWeight: '600' }}>
                  {item.rows} 筆
                </Typography>
              </View>
            ))}
          </View>

          {lastRun ? (
            <View className="bg-background gap-1.5 rounded-2xl p-3">
              <Typography type="body-xs" className="text-navy" style={{ fontWeight: '700' }}>
                上次執行：{formatDateTime(lastRun.started_at)}（
                {lastRun.trigger === 'admin' ? '手動' : '自動'}，共 {lastRun.total_deleted} 筆，
                {lastRun.duration_ms ?? 0} ms）
              </Typography>
              {lastRun.tasks.map((task) => (
                <TaskRow key={task.key} task={task} />
              ))}
              {lastRun.error ? (
                <Typography type="body-xs" className="text-brand-orange">
                  {lastRun.error}
                </Typography>
              ) : null}
            </View>
          ) : (
            <Typography type="body-xs" color="muted">
              還沒有執行紀錄。
            </Typography>
          )}
        </>
      )}

      <Button isDisabled={run.isPending} onPress={runNow}>
        <Button.Label>{run.isPending ? '清理中…' : '立即清理一次'}</Button.Label>
      </Button>
      {status.error ? (
        <Typography type="body-xs" className="text-brand-orange">
          {status.error.message}
        </Typography>
      ) : null}
    </View>
  );
}
