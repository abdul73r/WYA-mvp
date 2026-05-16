'use client';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Uploads an image to Firebase Storage and returns the public download URL.
 * Path: trucks/{ownerUid}/{truckId}/{kind}-{timestamp}-{originalName}
 */
export async function uploadTruckImage(
  ownerUid: string,
  truckId: string,
  kind: 'logo' | 'cover' | 'menu',
  file: File,
): Promise<string> {
  const safe = file.name.replace(/[^a-z0-9.\-_]/gi, '_');
  const path = `trucks/${ownerUid}/${truckId}/${kind}-${Date.now()}-${safe}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type });
  return await getDownloadURL(r);
}

export async function deleteByUrl(url: string) {
  try {
    const r = ref(storage, url);
    await deleteObject(r);
  } catch { /* ignore */ }
}
