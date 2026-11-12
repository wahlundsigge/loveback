import { supabase } from './supabase';

export type MediaType = 'image' | 'video';

export async function uploadMedia(
  blob: Blob,
  mimeType: string,
  userId: string,
  type: MediaType,
): Promise<string> {
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
