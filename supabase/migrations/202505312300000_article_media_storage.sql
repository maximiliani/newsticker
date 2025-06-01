BEGIN;
-- Create the article_media bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('article_media', 'article_media', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow users to upload media for their articles
CREATE POLICY "Users can upload media for their articles" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'article_media' AND
  (auth.uid() = owner)
);

-- Policy to allow users to update their article media
CREATE POLICY "Users can update their article media" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'article_media' AND
  (auth.uid() = owner)
)
WITH CHECK (
  bucket_id = 'article_media' AND
  (auth.uid() = owner)
);

-- Policy to allow users to delete their article media
CREATE POLICY "Users can delete their article media" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'article_media' AND
  (auth.uid() = owner)
);

-- Policy to allow public read access to article media
CREATE POLICY "Anyone can view article media" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'article_media'
);

-- Add media_urls column to articles table
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]'::jsonb;

COMMIT;