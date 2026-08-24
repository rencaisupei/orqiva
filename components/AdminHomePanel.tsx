import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  Button,
  Input,
  Label,
  SearchField,
  Separator,
  Switch,
  Typography,
  useToast,
} from 'heroui-native';
import { ArrowDown, ArrowUp, ImagePlus, Minus, Plus, Trash2 } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { FormError } from '@/components/FormError';
import { SelectPill } from '@/components/SelectPill';
import { protectBrand } from '@/components/brand/BrandText';
import { useProducts } from '@/lib/api/catalog';
import {
  useAddHomeSectionItem,
  useAdminAdBanners,
  useAdminHomeSectionItems,
  useAdminHomeSections,
  useDeleteAdBanner,
  useRemoveHomeSectionItem,
  useSaveAdBanner,
  useSaveHomeSection,
  useSwapHomeSectionItems,
  type AdBannerInput,
} from '@/lib/api/home';
import { pickImages, uploadImage } from '@/lib/api/upload';
import { BRAND } from '@/lib/brand';
import { formatPrice } from '@/lib/format';
import {
  AD_BANNER_LINK_LABEL,
  AD_BANNER_LINK_TYPES,
  AD_BANNER_PLACEMENT_LABEL,
  AD_BANNER_PLACEMENTS,
  HOME_AUTO_KIND_LABEL,
  HOME_AUTO_KINDS,
  type AdBanner,
  type AdBannerLinkType,
  type AdBannerPlacement,
  type HomeSection,
} from '@/lib/types';

const EMPTY_BANNER: AdBannerInput = {
  title: '',
  subtitle: '',
  image_url: null,
  link_type: 'none',
  link_value: null,
  cta_label: '立即查看',
  placement: 'carousel',
  is_active: false,
  sort_order: 10,
};

const PLACEMENT_HINT: Record<AdBannerPlacement, string> = {
  carousel: '出現在首頁分類圖示下方的輪播。',
  popup: '使用者打開 App 時跳出全螢幕商品廣告，同一支一天最多跳一次。',
  both: '首頁輪播與開啟時的彈出廣告都會出現。',
};

const LINK_HINT: Record<AdBannerLinkType, string> = {
  none: '只顯示圖文，點了不會跳頁。',
  product: '填商品 ID（商品詳情網址最後那一段）。',
  store: '填店舖 ID。',
  category: '填分類 ID。',
  search: '填搜尋關鍵字，留空就帶到全部商品。',
};

