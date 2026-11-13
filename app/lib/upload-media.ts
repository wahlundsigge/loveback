import { supabase } from './supabase';
import { IS_DEMO } from '../../demo/config';

export type MediaType = 'image' | 'video';

export async function uploadMedia(
  blob: Blob,
  mimeType: string,
  userId: string,
  type: MediaType,
  localUri?: string,
): Promise<string> {
  // Demo Mode: nothing is uploaded — the picked file is shown straight from
  // the device for the rest of the session.
  if (IS_DEMO && localUri) return localUri;

  const ext = mimeType.includes('png') ? 'png'
    : mimeType.includes('webp') ? 'webp'
    : mimeType.includes('avif') ? 'avif'
    : mimeType.includes('heic') ? 'heic'
    : mimeType.includes('heif') ? 'heif'
    : mimeType.includes('video') ? 'mp4'
    : 'jpg';

  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('profile-photos')
    .upload(path, blob, { contentType: mimeType });

  if (error) throw new Error(error.message);

  return supabase.storage.from('profile-photos').getPublicUrl(path).data.publicUrl;
}
