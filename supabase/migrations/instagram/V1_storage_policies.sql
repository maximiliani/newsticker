-- Start a transaction block
BEGIN;

-- Policy to allow authenticated users to upload images to the 'instagram-profiles' bucket
-- This policy ensures only authenticated users can insert new objects into storage
CREATE POLICY "Allow authenticated users to upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'instagram-profiles' AND
    auth.role() = 'authenticated'
);

-- Policy to allow public access for viewing images from the 'instagram-profiles' bucket
-- This ensures anyone can retrieve/view the images, even without authentication
CREATE POLICY "Allow public to view images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'instagram-profiles');

-- Commit the transaction
COMMIT;