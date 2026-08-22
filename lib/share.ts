import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

import { formatPrice } from '@/lib/format';

/** `shared` = handed to the OS sheet, `copied` = link put on the clipboard instead. */
export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed';

/** Canonical link to a product: the site URL on web, the app deep link on native. */
export function productUrl(productId: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/products/${productId}`;
  }
  return Linking.createURL(`/products/${productId}`);
}

async function copyLink(url: string): Promise<ShareOutcome> {
  try {
    await Clipboard.setStringAsync(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/**
 * Opens the platform share sheet for a product, falling back to copying the
 * link when no share sheet exists (most desktop browsers).
 */
export async function shareProduct(input: {
  id: string;
  title: string;
  price: number;
}): Promise<ShareOutcome> {
  const url = productUrl(input.id);
  const text = `${input.title}｜${formatPrice(input.price)}`;

  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: input.title, text, url });
        return 'shared';
      } catch {
        // The user closed the sheet, or the browser refused — copying still helps.
        return copyLink(url);
      }
    }
    return copyLink(url);
  }

  try {
    const result = await Share.share({ title: input.title, message: `${text}\n${url}` });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return copyLink(url);
  }
}
