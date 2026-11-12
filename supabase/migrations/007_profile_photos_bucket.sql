-- Profile photos/videos storage bucket
-- Run this in the Supabase SQL Editor.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos', 'profile-photos', true,
  52428800,
  ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read profile photos
CREATE POLICY "Public read profile photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

-- Authenticated users can upload into their own folder
CREATE POLICY "Users upload own photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text);

-- Authenticated users can delete their own files
CREATE POLICY "Users delete own photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text);
