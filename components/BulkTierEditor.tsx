import { Pressable, View } from 'react-native';
import { Button, Description, Input, Label, Typography } from 'heroui-native';
import { Plus, Trash2 } from 'lucide-react-native';

import { BRAND } from '@/lib/brand';
import { formatPrice } from '@/lib/format';
import { MAX_BULK_PERCENT, MAX_BULK_TIERS, bulkDiscountFor, type BulkTier } from '@/lib/types';

type Props = {
  tiers: BulkTier[];
  onChange: (tiers: BulkTier[]) => void;
  /** 商品售價，用來即時顯示折後的每件價格。 */
  price: number;
};

/**
 * 賣家設定階梯式批量折扣。新增與編輯商品共用同一個編輯器，
 * 檢查邏輯一律用 lib/types.ts 的 validateBulkTiers（呼叫端在送出前執行）。
 */
export function BulkTierEditor({ tiers, onChange, price }: Props) {
  const update = (index: number, patch: Partial<BulkTier>) => {
    onChange(tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  };

  const add = () => {
    const highest = tiers.reduce((max, tier) => Math.max(max, tier.min_quantity), 1);
    const percent = tiers.reduce((max, tier) => Math.max(max, tier.percent), 0);
    onChange([
      ...tiers,
      {
        min_quantity: Math.min(highest + 2, 999),
        percent: Math.min(percent + 5 || 5, MAX_BULK_PERCENT),
      },
    ]);
  };

  return (
    <View className="gap-3">
      <View>
        <Label>數量折扣（買越多折越多）</Label>
        <Description>
          例如「滿 3 件折 10%、滿 5 件折 15%」。買家在購物車達到門檻時自動折抵，最多{' '}
          {MAX_BULK_TIERS} 個門檻，門檻越高折扣要越多。
        </Description>
      </View>

      {tiers.map((tier, index) => {
        const unit =
          price > 0 && tier.percent > 0 ? Math.round((price * (100 - tier.percent)) / 100) : price;
        const saved = price > 0 ? bulkDiscountFor(price, tier.min_quantity, [tier]) : 0;
        return (
          // oxlint-disable-next-line react/no-array-index-key -- BulkTier has no persisted id; every field below is fully controlled from `tier`, so an index key cannot leave stale uncontrolled state behind.
          <View key={index} className="border-border bg-background gap-2 rounded-2xl border p-3">
            <View className="flex-row items-end gap-2">
              <View className="flex-1">
                <Label>滿幾件</Label>
                <Input
                  keyboardType="number-pad"
                  inputMode="numeric"
                  value={tier.min_quantity ? String(tier.min_quantity) : ''}
                  onChangeText={(value) =>
                    update(index, { min_quantity: Number(value.replace(/\D/g, '').slice(0, 3)) })
                  }
                />
              </View>
              <View className="flex-1">
                <Label>折扣 %</Label>
                <Input
                  keyboardType="number-pad"
                  inputMode="numeric"
                  value={tier.percent ? String(tier.percent) : ''}
                  onChangeText={(value) =>
                    update(index, { percent: Number(value.replace(/\D/g, '').slice(0, 2)) })
                  }
                />
              </View>
              <Pressable
                className="h-11 w-10 items-center justify-center"
                accessibilityLabel="刪除這個門檻"
                onPress={() => onChange(tiers.filter((_, i) => i !== index))}
              >
                <Trash2 size={16} color={BRAND.muted} />
              </Pressable>
            </View>
            {price > 0 && tier.min_quantity > 0 && tier.percent > 0 ? (
              <Typography type="body-xs" color="muted">
                買 {tier.min_quantity} 件時每件約 {formatPrice(unit)}，這一筆可省{' '}
                {formatPrice(saved)}
              </Typography>
            ) : null}
          </View>
        );
      })}

      {tiers.length < MAX_BULK_TIERS ? (
        <Button size="sm" variant="tertiary" onPress={add}>
          <View className="flex-row items-center gap-1.5">
            <Plus size={14} color={BRAND.blue} />
            <Typography type="body-sm" className="text-brand-blue">
              {tiers.length === 0 ? '新增數量折扣' : '再加一個門檻'}
            </Typography>
          </View>
        </Button>
      ) : null}
    </View>
  );
}
