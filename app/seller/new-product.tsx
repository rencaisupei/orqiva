import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import {
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  Separator,
  Spinner,
  TextArea,
  Typography,
} from 'heroui-native';
import { router } from 'expo-router';
import { CheckCircle2, ImagePlus, Plus, ShieldAlert, Trash2, X } from 'lucide-react-native';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { OptionSelect, type SelectOption } from '@/components/OptionSelect';
import { SignInRequired } from '@/components/SignInRequired';
import { useCategories } from '@/lib/api/catalog';
import { useCreateProduct, useMyStoreQuery, type ProductDraft } from '@/lib/api/seller';
import { pickImages, uploadImage } from '@/lib/api/upload';
import { BRAND } from '@/lib/brand';
import { formatPrice } from '@/lib/format';
import { useUserId } from '@/lib/session';
import {
  LOCATIONS,
  SHIPPING_METHODS,
  type ModerationResult,
  type ProductCondition,
} from '@/lib/types';

const STEPS = [
  '商品圖片',
  '商品名稱',
  '分類',
  '商品描述',
  '價格',
  '庫存',
  '商品規格',
  '配送方式',
  '確認上架',
];

type SpecRow = { id: string; key: string; value: string };

function newSpecRow(): SpecRow {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, key: '', value: '' };
}

