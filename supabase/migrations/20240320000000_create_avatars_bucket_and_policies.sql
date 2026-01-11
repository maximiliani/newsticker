-- Create the avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to upload their own avatar
CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  (auth.uid() = owner)
);

-- Policy to allow users to update their own avatar
CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  (auth.uid() = owner)
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (auth.uid() = owner)
);

-- Policy to allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatar" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars' AND
  (auth.uid() = owner)
);

-- Policy to allow public read access to avatars
CREATE POLICY "Anyone can view avatars" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'avatars'
); 