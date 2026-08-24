import { View } from 'react-native';
import { Button, Separator, Spinner, Switch, Typography, useToast } from 'heroui-native';
import { ShieldCheck } from 'lucide-react-native';

import { SelectPill } from '@/components/SelectPill';
import { isAutoReviewDue, useAutoReviewStatus, useRunAutoReview } from '@/lib/api/moderation';
import { useAppSettings, useSaveAppSettings } from '@/lib/api/system';
import { BRAND } from '@/lib/brand';
import { formatDateTime } from '@/lib/format';
import type { AutoReviewRun } from '@/lib/api/contracts';

const INTERVALS = [3, 6, 12, 24];
const APPROVE_LEVELS = [0, 10, 20, 30, 40];
/** 101 = 不自動退回（風險分數最高只有 100，永遠不會命中）。 */
const REJECT_LEVELS = [80, 85, 90, 95, 101];

function rejectLabel(value: number): string {
  return value > 100 ? '不自動退回' : `≥ ${value}`;
}

function RunSummary({ run }: { run: AutoReviewRun }) {
  return (
    <View className="bg-background gap-1.5 rounded-2xl p-3">
      <Typography type="body-xs" className="text-navy" style={{ fontWeight: '700' }}>
        上次執行：{formatDateTime(run.started_at)}（{run.trigger === 'admin' ? '手動' : '自動'}，共{' '}
        {run.total_actions} 筆，{run.duration_ms ?? 0} ms）
      </Typography>
      {run.tasks.map((task) => (
        <View key={task.key} className="flex-row items-center gap-3">
          <Typography type="body-xs" color="muted" numberOfLines={1} className="flex-1">
            {task.label}
          </Typography>
          <Typography
            type="body-xs"
            className={task.error ? 'text-brand-orange' : 'text-navy'}
            style={{ fontWeight: '600' }}
          >
            {task.error ? '失敗' : `${task.count} 筆`}
          </Typography>
        </View>
      ))}
      {run.error ? (
        <Typography type="body-xs" className="text-brand-orange">
          {run.error}
        </Typography>
      ) : null}
    </View>
  );
}

/**
 * 平台管理 → AI 自動審核。
 *
 * 判斷與寫入都在 `ai-moderation` 的 auto_review 動作裡：低風險自動上架、
 * 高風險自動退回並通知賣家，只有介於兩個門檻之間的灰色地帶才留在人工佇列。
 * App 只在到期時觸發一次，伺服器端還有一道到期檢查與併發鎖。
 */
export function AutoReviewPanel() {
  const { toast } = useToast();
  const { data: settings } = useAppSettings();
  const status = useAutoReviewStatus(true);
  const save = useSaveAppSettings();
  const run = useRunAutoReview();

  const enabled = settings?.auto_review_enabled ?? true;
  const interval = settings?.auto_review_interval_hours ?? 6;
  const approveMax = settings?.auto_approve_max_risk ?? 20;
  const rejectMin = settings?.auto_reject_min_risk ?? 90;
  const dueNow = settings ? isAutoReviewDue(settings) : false;
  const pending = status.data?.pending ?? [];
  const lastRun = status.data?.recentRuns?.[0] ?? null;

  const patch = (values: Parameters<typeof save.mutate>[0], label: string) => {
    save.mutate(values, {
      onSuccess: () => {
        toast.show({ variant: 'success', label });
        void status.refetch();
      },
      onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
    });
  };

  const runNow = () => {
    run.mutate(undefined, {
      onSuccess: (result) => {
        toast.show({
          variant: result.ok ? 'success' : 'danger',
          label: result.ran ? `已自動處理 ${result.total} 筆` : '目前無法執行，稍後再試',
        });
        void status.refetch();
      },
      onError: (error: Error) => toast.show({ variant: 'danger', label: error.message }),
    });
  };

  return (
    <View className="bg-surface gap-3 rounded-2xl p-4">
      <View className="flex-row items-center gap-3">
        <View className="bg-brand-blue-soft h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <ShieldCheck size={20} color={BRAND.blue} />
        </View>
        <View className="flex-1">
          <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
            AI 自動審核（自動化巡邏）
          </Typography>
          <Typography type="body-xs" color="muted">
            低風險商品自動上架、高風險自動退回並通知賣家，中間的灰色地帶才留給你判斷。順便補掃送審時
            AI 沒跑成功的商品、替新檢舉自動分級，並清掉過期的推薦快取。
          </Typography>
        </View>
      </View>

      <Separator />

      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
            自動審核
          </Typography>
          <Typography type="body-xs" color="muted">
            {enabled
              ? dueNow
                ? '已到期，下一位開啟 App 的使用者會觸發一次。'
                : `下次可執行：${status.data?.nextDueAt ? formatDateTime(status.data.nextDueAt) : '—'}`
              : '已關閉：所有待覆核商品都要人工處理。'}
          </Typography>
        </View>
        <Switch
          isSelected={enabled}
          onSelectedChange={(value) =>
            patch({ auto_review_enabled: value }, value ? '已開啟自動審核' : '已關閉自動審核')
          }
        />
      </View>

      <View className="gap-1.5">
        <Typography type="body-xs" color="muted">
          巡邏間隔（小時）
        </Typography>
        <View className="flex-row flex-wrap gap-2">
          {INTERVALS.map((hours) => (
            <SelectPill
              key={hours}
              size="sm"
              tone="soft"
              label={`${hours} 小時`}
              selected={interval === hours}
              onPress={() => patch({ auto_review_interval_hours: hours }, '已更新巡邏間隔')}
            />
          ))}
        </View>
      </View>

      <View className="gap-1.5">
        <Typography type="body-xs" color="muted">
          自動放行門檻（風險分數 ≤）
        </Typography>
        <View className="flex-row flex-wrap gap-2">
          {APPROVE_LEVELS.map((value) => (
            <SelectPill
              key={value}
              size="sm"
              tone="soft"
              label={value === 0 ? '不自動放行' : `≤ ${value}`}
              selected={approveMax === value}
              onPress={() => patch({ auto_approve_max_risk: value }, '已更新自動放行門檻')}
            />
          ))}
        </View>
      </View>

      <View className="gap-1.5">
        <Typography type="body-xs" color="muted">
          自動退回門檻（風險分數 ≥）
        </Typography>
        <View className="flex-row flex-wrap gap-2">
          {REJECT_LEVELS.map((value) => (
            <SelectPill
              key={value}
              size="sm"
              tone="soft"
              label={rejectLabel(value)}
              selected={rejectMin === value}
              onPress={() => patch({ auto_reject_min_risk: value }, '已更新自動退回門檻')}
            />
          ))}
        </View>
      </View>

      <Separator />

      {status.isLoading ? (
        <View className="py-4">
          <Spinner size="sm" />
        </View>
      ) : (
        <>
          <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
            現在等著處理
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
            <RunSummary run={lastRun} />
          ) : (
            <Typography type="body-xs" color="muted">
              還沒有執行紀錄。
            </Typography>
          )}
        </>
      )}

      <Button isDisabled={run.isPending} onPress={runNow}>
        <Button.Label>{run.isPending ? '處理中…' : '立即執行一次'}</Button.Label>
      </Button>
      {status.error ? (
        <Typography type="body-xs" className="text-brand-orange">
          {status.error.message}
        </Typography>
      ) : null}
    </View>
  );
}
