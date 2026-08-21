import * as ImagePicker from 'expo-image-picker';

import { bilt } from '@/lib/backend';

export type PickedImage = { uri: string; mimeType: string };

export async function pickImages(limit = 6): Promise<PickedImage[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('需要相片存取權限才能上傳商品圖片');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 0.8,
  });
  if (result.canceled) return [];

  return result.assets.map((asset) => ({
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
  }));
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

/** Uploads a picked image into a public bucket under `<userId>/...` and returns its public URL. */
export async function uploadImage(
  bucket: 'product-images' | 'store-assets',
  userId: string,
  image: PickedImage,
): Promise<string> {
  const response = await fetch(image.uri);
  const blob = await response.blob();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(image.mimeType)}`;

  const { error } = await bilt.storage.from(bucket).upload(path, blob, {
    contentType: image.mimeType,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return bilt.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
