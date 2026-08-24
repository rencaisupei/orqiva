import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { bilt } from '@/lib/backend';

export type PickedImage = { uri: string; mimeType: string; base64?: string | null };

export async function pickImages(limit = 6): Promise<PickedImage[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      permission.canAskAgain
        ? '需要相片存取權限才能上傳圖片'
        : '請到系統設定開啟極貨網的相片存取權限',
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 0.8,
    // React Native's fetch cannot read a file:// URI into a usable Blob, so the
    // bytes have to come straight from the picker on iOS/Android.
    base64: Platform.OS !== 'web',
  });
  if (result.canceled) return [];

  return result.assets.map((asset) => ({
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    base64: asset.base64 ?? null,
  }));
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodes base64 to raw bytes without depending on atob/Buffer being present. */
function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const byteLength = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let buffer = 0;
  let bits = 0;
  let index = 0;

  for (const char of clean) {
    const value = BASE64_ALPHABET.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index] = (buffer >> bits) & 0xff;
      index += 1;
    }
  }

  return index === byteLength ? bytes : bytes.subarray(0, index);
}

async function toUploadBody(image: PickedImage): Promise<Blob | ArrayBuffer> {
  if (image.base64) {
    const bytes = base64ToBytes(image.base64);
    // Copy into a fresh, plain ArrayBuffer: Uint8Array#buffer is typed as the
    // wider ArrayBufferLike (ArrayBuffer | SharedArrayBuffer), which the
    // storage client's upload body type does not accept.
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
  }

  // Web: the picker hands back a blob:/data: URL that fetch can read directly.
  const response = await fetch(image.uri);
  return await response.blob();
}

/** Uploads a picked image into a public bucket under `<userId>/...` and returns its public URL. */
export async function uploadImage(
  bucket: 'product-images' | 'store-assets' | 'review-images',
  userId: string,
  image: PickedImage,
): Promise<string> {
  const body = await toUploadBody(image);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(image.mimeType)}`;

  const { error } = await bilt.storage.from(bucket).upload(path, body, {
    contentType: image.mimeType,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return bilt.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