/** 一個首頁欄位的設定卡：顯示開關、標題、來源（自動／人工）、版面與數量。 */
function SectionEditor({
  section,
  userId,
  canMoveUp,
  canMoveDown,
  onMove,
}: {
  section: HomeSection;
  userId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const { toast } = useToast();
  const save = useSaveHomeSection();
  const [title, setTitle] = useState(section.title);
  const [subtitle, setSubtitle] = useState(section.subtitle);
  const [error, setError] = useState<string | null>(null);

  const items = useAdminHomeSectionItems(section.source === 'manual' ? section.key : null);
  const addItem = useAddHomeSectionItem();
  const removeItem = useRemoveHomeSectionItem();
  const swapItems = useSwapHomeSectionItems();
  const [search, setSearch] = useState('');
  const candidates = useProducts({ q: search.trim() || undefined, limit: 12 });

  const pickedIds = useMemo(
    () => new Set((items.data ?? []).map((item) => item.product_id)),
    [items.data],
  );

  const patch = (values: Parameters<typeof save.mutate>[0]['patch']) => {
    setError(null);
    save.mutate(
      { key: section.key, patch: values, userId },
      {
        onSuccess: () => toast.show({ variant: 'success', label: `已更新「${section.title}」` }),
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  const nextSortOrder = ((items.data ?? []).at(-1)?.sort_order ?? 0) + 10;

  return (
    <View className="bg-surface gap-3 rounded-2xl p-4">
      <View className="flex-row items-center gap-2">
        <Typography
          type="body"
          numberOfLines={1}
          className="text-navy flex-1"
          style={{ fontWeight: '700' }}
        >
          {section.title}
        </Typography>
        <Typography type="body-xs" color="muted">
          {section.is_visible ? '顯示中' : '已隱藏'}
        </Typography>
        <Switch
          isSelected={section.is_visible}
          onSelectedChange={(next) => patch({ is_visible: next })}
        />
      </View>

      <FormError message={error} />

      <View className="flex-row items-center gap-2">
        <SelectPill
          size="sm"
          label="上移"
          disabled={!canMoveUp}
          selected={false}
          onPress={() => onMove(-1)}
        />
        <SelectPill
          size="sm"
          label="下移"
          disabled={!canMoveDown}
          selected={false}
          onPress={() => onMove(1)}
        />
        <Typography type="body-xs" color="muted" className="flex-1">
          排序 {section.sort_order}
        </Typography>
      </View>

      <View>
        <Label>欄位標題</Label>
        <Input value={title} onChangeText={setTitle} />
      </View>
      <View>
        <Label>副標題（可留空）</Label>
        <Input value={subtitle} onChangeText={setSubtitle} />
      </View>
      <Button
        size="sm"
        variant="secondary"
        isDisabled={save.isPending}
        onPress={() => patch({ title: title.trim() || section.title, subtitle: subtitle.trim() })}
      >
        <Button.Label>儲存標題</Button.Label>
      </Button>

      <Separator />

      <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
        內容來源
      </Typography>
      <View className="flex-row flex-wrap gap-2">
        <SelectPill
          size="sm"
          label="系統自動"
          selected={section.source === 'auto'}
          onPress={() => patch({ source: 'auto' })}
        />
        <SelectPill
          size="sm"
          label="管理員挑選"
          selected={section.source === 'manual'}
          onPress={() => patch({ source: 'manual' })}
        />
      </View>

      {section.source === 'auto' ? (
        <>
          <Typography type="body-xs" color="muted">
            自動規則：系統即時從上架中的商品挑選，不需要人工維護。
          </Typography>
          <View className="flex-row flex-wrap gap-2">
            {HOME_AUTO_KINDS.map((kind) => (
              <SelectPill
                key={kind}
                size="sm"
                tone="soft"
                label={HOME_AUTO_KIND_LABEL[kind]}
                selected={section.auto_kind === kind}
                onPress={() => patch({ auto_kind: kind })}
              />
            ))}
          </View>
        </>
      ) : (
        <>
          <Typography type="body-xs" color="muted">
            只有下面這些商品會出現在首頁；商品下架或被停權時會自動從首頁消失。
          </Typography>

          {(items.data ?? []).length === 0 ? (
            <Typography type="body-xs" color="muted">
              還沒挑選任何商品，這一區目前不會出現在首頁。
            </Typography>
          ) : null}

          {(items.data ?? []).map((item, index, list) => (
            <View
              key={item.id}
              className="bg-background flex-row items-center gap-2 rounded-xl p-2"
            >
              <AppImage uri={item.product?.cover_url ?? null} className="h-10 w-10 rounded-lg" />
              <View className="flex-1">
                <Typography type="body-xs" numberOfLines={1} className="text-navy">
                  {item.product?.title ?? '商品已刪除'}
                </Typography>
                <Typography type="body-xs" color="muted">
                  {item.product ? formatPrice(item.product.price) : ''}
                </Typography>
              </View>
              <Pressable
                hitSlop={6}
                disabled={index === 0 || swapItems.isPending}
                onPress={() =>
                  swapItems.mutate({
                    a: { id: item.id, sort_order: item.sort_order },
                    b: { id: list[index - 1].id, sort_order: list[index - 1].sort_order },
                  })
                }
                style={{ opacity: index === 0 ? 0.35 : 1 }}
              >
                <ArrowUp size={16} color={BRAND.navy} />
              </Pressable>
              <Pressable
                hitSlop={6}
                disabled={index === list.length - 1 || swapItems.isPending}
                onPress={() =>
                  swapItems.mutate({
                    a: { id: item.id, sort_order: item.sort_order },
                    b: { id: list[index + 1].id, sort_order: list[index + 1].sort_order },
                  })
                }
                style={{ opacity: index === list.length - 1 ? 0.35 : 1 }}
              >
                <ArrowDown size={16} color={BRAND.navy} />
              </Pressable>
              <Pressable hitSlop={6} onPress={() => removeItem.mutate(item.id)}>
                <Trash2 size={16} color={BRAND.danger} />
              </Pressable>
            </View>
          ))}

          <SearchField value={search} onChange={setSearch}>
            <SearchField.Group className="rounded-full">
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="搜尋要加入的商品" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>

          {(candidates.data ?? []).map((product) => (
            <View
              key={product.id}
              className="border-border flex-row items-center gap-2 rounded-xl border p-2"
            >
              <AppImage uri={product.cover_url} className="h-10 w-10 rounded-lg" />
              <View className="flex-1">
                <Typography type="body-xs" numberOfLines={1} className="text-navy">
                  {product.title}
                </Typography>
                <Typography type="body-xs" color="muted">
                  {formatPrice(product.price)} · {protectBrand(product.store?.name ?? '極貨網賣家')}
                </Typography>
              </View>
              <SelectPill
                size="sm"
                label={pickedIds.has(product.id) ? '已加入' : '加入'}
                selected={pickedIds.has(product.id)}
                disabled={pickedIds.has(product.id) || addItem.isPending}
                onPress={() =>
                  addItem.mutate(
                    {
                      sectionKey: section.key,
                      productId: product.id,
                      userId,
                      nextSortOrder,
                    },
                    {
                      onSuccess: () => toast.show({ variant: 'success', label: '已加入首頁' }),
                      onError: (err: Error) => setError(err.message),
                    },
                  )
                }
              />
            </View>
          ))}
        </>
      )}

      <Separator />

      <View className="flex-row flex-wrap items-center gap-2">
        <Typography type="body-sm" className="text-navy" style={{ fontWeight: '600' }}>
          版面
        </Typography>
        <SelectPill
          size="sm"
          tone="soft"
          label="橫向滑動"
          selected={section.layout === 'rail'}
          onPress={() => patch({ layout: 'rail' })}
        />
        <SelectPill
          size="sm"
          tone="soft"
          label="兩欄方格"
          selected={section.layout === 'grid'}
          onPress={() => patch({ layout: 'grid' })}
        />
      </View>

      <View className="flex-row items-center gap-3">
        <Typography type="body-sm" className="text-navy flex-1" style={{ fontWeight: '600' }}>
          最多顯示 {section.item_limit} 件
        </Typography>
        <Pressable
          hitSlop={6}
          disabled={section.item_limit <= 2 || save.isPending}
          onPress={() => patch({ item_limit: section.item_limit - 2 })}
          className="bg-background h-8 w-8 items-center justify-center rounded-full"
          style={{ opacity: section.item_limit <= 2 ? 0.4 : 1 }}
        >
          <Minus size={14} color={BRAND.navy} />
        </Pressable>
        <Pressable
          hitSlop={6}
          disabled={section.item_limit >= 24 || save.isPending}
          onPress={() => patch({ item_limit: section.item_limit + 2 })}
          className="bg-background h-8 w-8 items-center justify-center rounded-full"
          style={{ opacity: section.item_limit >= 24 ? 0.4 : 1 }}
        >
          <Plus size={14} color={BRAND.navy} />
        </Pressable>
      </View>
    </View>
  );
}

/** 廣告輪播管理：新增／編輯一張橫幅，並決定要不要上架。 */
function BannerEditor({ userId }: { userId: string }) {
  const { toast } = useToast();
  const banners = useAdminAdBanners(true);
  const saveBanner = useSaveAdBanner();
  const deleteBanner = useDeleteAdBanner();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<AdBannerInput>(EMPTY_BANNER);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (banner: AdBanner) => {
    setEditingId(banner.id);
    setValues({
      title: banner.title,
      subtitle: banner.subtitle,
      image_url: banner.image_url,
      link_type: banner.link_type,
      link_value: banner.link_value,
      cta_label: banner.cta_label,
      placement: banner.placement,
      is_active: banner.is_active,
      sort_order: banner.sort_order,
    });
    setError(null);
  };

  const reset = () => {
    setEditingId(null);
    setValues({ ...EMPTY_BANNER, sort_order: ((banners.data ?? []).at(-1)?.sort_order ?? 0) + 10 });
    setError(null);
  };

  const upload = async () => {
    try {
      setUploading(true);
      const picked = await pickImages(1);
      if (picked.length === 0) return;
      const url = await uploadImage('store-assets', userId, picked[0]);
      setValues((current) => ({ ...current, image_url: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗');
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (!values.title.trim()) {
      setError('請填寫廣告標題');
      return;
    }
    if (
      values.link_type !== 'none' &&
      values.link_type !== 'search' &&
      !values.link_value?.trim()
    ) {
      setError('請填寫連結目標的 ID');
      return;
    }
    setError(null);
    saveBanner.mutate(
      {
        id: editingId ?? undefined,
        userId,
        values: {
          ...values,
          title: values.title.trim(),
          subtitle: values.subtitle.trim(),
          cta_label: values.cta_label.trim() || '立即查看',
          link_value: values.link_value?.trim() ?? null,
        },
      },
      {
        onSuccess: () => {
          toast.show({ variant: 'success', label: editingId ? '已更新廣告' : '已新增廣告' });
          reset();
        },
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  return (
    <View className="gap-3">
      <View className="bg-surface gap-3 rounded-2xl p-4">
        <Typography type="body" className="text-navy" style={{ fontWeight: '700' }}>
          {editingId ? '編輯廣告' : '新增廣告'}
        </Typography>
        <Typography type="body-xs" color="muted">
          橫幅要按下「上架顯示」才會出現。版位可選首頁輪播、開啟 App
          時的彈出廣告，或兩邊都放；沒有任何上架中的橫幅時，系統會自動用降價最多的商品補位。
        </Typography>

        <FormError message={error} />

        <View>
          <Label isRequired>標題</Label>
          <Input
            value={values.title}
            onChangeText={(text) => setValues((current) => ({ ...current, title: text }))}
          />
        </View>
        <View>
          <Label>說明文字</Label>
          <Input
            value={values.subtitle}
            onChangeText={(text) => setValues((current) => ({ ...current, subtitle: text }))}
          />
        </View>
        <View>
          <Label>按鈕文字</Label>
          <Input
            value={values.cta_label}
            onChangeText={(text) => setValues((current) => ({ ...current, cta_label: text }))}
          />
        </View>

        <View className="gap-2">
          <Label>廣告圖片</Label>
          <View className="flex-row items-center gap-3">
            <AppImage uri={values.image_url} className="h-16 w-28 rounded-xl" />
            <Button
              size="sm"
              variant="secondary"
              isDisabled={uploading}
              onPress={() => void upload()}
            >
              <ImagePlus size={14} color={BRAND.navy} />
              <Button.Label>{uploading ? '上傳中…' : '上傳圖片'}</Button.Label>
            </Button>
            {values.image_url ? (
              <Pressable
                hitSlop={6}
                onPress={() => setValues((current) => ({ ...current, image_url: null }))}
              >
                <Typography type="body-xs" className="text-brand-orange">
                  移除圖片
                </Typography>
              </Pressable>
            ) : null}
          </View>
          <Typography type="body-xs" color="muted">
            沒有圖片時會用品牌漸層底色，文字一樣看得清楚。建議尺寸 1200 × 600。
          </Typography>
        </View>

        <View className="gap-2">
          <Label>點擊後前往</Label>
          <View className="flex-row flex-wrap gap-2">
            {AD_BANNER_LINK_TYPES.map((type) => (
              <SelectPill
                key={type}
                size="sm"
                tone="soft"
                label={AD_BANNER_LINK_LABEL[type]}
                selected={values.link_type === type}
                onPress={() => setValues((current) => ({ ...current, link_type: type }))}
              />
            ))}
          </View>
          <Typography type="body-xs" color="muted">
            {LINK_HINT[values.link_type]}
          </Typography>
          {values.link_type === 'none' ? null : (
            <Input
              value={values.link_value ?? ''}
              autoCapitalize="none"
              onChangeText={(text) => setValues((current) => ({ ...current, link_value: text }))}
            />
          )}
        </View>

        <View className="gap-2">
          <Label>顯示版位</Label>
          <View className="flex-row flex-wrap gap-2">
            {AD_BANNER_PLACEMENTS.map((placement) => (
              <SelectPill
                key={placement}
                size="sm"
                tone="soft"
                label={AD_BANNER_PLACEMENT_LABEL[placement]}
                selected={values.placement === placement}
                onPress={() => setValues((current) => ({ ...current, placement }))}
              />
            ))}
          </View>
          <Typography type="body-xs" color="muted">
            {PLACEMENT_HINT[values.placement]}
          </Typography>
        </View>

        <View className="flex-row items-center gap-3">
          <Typography type="body-sm" className="text-navy flex-1">
            上架顯示（審核通過）
          </Typography>
          <Switch
            isSelected={values.is_active}
            onSelectedChange={(next) => setValues((current) => ({ ...current, is_active: next }))}
          />
        </View>

        <View className="flex-row items-center gap-3">
          <Typography type="body-sm" className="text-navy flex-1">
            排序（數字小的先出現）
          </Typography>
          <Input
            className="w-24"
            keyboardType="number-pad"
            value={String(values.sort_order)}
            onChangeText={(text) =>
              setValues((current) => ({
                ...current,
                sort_order: Number(text.replace(/\D/g, '')) || 0,
              }))
            }
          />
        </View>

        <View className="flex-row gap-2">
          <Button className="flex-1" isDisabled={saveBanner.isPending} onPress={submit}>
            <Button.Label>{editingId ? '儲存變更' : '新增廣告'}</Button.Label>
          </Button>
          {editingId ? (
            <Button variant="secondary" onPress={reset}>
              <Button.Label>取消</Button.Label>
            </Button>
          ) : null}
        </View>
      </View>

      {(banners.data ?? []).map((banner) => (
        <View key={banner.id} className="bg-surface gap-2 rounded-2xl p-4">
          <View className="flex-row items-center gap-3">
            <AppImage uri={banner.image_url} className="h-14 w-24 rounded-xl" />
            <View className="flex-1">
              <Typography
                type="body-sm"
                numberOfLines={1}
                className="text-navy"
                style={{ fontWeight: '600' }}
              >
                {banner.title}
              </Typography>
              <Typography type="body-xs" color="muted" numberOfLines={1}>
                {banner.subtitle || '（沒有說明文字）'}
              </Typography>
              <Typography type="body-xs" color="muted">
                {AD_BANNER_PLACEMENT_LABEL[banner.placement]} ·{' '}
                {AD_BANNER_LINK_LABEL[banner.link_type]}
                {banner.link_value ? ` · ${banner.link_value}` : ''} · 排序 {banner.sort_order}
              </Typography>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <Typography type="body-xs" color="muted" className="flex-1">
              {banner.is_active ? '上架中' : '未上架'}
            </Typography>
            <SelectPill
              size="sm"
              tone="soft"
              label={banner.is_active ? '下架' : '上架'}
              selected={banner.is_active}
              onPress={() =>
                saveBanner.mutate(
                  {
                    id: banner.id,
                    userId,
                    values: {
                      title: banner.title,
                      subtitle: banner.subtitle,
                      image_url: banner.image_url,
                      link_type: banner.link_type,
                      link_value: banner.link_value,
                      cta_label: banner.cta_label,
                      placement: banner.placement,
                      is_active: !banner.is_active,
                      sort_order: banner.sort_order,
                    },
                  },
                  {
                    onSuccess: () =>
                      toast.show({
                        variant: 'success',
                        label: banner.is_active ? '已下架' : '已上架',
                      }),
                    onError: (err: Error) => setError(err.message),
                  },
                )
              }
            />
            <SelectPill size="sm" label="編輯" selected={false} onPress={() => startEdit(banner)} />
            <Pressable
              hitSlop={6}
              disabled={deleteBanner.isPending}
              onPress={() =>
                deleteBanner.mutate(banner.id, {
                  onSuccess: () => toast.show({ variant: 'success', label: '已刪除廣告' }),
                  onError: (err: Error) => setError(err.message),
                })
              }
            >
              <Trash2 size={16} color={BRAND.danger} />
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * 後台「首頁內容」分頁：決定首頁每一個推薦欄位要不要出現、內容由系統自動
 * 產生或由管理員逐件審核，以及廣告輪播的橫幅。
 */
export function AdminHomePanel({ userId }: { userId: string }) {
  const { toast } = useToast();
  const sections = useAdminHomeSections(true);
  const save = useSaveHomeSection();

  const list = sections.data ?? [];

  const move = (index: number, direction: -1 | 1) => {
    const current = list[index];
    const neighbour = list[index + direction];
    if (!current || !neighbour) return;
    save.mutate(
      { key: current.key, patch: { sort_order: neighbour.sort_order }, userId },
      {
        onSuccess: () =>
          save.mutate(
            { key: neighbour.key, patch: { sort_order: current.sort_order }, userId },
            {
              onError: (err: Error) => toast.show({ variant: 'danger', label: err.message }),
            },
          ),
        onError: (err: Error) => toast.show({ variant: 'danger', label: err.message }),
      },
    );
  };

  return (
    <View className="gap-3">
      <View className="bg-surface gap-1 rounded-2xl p-4">
        <Typography type="body" className="text-navy" style={{ fontWeight: '700' }}>
          首頁推薦欄位
        </Typography>
        <Typography type="body-xs" color="muted">
          限時特賣、熱門推薦、好評推薦等區塊都在這裡控制：可以整區隱藏、改標題與順序，也可以把內容從「系統自動」切成「管理員挑選」，改成只顯示審核過的商品。
        </Typography>
      </View>

      {list.map((section, index) => (
        <SectionEditor
          key={section.key}
          section={section}
          userId={userId}
          canMoveUp={index > 0}
          canMoveDown={index < list.length - 1}
          onMove={(direction) => move(index, direction)}
        />
      ))}

      <View className="bg-surface gap-1 rounded-2xl p-4">
        <Typography type="body" className="text-navy" style={{ fontWeight: '700' }}>
          首頁廣告與彈出廣告
        </Typography>
        <Typography type="body-xs" color="muted">
          輪播出現在分類圖示下方，5 秒換一張；彈出廣告會在使用者打開 App
          時蓋在首頁上，同一支一天最多跳一次。兩者都只顯示審核後上架的橫幅，沒有的話由系統自動挑降價最多的商品。
        </Typography>
      </View>

      <BannerEditor userId={userId} />
    </View>
  );
}
