INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('calendar-attachments', 'calendar-attachments', true, 52428800,
  ARRAY['image/jpeg','image/png','image/gif','image/webp',
        'video/mp4','video/quicktime',
        'application/pdf','text/plain','application/zip'])
ON CONFLICT (id) DO NOTHING;

-- Policies: public read, authenticated owner upload, service_role full
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'calendar-attachments');

CREATE POLICY "Authenticated users can upload calendar attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'calendar-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Service role has full access to calendar attachments"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'calendar-attachments')
WITH CHECK (bucket_id = 'calendar-attachments');
