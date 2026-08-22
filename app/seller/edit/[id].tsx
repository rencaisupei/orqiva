import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, Input, Label, Spinner, TextArea, useToast } from 'heroui-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AppImage } from '@/components/AppImage';
import { EmptyState } from '@/components/EmptyState';
import { FormError } from '@/components/FormError';
import { OptionSelect, type SelectOption } from '@/components/OptionSelect';
import { SelectPill } from '@/components/SelectPill';
import { SignInRequired } from '@/components/SignInRequired';
import { useCategories, useProduct } from '@/lib/api/catalog';
import { useDeleteProduct, useUpdateProduct } from '@/lib/api/seller';
import { goBackOrReplace } from '@/lib/navigation';
import { useUserId } from '@/lib/session';
import { LOCATIONS, SHIPPING_METHODS, type ProductCondition } from '@/lib/types';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const { toast } = useToast();
  const { data: product, isLoading } = useProduct(id);
  const { data: categories } = useCategories();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [condition, setCondition] = useState<ProductCondition>('new');
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const [shipping, setShipping] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = useMemo<SelectOption[]>(
    () =>
      (categories ?? []).map((category) => ({
        value: category.id,
        label: category.name,
        hint: category.name_en ?? undefined,
      })),
    [categories],
  );

  useEffect(() => {
    if (!product) return;
    setTitle(product.title);
    setDescription(product.description);
    setPrice(String(Math.round(product.price)));
    setOriginalPrice(product.original_price ? String(Math.round(product.original_price)) : '');
    setStock(String(product.stock));
    setCategoryId(product.category_id);
    setCondition(product.condition);
    setLocation(product.location);
    setShipping(product.shipping_methods);
  }, [product]);

  if (!userId) {
    return <SignInRequired title="登入後編輯商品" />;
  }

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  if (!product) {
    return (
      <View className="bg-background flex-1">
        <EmptyState title="找不到這件商品" />
      </View>
    );
  }

  if (product.seller_id !== userId) {
    return (
      <View className="bg-background flex-1">
        <EmptyState title="無法編輯" description="只有商品的賣家可以編輯這件商品。" />
      </View>
    );
  }

  const save = () => {
    if (!title.trim()) {
      setError('請填寫商品名稱');
      return;
    }
    const priceValue = Number(price);
    if (!price || priceValue <= 0) {
      setError('請填寫有效的售價');
      return;
    }
    if (originalPrice && Number(originalPrice) < priceValue) {
      setError('原價不可低於售價');
      return;
    }
    if (shipping.length === 0) {
      setError('請至少選擇一種配送方式');
      return;
    }
    setError(null);

    updateProduct.mutate(
      {
        productId: product.id,
        patch: {
          title: title.trim(),
          description: description.trim(),
          price: priceValue,
          original_price: originalPrice ? Number(originalPrice) : null,
          stock: Number(stock || 0),
          category_id: categoryId,
          condition,
          location,
          shipping_methods: shipping,
        },
      },
      {
        onSuccess: () => toast.show({ variant: 'success', label: '商品已更新' }),
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="p-4 gap-3 pb-8" keyboardShouldPersistTaps="handled">
        <View className="flex-row gap-2">
          {(product.product_images ?? []).slice(0, 4).map((image) => (
            <AppImage key={image.id} uri={image.url} className="h-20 w-20 rounded-xl" />
          ))}
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <View>
            <Label isRequired>商品名稱</Label>
            <Input value={title} onChangeText={setTitle} />
          </View>
          <View>
            <Label>商品描述</Label>
            <TextArea value={description} onChangeText={setDescription} numberOfLines={5} />
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Label isRequired>售價</Label>
              <Input
                keyboardType="numeric"
                value={price}
                onChangeText={(v) => setPrice(v.replace(/\D/g, ''))}
              />
            </View>
            <View className="flex-1">
              <Label>原價</Label>
              <Input
                keyboardType="numeric"
                value={originalPrice}
                onChangeText={(v) => setOriginalPrice(v.replace(/\D/g, ''))}
              />
            </View>
            <View className="flex-1">
              <Label>庫存</Label>
              <Input
                keyboardType="numeric"
                value={stock}
                onChangeText={(v) => setStock(v.replace(/\D/g, ''))}
              />
            </View>
          </View>

          <OptionSelect
            label="商品分類"
            searchable
            searchPlaceholder="搜尋分類"
            placeholder="請選擇商品分類"
            options={categoryOptions}
            value={categoryId}
            onChange={setCategoryId}
          />

          <View className="gap-2">
            <Label>商品狀態</Label>
            <View className="flex-row gap-2">
              {(['new', 'used'] as ProductCondition[]).map((value) => (
                <SelectPill
                  key={value}
                  size="sm"
                  label={value === 'new' ? '全新' : '二手'}
                  selected={condition === value}
                  onPress={() => setCondition(value)}
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Label>配送方式</Label>
            <View className="flex-row flex-wrap gap-2">
              {SHIPPING_METHODS.map((method) => (
                <SelectPill
                  key={method}
                  size="sm"
                  label={method}
                  selected={shipping.includes(method)}
                  onPress={() =>
                    setShipping((prev) =>
                      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
                    )
                  }
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Label>所在地</Label>
            <View className="flex-row flex-wrap gap-2">
              {LOCATIONS.map((item) => (
                <SelectPill
                  key={item}
                  size="sm"
                  label={item}
                  selected={location === item}
                  onPress={() => setLocation(item)}
                />
              ))}
            </View>
          </View>

          <FormError message={error} />

          <Button isDisabled={updateProduct.isPending} onPress={save}>
            <Button.Label>{updateProduct.isPending ? '儲存中…' : '儲存變更'}</Button.Label>
          </Button>
          <Button
            variant="danger-soft"
            isDisabled={deleteProduct.isPending}
            onPress={() =>
              deleteProduct.mutate(product.id, {
                onSuccess: () => {
                  toast.show({ variant: 'success', label: '商品已刪除' });
                  goBackOrReplace('/seller/products');
                },
                onError: (err: Error) => setError(err.message),
              })
            }
          >
            <Button.Label>刪除商品</Button.Label>
          </Button>
          <Button
            variant="ghost"
            onPress={() => router.push({ pathname: '/products/[id]', params: { id: product.id } })}
          >
            <Button.Label>預覽商品頁</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
