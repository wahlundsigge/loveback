-- Expand allowed formats for the profile-photos bucket.
-- 007_profile_photos_bucket.sql's allow-list never included AVIF or HEIC/HEIF,
-- which modern phones/browsers now capture and export by default (Android 12+
-- camera, recent Chrome, iPhone camera roll). Uploads in those formats were
-- rejected outright by Supabase Storage: "mime type image/avif is not supported".
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif',
  'video/mp4','video/quicktime'
]
WHERE id = 'profile-photos';

