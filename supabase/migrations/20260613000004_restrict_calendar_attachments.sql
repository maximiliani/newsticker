
-- Restrict access to calendar attachments to the owner only.
-- This fixes the overly permissive public access policy.

UPDATE storage.buckets SET public = false WHERE id = 'calendar-attachments';

DROP POLICY IF EXISTS "Public Access" ON storage.objects;

CREATE POLICY "Owners can view their own calendar attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'calendar-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
