-- Create the 'instagram-profiles' storage bucket and make it public
INSERT INTO storage.buckets (id, name, public)
VALUES ('instagram-profiles', 'instagram-profiles', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Optional: Add RLS policies if you need finer-grained control.
-- For many use cases, setting the bucket to `public = true` is sufficient for read access.
-- If you want to restrict uploads, you would add specific policies.

-- For example, to allow authenticated users to upload:
DROP POLICY IF EXISTS "Allow authenticated uploads to instagram-profiles" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to instagram-profiles"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'instagram-profiles');

-- To allow public read access (if not covered by bucket being public, or for more specific rules):
DROP POLICY IF EXISTS "Allow public read access to instagram-profiles" ON storage.objects;
CREATE POLICY "Allow public read access to instagram-profiles"
ON storage.objects FOR SELECT USING (bucket_id = 'instagram-profiles');