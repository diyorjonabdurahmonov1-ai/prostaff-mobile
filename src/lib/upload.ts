/**
 * Picking an image and turning it into a URL the rest of the platform can load.
 *
 * `expo-image-picker` hands back a local `file://` URI. Storing that on a
 * profile looks fine on the device that chose the photo and shows a broken
 * image everywhere else — which is why a worker's picture was never visible to
 * the customer looking at their profile. So the bytes go to the server
 * (`POST /uploads`) and what gets stored is the returned `https://` URL.
 */

import * as ImagePicker from 'expo-image-picker';

import { api } from '@/lib/api';

interface UploadResponse {
  id: string;
  url: string;
}

export interface PickOptions {
  /** square crop — right for avatars, wrong for a work gallery */
  square?: boolean;
  /** JPEG quality passed to the picker; the server caps uploads at 3 MB */
  quality?: number;
  /** let the user pick several photos at once (gallery) */
  multiple?: boolean;
}

/** Uploads already-encoded base64 bytes and returns the public URL. */
export async function uploadBase64(base64: string, mime = 'image/jpeg'): Promise<string> {
  const res = await api.post<UploadResponse>('/uploads', { data: base64, mime });
  return res.url;
}

/**
 * Opens the library, uploads what the user picked, and returns the public URLs.
 * Returns an empty array when the picker was dismissed.
 *
 * Throws if the upload fails — callers show the error, because silently
 * keeping the old photo after a tap looks like the button is broken.
 */
export async function pickAndUploadImages(options: PickOptions = {}): Promise<string[]> {
  const { square = false, quality = 0.6, multiple = false } = options;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: square && !multiple,
    allowsMultipleSelection: multiple,
    aspect: square ? [1, 1] : undefined,
    quality,
    base64: true,
  });
  if (result.canceled || result.assets.length === 0) return [];

  const urls: string[] = [];
  for (const asset of result.assets) {
    if (!asset.base64) continue;
    urls.push(await uploadBase64(asset.base64, asset.mimeType ?? 'image/jpeg'));
  }
  return urls;
}

/** Convenience wrapper for the single-photo case (avatar, logo). */
export async function pickAndUploadImage(options: PickOptions = {}): Promise<string | null> {
  const [url] = await pickAndUploadImages({ ...options, multiple: false });
  return url ?? null;
}
