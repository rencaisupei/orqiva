import { useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Label, Switch, Typography } from 'heroui-native';
import { Clock } from 'lucide-react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { BRAND } from '@/lib/brand';
import {
  DEFAULT_BUSINESS_HOURS,
  WEEKDAY_LABEL,
  WEEKDAY_ORDER,
  type BusinessHours,
  type BusinessHoursDay,
} from '@/lib/types';

type Mode = 'off' | 'always' | 'weekly';

type Props = {
  value: BusinessHours | null;
  onChange: (value: BusinessHours | null) => void;
};

const MODES: { key: Mode; label: string }[] = [
  { key: 'off', label: '不顯示' },
  { key: 'always', label: '24 小時' },
  { key: 'weekly', label: '每週時段' },
];

/** 使用者只打數字也能填出 09:00：邊打邊補冒號，離開欄位時再補零。 */
function maskTime(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalizeTime(raw: string, fallback: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return fallback;
  const padded = digits.padEnd(4, '0').slice(0, 4);
  const hour = Math.min(23, Number(padded.slice(0, 2)));
  const minute = Math.min(59, Number(padded.slice(2)));
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * 店鋪營業時間編輯器。value = null 代表賣家選擇不顯示營業時間，
 * 店鋪頁就完全不會出現那一區。
 */
export function BusinessHoursEditor({ value, onChange }: Props) {
  const mode: Mode = value === null ? 'off' : value.mode === 'always' ? 'always' : 'weekly';
  const hours = value ?? DEFAULT_BUSINESS_HOURS;
  const [draft, setDraft] = useState<Record<string, string>>({});

  const setMode = (next: Mode) => {
    if (next === 'off') {
      onChange(null);
      return;
    }
    onChange({ ...hours, mode: next === 'always' ? 'always' : 'weekly' });
  };

  const patchDay = (index: number, patch: Partial<BusinessHoursDay>) => {
    const days = hours.days.map((day, i) => (i === index ? { ...day, ...patch } : day));
    onChange({ ...hours, mode: 'weekly', days });
  };

  const applyMondayToAll = () => {
    const monday = hours.days[1];
    onChange({ ...hours, mode: 'weekly', days: hours.days.map(() => ({ ...monday })) });
    setDraft({});
  };

  const timeValue = (index: number, field: 'from' | 'to') =>
    draft[`${index}-${field}`] ?? hours.days[index][field];

  return (
    <View className="bg-surface gap-3 rounded-2xl p-4">
      <View className="flex-row items-center gap-2">
        <Clock size={16} color={BRAND.blue} />
        <Typography type="body" className="text-navy flex-1" style={{ fontWeight: '600' }}>
          營業時間
        </Typography>
      </View>
      <Typography type="body-xs" color="muted">
        會顯示在店鋪頁，讓買家知道什麼時候找得到你。選「不顯示」就不會出現這一區。
      </Typography>

      <SegmentedControl items={MODES} value={mode} onChange={setMode} size="sm" />

      {mode === 'weekly' ? (
        <View className="gap-2">
          {WEEKDAY_ORDER.map((dayIndex) => {
            const day = hours.days[dayIndex];
            return (
              <View key={dayIndex} className="flex-row items-center gap-2">
                <Typography type="body-sm" className="text-navy w-10 shrink-0">
                  {WEEKDAY_LABEL[dayIndex]}
                </Typography>
                <Switch
                  isSelected={day.open}
                  onSelectedChange={(open) => patchDay(dayIndex, { open })}
                />
                {day.open ? (
                  <View className="flex-1 flex-row items-center gap-1">
                    <View className="flex-1">
                      <Input
                        value={timeValue(dayIndex, 'from')}
                        keyboardType="number-pad"
                        inputMode="numeric"
                        placeholder="09:00"
                        onChangeText={(text) =>
                          setDraft((prev) => ({ ...prev, [`${dayIndex}-from`]: maskTime(text) }))
                        }
                        onBlur={() => {
                          const next = normalizeTime(timeValue(dayIndex, 'from'), day.from);
                          setDraft((prev) => {
                            const copy = { ...prev };
                            delete copy[`${dayIndex}-from`];
                            return copy;
                          });
                          patchDay(dayIndex, { from: next });
                        }}
                      />
                    </View>
                    <Typography type="body-sm" color="muted">
                      –
                    </Typography>
                    <View className="flex-1">
                      <Input
                        value={timeValue(dayIndex, 'to')}
                        keyboardType="number-pad"
                        inputMode="numeric"
                        placeholder="21:00"
                        onChangeText={(text) =>
                          setDraft((prev) => ({ ...prev, [`${dayIndex}-to`]: maskTime(text) }))
                        }
                        onBlur={() => {
                          const next = normalizeTime(timeValue(dayIndex, 'to'), day.to);
                          setDraft((prev) => {
                            const copy = { ...prev };
                            delete copy[`${dayIndex}-to`];
                            return copy;
                          });
                          patchDay(dayIndex, { to: next });
                        }}
                      />
                    </View>
                  </View>
                ) : (
                  <Typography type="body-sm" color="muted" className="flex-1">
                    休息
                  </Typography>
                )}
              </View>
            );
          })}
          <Button variant="tertiary" size="sm" className="self-start" onPress={applyMondayToAll}>
            <Button.Label>週一時段套用到每一天</Button.Label>
          </Button>
        </View>
      ) : null}

      {mode !== 'off' ? (
        <View>
          <Label>補充說明（選填）</Label>
          <Input
            placeholder="例如：國定假日公休，出貨順延一天"
            value={hours.note}
            maxLength={40}
            onChangeText={(note) => onChange({ ...hours, note })}
          />
        </View>
      ) : null}
    </View>
  );
}
