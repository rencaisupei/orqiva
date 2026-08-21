import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Input, Label, Typography } from 'heroui-native';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';

import { BRAND } from '@/lib/brand';

export type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type Props = {
  label: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  isRequired?: boolean;
  /** Shows a filter field above the list — worth enabling past ~10 options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Rendered under the trigger when nothing is selected yet. */
  description?: string;
};

/**
 * Inline dropdown select. Opens a bordered panel directly under the trigger so it
 * works identically on web and native (no portal / nested-gesture surprises), and
 * keeps its own scroll area when the option list is long.
 */
export function OptionSelect({
  label,
  options,
  value,
  onChange,
  placeholder = '請選擇',
  isRequired = false,
  searchable = false,
  searchPlaceholder = '搜尋',
  description,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value) ?? null;

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) || option.hint?.toLowerCase().includes(term),
    );
  }, [options, query]);

  return (
    <View>
      <Label isRequired={isRequired}>{label}</Label>

      <Pressable
        className="border-border bg-background flex-row items-center gap-2 rounded-xl border px-3.5 py-3"
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${label}：${selected?.label ?? placeholder}`}
      >
        <Typography
          type="body-sm"
          numberOfLines={1}
          className={selected ? 'text-navy flex-1' : 'text-muted flex-1'}
        >
          {selected?.label ?? placeholder}
        </Typography>
        {open ? (
          <ChevronUp size={16} color={BRAND.muted} />
        ) : (
          <ChevronDown size={16} color={BRAND.muted} />
        )}
      </Pressable>

      {!open && description ? (
        <Typography type="body-xs" color="muted" className="mt-1">
          {description}
        </Typography>
      ) : null}

      {open ? (
        <View className="border-border bg-surface mt-2 overflow-hidden rounded-xl border">
          {searchable ? (
            <View className="border-border border-b p-2">
              <Input placeholder={searchPlaceholder} value={query} onChangeText={setQuery} />
            </View>
          ) : null}

          <ScrollView
            style={{ maxHeight: 264 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {visible.length === 0 ? (
              <View className="px-3.5 py-4">
                <Typography type="body-sm" color="muted">
                  找不到符合的選項
                </Typography>
              </View>
            ) : (
              visible.map((option) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    className={`flex-row items-center gap-2 px-3.5 py-3 ${active ? 'bg-brand-blue-soft' : ''}`}
                    onPress={() => {
                      onChange(option.value);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <View className="flex-1">
                      <Typography
                        type="body-sm"
                        className="text-navy"
                        numberOfLines={1}
                        style={active ? { fontWeight: '600' } : undefined}
                      >
                        {option.label}
                      </Typography>
                      {option.hint ? (
                        <Typography type="body-xs" color="muted" numberOfLines={1}>
                          {option.hint}
                        </Typography>
                      ) : null}
                    </View>
                    {active ? <Check size={16} color={BRAND.blue} /> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
