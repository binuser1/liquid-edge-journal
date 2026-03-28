-- Liquid Edge: fix chart images in archive (thumbnails + modal)
-- Run this once in Supabase Dashboard → SQL → New query → Run
--
-- Your app stores files as: charts / {user_id}/{trade_id}.ext
-- Signed URLs and downloads require SELECT on storage.objects for that path.

-- Clean up if you re-run this script
DROP POLICY IF EXISTS "charts_select_own" ON storage.objects;
DROP POLICY IF EXISTS "charts_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "charts_update_own" ON storage.objects;
DROP POLICY IF EXISTS "charts_delete_own" ON storage.objects;

-- Read (required for createSignedUrls + <img src>)
CREATE POLICY "charts_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'charts'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- Upload new chart
CREATE POLICY "charts_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'charts'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- Overwrite (script uses upsert: true on upload)
CREATE POLICY "charts_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'charts'
  AND split_part(name, '/', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'charts'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- Remove file when trade deleted
CREATE POLICY "charts_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'charts'
  AND split_part(name, '/', 1) = auth.uid()::text
);