export default function NewProductScreen() {
  const userId = useUserId();
  const { data: store, isLoading: storeLoading } = useMyStoreQuery(userId);
  const { data: categories } = useCategories();
  const createProduct = useCreateProduct();

  const [step, setStep] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [specs, setSpecs] = useState<SpecRow[]>([newSpecRow()]);
  const [shipping, setShipping] = useState<string[]>(['宅配']);
  const [condition, setCondition] = useState<ProductCondition>('new');
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [moderation, setModeration] = useState<ModerationResult | null>(null);

  const categoryOptions = useMemo<SelectOption[]>(
    () =>
      (categories ?? []).map((category) => ({
        value: category.id,
        label: category.name,
        hint: category.name_en ?? undefined,
      })),
    [categories],
  );

  if (!userId) {
    return <SignInRequired title="登入後才能上架商品" />;
  }

  if (storeLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (!store) {
    return (
      <View className="bg-background flex-1">
        <EmptyState
          title="需要先建立店舖"
          description="極貨網的商品都屬於一間店舖，先完成店舖設定再上架。"
          action={
            <Button onPress={() => router.replace('/seller/onboarding')}>
              <Button.Label>建立店舖</Button.Label>
            </Button>
          }
        />
      </View>
    );
  }

  if (done) {
    const verdict = moderation?.verdict ?? 'pending';
    const heading =
      verdict === 'approved'
        ? '商品已通過審核並上架'
        : verdict === 'rejected'
          ? '商品未通過 AI 審核'
          : verdict === 'flagged'
            ? '已送出，等待人工覆核'
            : '已送出，AI 正在審核';
    const detail =
      verdict === 'approved'
        ? `買家現在可以在極貨網搜尋到「${title}」。`
        : moderation
          ? `${moderation.summary} ${moderation.suggestion}`.trim()
          : `「${title}」已建立，審核通過後買家就會看到。可在商品管理查看結果。`;

    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 px-8">
        {verdict === 'approved' ? (
          <CheckCircle2 size={56} color={BRAND.blue} />
        ) : (
          <ShieldAlert size={56} color={verdict === 'rejected' ? BRAND.orange : BRAND.yellow} />
        )}
        <Typography type="h4" align="center" className="text-navy" style={{ fontWeight: '700' }}>
          {heading}
        </Typography>
        <Typography type="body-sm" align="center" color="muted">
          {detail}
        </Typography>
        {moderation && moderation.labels.length > 0 ? (
          <View className="flex-row flex-wrap justify-center gap-1.5">
            {moderation.labels.map((label) => (
              <Chip key={label} size="sm" variant="soft" color="warning">
                {label}
              </Chip>
            ))}
          </View>
        ) : null}
        <View className="mt-2 w-full gap-2">
          <Button onPress={() => router.replace('/seller/products')}>
            <Button.Label>查看我的商品</Button.Label>
          </Button>
          <Button
            variant="secondary"
            onPress={() => {
              setDone(false);
              setModeration(null);
              setStep(0);
              setImages([]);
              setTitle('');
              setCategoryId(null);
              setDescription('');
              setPrice('');
              setOriginalPrice('');
              setStock('1');
              setSpecs([newSpecRow()]);
              setShipping(['宅配']);
              setCondition('new');
            }}
          >
            <Button.Label>再上架一件商品</Button.Label>
          </Button>
        </View>
      </View>
    );
  }

  const addImages = async () => {
    try {
      setUploading(true);
      setError(null);
      const picked = await pickImages(6 - images.length);
      if (picked.length === 0) return;
      const urls: string[] = [];
      for (const image of picked) {
        urls.push(await uploadImage('product-images', userId, image));
      }
      setImages((prev) => [...prev, ...urls].slice(0, 6));
    } catch (err) {
      setError(err instanceof Error ? err.message : '圖片上傳失敗');
    } finally {
      setUploading(false);
    }
  };

  const validateStep = (): string | null => {
    switch (step) {
      case 0:
        return images.length === 0 ? '請至少上傳一張商品圖片' : null;
      case 1:
        return title.trim().length < 2 ? '請填寫商品名稱' : null;
      case 2:
        return categoryId ? null : '請選擇一個分類';
      case 3:
        return description.trim().length < 5 ? '請簡單描述商品狀態與內容' : null;
      case 4: {
        const value = Number(price);
        if (!price || Number.isNaN(value) || value <= 0) return '請填寫有效的售價';
        if (originalPrice && Number(originalPrice) < value) return '原價不可低於售價';
        return null;
      }
      case 5:
        return Number(stock) >= 0 && stock !== '' ? null : '請填寫庫存數量';
      case 7:
        return shipping.length === 0 ? '請至少選擇一種配送方式' : null;
      default:
        return null;
    }
  };

  const next = () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const publish = () => {
    const specMap: Record<string, string> = {};
    for (const row of specs) {
      if (row.key.trim() && row.value.trim()) specMap[row.key.trim()] = row.value.trim();
    }

    const draft: ProductDraft = {
      title: title.trim(),
      description: description.trim(),
      categoryId,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : null,
      stock: Number(stock),
      condition,
      location,
      shippingMethods: shipping,
      specs: specMap,
      images,
      status: 'active',
    };

    createProduct.mutate(
      { userId, storeId: store.id, draft },
      {
        onSuccess: (result) => {
          setModeration(result.moderation);
          setDone(true);
        },
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="bg-surface px-4 py-3">
        <View className="flex-row items-center justify-between gap-3">
          <Typography
            type="body-sm"
            numberOfLines={1}
            className="text-navy flex-1"
            style={{ fontWeight: '600' }}
          >
            步驟 {step + 1} / {STEPS.length} · {STEPS[step]}
          </Typography>
          <Typography type="body-xs" color="muted" numberOfLines={1} className="max-w-[38%]">
            {store.name}
          </Typography>
        </View>
        <View className="bg-default mt-2 h-1.5 overflow-hidden rounded-full">
          <View
            className="h-full rounded-full"
            style={{
              width: `${((step + 1) / STEPS.length) * 100}%`,
              backgroundColor: BRAND.orange,
            }}
          />
        </View>
      </View>

      <ScrollView contentContainerClassName="p-4 gap-3 pb-6" keyboardShouldPersistTaps="handled">
        <View className="bg-surface gap-3 rounded-2xl p-4">
          {step === 0 ? (
            <>
              <Label isRequired>商品圖片（最多 6 張）</Label>
              <View className="flex-row flex-wrap gap-2">
                {images.map((url) => (
                  <View key={url}>
                    <AppImage uri={url} className="h-24 w-24 rounded-xl" />
                    <Pressable
                      className="bg-navy absolute -top-1.5 -right-1.5 h-6 w-6 items-center justify-center rounded-full"
                      onPress={() => setImages((prev) => prev.filter((u) => u !== url))}
                      accessibilityLabel="移除圖片"
                    >
                      <X size={13} color={BRAND.white} />
                    </Pressable>
                  </View>
                ))}
                {images.length < 6 ? (
                  <Pressable
                    className="border-border bg-background h-24 w-24 items-center justify-center gap-1 rounded-xl border border-dashed"
                    disabled={uploading}
                    onPress={() => void addImages()}
                  >
                    {uploading ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        <ImagePlus size={20} color={BRAND.blue} />
                        <Typography type="body-xs" color="muted">
                          上傳
                        </Typography>
                      </>
                    )}
                  </Pressable>
                ) : null}
              </View>
              <Typography type="body-xs" color="muted">
                第一張圖片會作為商品封面。
              </Typography>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Label isRequired>商品名稱</Label>
              <Input
                placeholder="例如：iPhone 15 Pro 256GB 原色鈦金屬"
                value={title}
                onChangeText={setTitle}
              />
              <Typography type="body-xs" color="muted">
                建議包含品牌、型號與規格，買家更容易搜尋到。
              </Typography>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <OptionSelect
                label="商品分類"
                isRequired
                searchable
                searchPlaceholder="搜尋分類，例如：手機、寵物"
                placeholder="請選擇商品分類"
                description="選對分類，買家從分類頁就找得到你的商品。"
                options={categoryOptions}
                value={categoryId}
                onChange={setCategoryId}
              />
              <Typography type="body-xs" color="muted">
                極貨網只開放實體商品。序號、點數、帳號、軟體授權等數位虛擬商品禁止上架，相關分類已停用。
              </Typography>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Label isRequired>商品描述</Label>
              <TextArea
                placeholder="說明商品狀態、配件、保固與注意事項"
                value={description}
                onChangeText={setDescription}
                numberOfLines={6}
              />
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Label isRequired>售價（NT$）</Label>
              <Input
                placeholder="0"
                keyboardType="numeric"
                value={price}
                onChangeText={(v) => setPrice(v.replace(/\D/g, ''))}
              />
              <Label>原價（選填，用於顯示折扣）</Label>
              <Input
                placeholder="0"
                keyboardType="numeric"
                value={originalPrice}
                onChangeText={(v) => setOriginalPrice(v.replace(/\D/g, ''))}
              />
            </>
          ) : null}

          {step === 5 ? (
            <>
              <Label isRequired>庫存數量</Label>
              <Input
                placeholder="1"
                keyboardType="numeric"
                value={stock}
                onChangeText={(v) => setStock(v.replace(/\D/g, ''))}
              />
              <Typography type="body-xs" color="muted">
                買家下單後庫存會自動扣減，訂單取消則自動回補。
              </Typography>
            </>
          ) : null}

          {step === 6 ? (
            <>
              <Label>商品規格</Label>
              {specs.map((row) => (
                <View key={row.id} className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <Input
                      placeholder="規格名稱（如：容量）"
                      value={row.key}
                      onChangeText={(v) =>
                        setSpecs((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, key: v } : r)),
                        )
                      }
                    />
                  </View>
                  <View className="flex-1">
                    <Input
                      placeholder="內容（如：256GB）"
                      value={row.value}
                      onChangeText={(v) =>
                        setSpecs((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, value: v } : r)),
                        )
                      }
                    />
                  </View>
                  <Pressable
                    className="h-9 w-9 items-center justify-center"
                    onPress={() => setSpecs((prev) => prev.filter((r) => r.id !== row.id))}
                    accessibilityLabel="刪除規格"
                  >
                    <Trash2 size={15} color={BRAND.muted} />
                  </Pressable>
                </View>
              ))}
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onPress={() => setSpecs((prev) => [...prev, newSpecRow()])}
              >
                <View className="flex-row items-center gap-1.5">
                  <Plus size={14} color={BRAND.navy} />
                  <Typography type="body-sm" className="text-navy">
                    新增一列
                  </Typography>
                </View>
              </Button>
            </>
          ) : null}

          {step === 7 ? (
            <>
              <Label isRequired>配送方式（可多選）</Label>
              <View className="flex-row flex-wrap gap-2">
                {SHIPPING_METHODS.map((method) => (
                  <Pressable
                    key={method}
                    onPress={() =>
                      setShipping((prev) =>
                        prev.includes(method)
                          ? prev.filter((m) => m !== method)
                          : [...prev, method],
                      )
                    }
                  >
                    <Chip size="sm" variant={shipping.includes(method) ? 'primary' : 'tertiary'}>
                      {method}
                    </Chip>
                  </Pressable>
                ))}
              </View>

              <Label>商品狀態</Label>
              <View className="flex-row gap-2">
                {(['new', 'used'] as ProductCondition[]).map((value) => (
                  <Pressable key={value} onPress={() => setCondition(value)}>
                    <Chip size="sm" variant={condition === value ? 'primary' : 'tertiary'}>
                      {value === 'new' ? '全新' : '二手'}
                    </Chip>
                  </Pressable>
                ))}
              </View>

              <Label>商品所在地</Label>
              <View className="flex-row flex-wrap gap-2">
                {LOCATIONS.map((item) => (
                  <Pressable key={item} onPress={() => setLocation(item)}>
                    <Chip size="sm" variant={location === item ? 'primary' : 'tertiary'}>
                      {item}
                    </Chip>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {step === 8 ? (
            <>
              <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                確認上架資訊
              </Typography>
              <View className="flex-row gap-2">
                {images.slice(0, 3).map((url) => (
                  <AppImage key={url} uri={url} className="h-20 w-20 rounded-xl" />
                ))}
              </View>
              <Separator />
              <View className="gap-1.5">
                {[
                  ['商品名稱', title],
                  ['分類', (categories ?? []).find((c) => c.id === categoryId)?.name ?? '—'],
                  ['售價', formatPrice(Number(price || 0))],
                  ['原價', originalPrice ? formatPrice(Number(originalPrice)) : '未設定'],
                  ['庫存', `${stock} 件`],
                  ['狀態', condition === 'new' ? '全新' : '二手'],
                  ['所在地', location],
                  ['配送方式', shipping.join('、')],
                  [
                    '規格',
                    specs
                      .filter((s) => s.key && s.value)
                      .map((s) => `${s.key}：${s.value}`)
                      .join('、') || '未填寫',
                  ],
                ].map(([label, value]) => (
                  <View key={label} className="flex-row justify-between gap-4">
                    <Typography type="body-sm" color="muted">
                      {label}
                    </Typography>
                    <Typography type="body-sm" className="text-navy flex-1 text-right">
                      {value}
                    </Typography>
                  </View>
                ))}
              </View>
              <Separator />
              <Typography type="body-xs" color="muted">
                送出即表示你確認商品為實體商品、資訊真實，且不屬於禁售品（數位虛擬商品、仿冒品、管制物品等）。
              </Typography>
              <Pressable onPress={() => router.push('/legal/terms')} hitSlop={6}>
                <Typography
                  type="body-xs"
                  className="text-brand-blue"
                  style={{ fontWeight: '600' }}
                >
                  查看服務條款與禁售清單
                </Typography>
              </Pressable>
            </>
          ) : null}

          {error ? <FieldError>{error}</FieldError> : null}
        </View>
      </ScrollView>

      <View className="border-border bg-surface pb-safe-offset-3 flex-row gap-2 border-t px-4 py-3">
        {step > 0 ? (
          <Button variant="secondary" className="flex-1" onPress={() => setStep((s) => s - 1)}>
            <Button.Label>上一步</Button.Label>
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button className="flex-1" onPress={next}>
            <Button.Label>下一步</Button.Label>
          </Button>
        ) : (
          <Button className="flex-1" isDisabled={createProduct.isPending} onPress={publish}>
            <Button.Label>{createProduct.isPending ? '上架中…' : '確認上架'}</Button.Label>
          </Button>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
